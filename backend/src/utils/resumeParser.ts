/**
 * resumeParser.ts — AI-FREE resume/CV parsing layer
 *
 * Handles all file types and URL scraping using only local libraries.
 * NO Gemini / AI calls are made here. AI is reserved exclusively for
 * the screening/ranking step (screenAI).
 *
 * Supported inputs:
 *   - PDF buffer      → pdf-parse
 *   - DOCX buffer     → mammoth
 *   - DOC buffer      → mammoth
 *   - TXT buffer      → utf-8 decode
 *   - Image buffer    → tesseract.js OCR
 *   - URL string      → axios + cheerio scrape
 *
 * After text is extracted, a heuristic parser pulls structured fields
 * (name, email, phone, skills, experience, education, etc.) directly
 * from the raw text using regex and pattern matching.
 */

import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { createWorker } from "tesseract.js";
import * as cheerio from "cheerio";
import logger from "./logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedCandidate {
  full_name: string;
  first_name: string;
  last_name: string;
  email: string;
  // Quality gate fields — set by scoreParseConfidence()
  _parseConfidence?: number;   // 0-100
  _needsReview?: boolean;      // true = route to "Needs Review" tab
  _missingFields?: string[];   // human-readable list of what's missing
  _nonStandard?: boolean;      // alias used by CandidateCsvPreview
  phone: string;
  location: string;
  headline: string;
  bio: string;
  current_role: string;
  current_company: string;
  experience_years: number;
  education_level: string;
  education_field: string;
  portfolio_url: string;
  skills: Array<{ name: string; level: string }>;
  languages: Array<{ name: string; proficiency: string }>;
  experience: Array<{
    company: string;
    role: string;
    startDate: string;
    endDate: string;
    description: string;
    technologies: string[];
    isCurrent: boolean;
  }>;
  education: Array<{
    institution: string;
    degree: string;
    fieldOfStudy: string;
    startYear?: number;
    endYear?: number;
  }>;
  certifications: Array<{ name: string; issuer: string; issueDate: string }>;
  projects: Array<{
    name: string;
    description: string;
    technologies: string[];
    link: string;
  }>;
  socialLinks: {
    linkedin?: string;
    github?: string;
    portfolio?: string;
    website?: string;
  };
  availability: { status: string; type: string };
  sourceType: string;
  _rawText?: string; // kept for debugging; stripped before DB save
}

// ─── Step 1: Extract raw text from any input ──────────────────────────────────

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimetype: string,
  filename: string
): Promise<string> {
  const ext = filename.toLowerCase().split(".").pop() ?? "";

  if (mimetype === "application/pdf" || ext === "pdf") {
    try {
      const data = await pdfParse(buffer);
      const text = data.text?.trim() ?? "";
      if (text.length < 50) throw new Error("PDF text too short — may be image-only or encrypted");
      return text;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("PDF parse error:", msg);
      throw new Error(`Could not extract text from PDF: ${msg}`);
    }
  }

  if (
    mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx" || ext === "doc" ||
    mimetype === "application/msword"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    if (!result.value.trim()) throw new Error("DOCX extracted no text — file may be empty or corrupt");
    return result.value;
  }

  if (mimetype === "text/plain" || ext === "txt") {
    return buffer.toString("utf-8");
  }

  if (mimetype.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "tiff"].includes(ext)) {
    logger.info("Running OCR on image file...");
    const worker = await createWorker("eng");
    const { data } = await worker.recognize(buffer);
    await worker.terminate();
    if (data.text.length < 50) throw new Error("OCR extracted too little text from image");
    return data.text;
  }

  throw new Error(`Unsupported file type: ${mimetype} (.${ext})`);
}

export async function extractTextFromUrl(url: string): Promise<string> {
  // Resolve Google Drive share links to direct download links
  const resolvedUrl = resolveGoogleDriveUrl(url);

  const response = await fetch(resolvedUrl, {
    redirect: "follow",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; TalentScreenBot/1.0)" },
  });

  if (!response.ok) throw new Error(`Failed to fetch URL (${response.status}): ${url}`);

  const contentType = response.headers.get("content-type") ?? "";
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // If the URL returned a binary document, parse it directly
  if (contentType.includes("pdf") || resolvedUrl.endsWith(".pdf")) {
    return extractTextFromBuffer(buffer, "application/pdf", "file.pdf");
  }
  if (contentType.includes("wordprocessingml") || resolvedUrl.endsWith(".docx")) {
    return extractTextFromBuffer(buffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "file.docx");
  }

  // Otherwise treat as HTML and scrape the text content
  const html = buffer.toString("utf-8");
  const $ = cheerio.load(html);

  // Remove boilerplate elements
  $("script, style, nav, footer, header, aside, iframe, noscript").remove();

  // Try to find the main content block first
  const mainSelectors = ["main", "article", "[role='main']", ".resume", ".cv", "#resume", "#content"];
  let text = "";
  for (const sel of mainSelectors) {
    const el = $(sel);
    if (el.length) { text = el.text(); break; }
  }

  // Fallback to full body text
  if (!text.trim()) text = $("body").text();

  // Collapse whitespace
  text = text.replace(/\s+/g, " ").trim();

  if (text.length < 100) throw new Error("Could not extract meaningful text from URL — check that the page is publicly accessible");
  return text;
}

function resolveGoogleDriveUrl(url: string): string {
  // https://drive.google.com/file/d/FILE_ID/view → direct download
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return `https://drive.google.com/uc?export=download&id=${match[1]}`;
  return url;
}

// ─── Step 2: Heuristic field extraction from plain text ──────────────────────

/**
 * Parse structured candidate data from raw resume text.
 * Uses regex patterns and section detection — no AI.
 */
export function parseResumeText(text: string, sourceType: string): ParsedCandidate {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const email     = extractEmail(text);
  const phone     = extractPhone(text);
  const name      = extractName(lines, email);
  const links     = extractSocialLinks(text);
  const location  = extractLocation(text, lines);
  const sections  = splitIntoSections(lines);

  const skills         = extractSkills(sections, text);
  const expEntries     = extractExperience(sections);
  const eduEntries     = extractEducation(sections);
  const certEntries    = extractCertifications(sections);
  const projectEntries = extractProjects(sections);

  const currentRole    = expEntries[0]?.role ?? "";
  const currentCompany = expEntries[0]?.company ?? "";
  const expYears       = calculateExperienceYears(expEntries);
  const { level: eduLevel, field: eduField } = deriveEducationLevel(eduEntries, text);
  const headline       = buildHeadline(currentRole, skills);

  const nameParts = name.trim().split(/\s+/);
  const firstName = nameParts[0] ?? "";
  const lastName  = nameParts.slice(1).join(" ");

  return {
    full_name:        name,
    first_name:       firstName,
    last_name:        lastName,
    email:            email,
    phone:            phone,
    location:         location,
    headline:         headline,
    bio:              "",          // Not heuristically reliable enough to guess
    current_role:     currentRole,
    current_company:  currentCompany,
    experience_years: expYears,
    education_level:  eduLevel,
    education_field:  eduField,
    portfolio_url:    links.portfolio ?? links.website ?? "",
    skills,
    languages:        extractLanguages(sections, text),
    experience:       expEntries,
    education:        eduEntries,
    certifications:   certEntries,
    projects:         projectEntries,
    socialLinks:      links,
    availability:     { status: "Available", type: "Full-time" },
    sourceType,
    _rawText:         text.slice(0, 5000),
  };
}

// ─── Extractors ───────────────────────────────────────────────────────────────

function extractEmail(text: string): string {
  const match = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  return match?.[0]?.toLowerCase() ?? "";
}

function extractPhone(text: string): string {
  const match = text.match(/(\+?[\d\s\-().]{7,20}(?=\s|$))/);
  if (!match) return "";
  const cleaned = match[0].replace(/\s+/g, " ").trim();
  // Filter out things that look like years or short numbers
  if (cleaned.replace(/\D/g, "").length < 7) return "";
  return cleaned;
}

function extractName(lines: string[], email: string): string {
  // Strategy: first non-empty line that is NOT an email, URL, or section header
  // and looks like a real name (2+ words, mostly letters)
  const emailUser = email.split("@")[0] ?? "";
  const sectionKeywords = /^(education|experience|skills|work|profile|summary|contact|projects|certif|language|reference|objective|about)/i;

  for (const line of lines.slice(0, 8)) {
    if (!line || line.includes("@") || line.includes("http")) continue;
    if (sectionKeywords.test(line)) continue;
    if (line.length > 60) continue; // Too long to be a name
    const words = line.split(/\s+/).filter(w => /^[A-Za-zÀ-ÿ\-']+$/.test(w));
    if (words.length >= 2 && words.length <= 5) {
      return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
  }

  // Fallback: derive from email
  if (emailUser) {
    return emailUser.replace(/[._\-]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }
  return "Unknown Candidate";
}

function extractLocation(text: string, lines: string[]): string {
  // Common patterns: "City, Country" or "City, State"
  const patterns = [
    /([A-Z][a-zA-Z\s]+),\s*([A-Z]{2,3}|[A-Z][a-zA-Z]+)\b/,  // "Kigali, Rwanda" or "New York, NY"
  ];
  for (const pat of patterns) {
    const match = text.match(pat);
    if (match) {
      const candidate = match[0].trim();
      // Make sure it doesn't look like a company or school name
      if (!/(university|college|institute|ltd|inc|corp|llc)/i.test(candidate)) {
        return candidate;
      }
    }
  }
  return "";
}

function extractSocialLinks(text: string): ParsedCandidate["socialLinks"] {
  const linkedin  = text.match(/linkedin\.com\/in\/[a-zA-Z0-9\-_/]+/)?.[0];
  const github    = text.match(/github\.com\/[a-zA-Z0-9\-_/]+/)?.[0];
  const portfolio = text.match(/https?:\/\/(?!linkedin|github)[a-zA-Z0-9.\-/]+\.[a-z]{2,}[^\s]*/)?.[0];

  return {
    linkedin:  linkedin  ? `https://${linkedin}` : undefined,
    github:    github    ? `https://${github}`   : undefined,
    portfolio: portfolio ?? undefined,
    website:   portfolio ?? undefined,
  };
}

/**
 * Split raw lines into named sections by detecting header keywords.
 * Returns a map like { "experience": [...lines], "education": [...lines], ... }
 */
function splitIntoSections(lines: string[]): Record<string, string[]> {
  const SECTION_HEADERS: Record<string, RegExp> = {
    experience:     /^(work\s*experience|experience|employment|career|professional\s*background)/i,
    education:      /^(education|academic|qualifications?|degrees?)/i,
    skills:         /^(skills?|technical\s*skills?|core\s*competencies|technologies|tools)/i,
    certifications: /^(certifications?|licen[sc]es?|credentials?|accreditations?)/i,
    projects:       /^(projects?|portfolio|notable\s*work|personal\s*projects?)/i,
    languages:      /^(languages?|spoken\s*languages?)/i,
    summary:        /^(summary|profile|about\s*me|objective|overview)/i,
  };

  const sections: Record<string, string[]> = {};
  let currentSection = "header";
  sections[currentSection] = [];

  for (const line of lines) {
    let matched = false;
    for (const [key, pattern] of Object.entries(SECTION_HEADERS)) {
      if (pattern.test(line) && line.length < 50) {
        currentSection = key;
        sections[currentSection] = [];
        matched = true;
        break;
      }
    }
    if (!matched) {
      if (!sections[currentSection]) sections[currentSection] = [];
      sections[currentSection].push(line);
    }
  }

  return sections;
}

// ─── Skills ───────────────────────────────────────────────────────────────────

const KNOWN_TECH_SKILLS = new Set([
  // Languages
  "javascript","typescript","python","java","c++","c#","go","rust","php","ruby","swift","kotlin","scala","r","matlab",
  // Frontend
  "react","react.js","vue","vue.js","angular","next.js","nuxt.js","svelte","html","css","tailwind","sass","scss","redux","vite","webpack",
  // Backend
  "node.js","express","fastapi","django","flask","spring","laravel","rails","graphql","rest api","grpc","nestjs",
  // Databases
  "postgresql","mysql","mongodb","redis","sqlite","elasticsearch","dynamodb","firestore","supabase","prisma","mongoose",
  // Cloud / DevOps
  "aws","gcp","azure","docker","kubernetes","terraform","ansible","ci/cd","github actions","jenkins","linux","nginx",
  // AI/ML
  "machine learning","deep learning","tensorflow","pytorch","scikit-learn","openai","langchain","nlp","computer vision","pandas","numpy",
  // Mobile
  "react native","flutter","ios","android","expo",
  // Tools
  "git","figma","jira","postman","vercel","firebase","stripe","shopify",
]);

function extractSkills(sections: Record<string, string[]>, fullText: string): Array<{ name: string; level: string }> {
  const found = new Set<string>();

  // 1. Parse the dedicated skills section
  const skillLines = sections["skills"] ?? [];
  for (const line of skillLines) {
    // Lines like "React, Node.js, TypeScript" or "React | Node | TS"
    const parts = line.split(/[,|•·\t]+/).map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      const clean = part.replace(/[():\d%]/g, "").trim();
      if (clean.length >= 2 && clean.length <= 40) {
        found.add(clean);
      }
    }
  }

  // 2. Scan full text for known tech keywords (case-insensitive)
  const lowerText = fullText.toLowerCase();
  for (const skill of KNOWN_TECH_SKILLS) {
    if (lowerText.includes(skill.toLowerCase())) {
      // Use the canonical casing from the known set
      found.add(skill.charAt(0).toUpperCase() + skill.slice(1));
    }
  }

  return Array.from(found)
    .filter(s => s.length >= 2 && s.length <= 40)
    .slice(0, 30)
    .map(name => ({ name, level: "Intermediate" }));
}

// ─── Experience ───────────────────────────────────────────────────────────────

function extractExperience(sections: Record<string, string[]>): ParsedCandidate["experience"] {
  const lines = sections["experience"] ?? [];
  if (!lines.length) return [];

  const entries: ParsedCandidate["experience"] = [];
  const datePattern  = /(\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{4}|\d{4})\s*[-–—to]+\s*(\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{4}|\d{4}|present|current|now)/i;
  const yearPattern  = /\b(19|20)\d{2}\b/;

  let current: (typeof entries)[0] | null = null;

  for (const line of lines) {
    const dateMatch = line.match(datePattern);
    if (dateMatch) {
      // This line likely starts a new experience block
      if (current) entries.push(current);
      const start   = dateMatch[1] ?? "";
      const end     = dateMatch[2] ?? "Present";
      const isCurrent = /present|current|now/i.test(end);
      // Rest of the line (before or after the date) → role / company
      const rest = line.replace(dateMatch[0], "").replace(/[|,@–—\-]+/g, " ").trim();
      const parts = rest.split(/\s{2,}|@|at\s/i).map(s => s.trim()).filter(Boolean);
      current = {
        role:        parts[0] ?? "",
        company:     parts[1] ?? "",
        startDate:   normalizeDate(start),
        endDate:     isCurrent ? "Present" : normalizeDate(end),
        isCurrent,
        description: "",
        technologies: [],
      };
    } else if (current && line.length > 10) {
      // Accumulate description lines
      current.description += (current.description ? " " : "") + line;

      // Pick out any tech keywords mentioned in description lines
      const lowerLine = line.toLowerCase();
      for (const tech of KNOWN_TECH_SKILLS) {
        if (lowerLine.includes(tech.toLowerCase()) && !current.technologies.includes(tech)) {
          current.technologies.push(tech.charAt(0).toUpperCase() + tech.slice(1));
        }
      }
    }
  }

  if (current) entries.push(current);
  return entries.slice(0, 8); // Cap at 8 entries
}

function normalizeDate(raw: string): string {
  // Convert "Jan 2020" → "2020-01", "2020" → "2020-01"
  const months: Record<string, string> = {
    jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",
    jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12",
  };
  const m = raw.toLowerCase().match(/([a-z]+)\.?\s*(\d{4})/);
  if (m) return `${m[2]}-${months[m[1].slice(0,3)] ?? "01"}`;
  const y = raw.match(/\d{4}/);
  if (y) return `${y[0]}-01`;
  return raw;
}

// ─── Education ────────────────────────────────────────────────────────────────

const DEGREE_KEYWORDS: Record<string, string> = {
  "phd": "PhD", "doctor": "PhD", "doctorate": "PhD",
  "master": "Master", "msc": "Master", "mba": "Master", "m.sc": "Master", "m.eng": "Master",
  "bachelor": "Bachelor", "bsc": "Bachelor", "b.sc": "Bachelor", "b.eng": "Bachelor", "ba ": "Bachelor",
  "associate": "Associate",
  "high school": "High School", "secondary": "High School", "diploma": "High School",
};

function extractEducation(sections: Record<string, string[]>): ParsedCandidate["education"] {
  const lines = sections["education"] ?? [];
  if (!lines.length) return [];

  const entries: ParsedCandidate["education"] = [];
  let current: (typeof entries)[0] | null = null;

  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    const yearMatch = line.match(/\b(19|20)\d{2}\b/g);

    const isDegreeOrSchool = Object.keys(DEGREE_KEYWORDS).some(k => lowerLine.includes(k))
      || /(university|college|institute|school|academy)/i.test(line);

    if (isDegreeOrSchool) {
      if (current) entries.push(current);

      // Find degree type
      let degree = "";
      let fieldOfStudy = "";
      for (const [keyword, normalized] of Object.entries(DEGREE_KEYWORDS)) {
        if (lowerLine.includes(keyword)) { degree = normalized; break; }
      }

      // Try to extract field of study after "in" or "of"
      const fieldMatch = line.match(/(?:in|of)\s+([A-Za-z\s&]+?)(?:\s+at|\s+from|\s*,|\s*\(|$)/i);
      if (fieldMatch) fieldOfStudy = fieldMatch[1].trim();

      // Try institution name (often "at X" or "@ X" or standalone)
      const instMatch = line.match(/(?:at|@|from|–|-)\s+([A-Za-z\s]+University|[A-Za-z\s]+College|[A-Za-z\s]+Institute|[A-Za-z\s]+School)/i);

      current = {
        institution:  instMatch?.[1]?.trim() ?? line.replace(/\b(19|20)\d{2}\b/g, "").trim(),
        degree,
        fieldOfStudy,
        startYear:    yearMatch?.[0] ? parseInt(yearMatch[0]) : undefined,
        endYear:      yearMatch?.[1] ? parseInt(yearMatch[1]) : undefined,
      };
    }
  }

  if (current) entries.push(current);
  return entries.slice(0, 5);
}

function deriveEducationLevel(entries: ParsedCandidate["education"], fullText: string): { level: string; field: string } {
  if (entries.length > 0 && entries[0].degree) {
    return { level: entries[0].degree, field: entries[0].fieldOfStudy ?? "" };
  }

  // Fallback: scan full text
  const lowerText = fullText.toLowerCase();
  for (const [keyword, normalized] of Object.entries(DEGREE_KEYWORDS)) {
    if (lowerText.includes(keyword)) return { level: normalized, field: "" };
  }

  return { level: "", field: "" };
}

// ─── Certifications ───────────────────────────────────────────────────────────

const KNOWN_CERTS = [
  "aws certified","google cloud","azure certified","ckad","cka","pmp","cissp","comptia",
  "scrum master","certified scrum","oracle certified","cisco","ccna","ccnp","itil",
  "tensorflow certificate","deep learning specialization","coursera","udemy","linkedin learning",
];

function extractCertifications(sections: Record<string, string[]>): ParsedCandidate["certifications"] {
  const lines = sections["certifications"] ?? [];
  const certs: ParsedCandidate["certifications"] = [];

  for (const line of lines) {
    if (line.length < 5) continue;
    const yearMatch = line.match(/\b(20\d{2})\b/);
    certs.push({
      name:      line.replace(/\b20\d{2}\b/, "").replace(/[–\-|,]+$/g, "").trim(),
      issuer:    "",
      issueDate: yearMatch ? `${yearMatch[1]}-01` : "",
    });
  }

  // Also scan full text for well-known cert names
  if (certs.length === 0) {
    const lowerText = sections["header"]?.join(" ").toLowerCase() ?? "";
    for (const cert of KNOWN_CERTS) {
      if (lowerText.includes(cert)) {
        certs.push({ name: cert.replace(/\b\w/g, c => c.toUpperCase()), issuer: "", issueDate: "" });
      }
    }
  }

  return certs.slice(0, 10);
}

// ─── Projects ─────────────────────────────────────────────────────────────────

function extractProjects(sections: Record<string, string[]>): ParsedCandidate["projects"] {
  const lines = sections["projects"] ?? [];
  if (!lines.length) return [];

  const projects: ParsedCandidate["projects"] = [];
  let current: (typeof projects)[0] | null = null;

  for (const line of lines) {
    const urlMatch = line.match(/https?:\/\/[^\s]+/);
    // A project title is usually a short line that starts with a capital or bullet
    const looksLikeTitle = line.length < 80 && /^[A-Z•\-*]/.test(line) && !line.endsWith(".");

    if (looksLikeTitle && line.length > 3) {
      if (current) projects.push(current);
      current = {
        name:         line.replace(/^[•\-*]\s*/, "").trim(),
        description:  "",
        technologies: [],
        link:         urlMatch?.[0] ?? "",
      };
    } else if (current) {
      current.description += (current.description ? " " : "") + line;
      const lowerLine = line.toLowerCase();
      for (const tech of KNOWN_TECH_SKILLS) {
        if (lowerLine.includes(tech.toLowerCase()) && !current.technologies.includes(tech)) {
          current.technologies.push(tech.charAt(0).toUpperCase() + tech.slice(1));
        }
      }
      if (urlMatch && !current.link) current.link = urlMatch[0];
    }
  }

  if (current) projects.push(current);
  return projects.slice(0, 6);
}

// ─── Languages ────────────────────────────────────────────────────────────────

const LANGUAGE_NAMES = new Set([
  "english","french","spanish","portuguese","arabic","swahili","kinyarwanda","german","chinese",
  "mandarin","japanese","korean","italian","dutch","hindi","urdu","russian","turkish","polish",
]);

function extractLanguages(sections: Record<string, string[]>, fullText: string): Array<{ name: string; proficiency: string }> {
  const lines = sections["languages"] ?? [];
  const found: Array<{ name: string; proficiency: string }> = [];

  for (const line of lines) {
    const parts = line.split(/[,|•·\-:]+/).map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      const lower = part.toLowerCase();
      for (const lang of LANGUAGE_NAMES) {
        if (lower.includes(lang)) {
          const prof = /native|mother/i.test(part) ? "Native"
            : /fluent|advanced|proficient/i.test(part) ? "Fluent"
            : /conversational|intermediate/i.test(part) ? "Conversational"
            : "Basic";
          if (!found.find(f => f.name.toLowerCase() === lang)) {
            found.push({ name: lang.charAt(0).toUpperCase() + lang.slice(1), proficiency: prof });
          }
        }
      }
    }
  }

  return found.slice(0, 8);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calculateExperienceYears(entries: ParsedCandidate["experience"]): number {
  if (!entries.length) return 0;

  let totalMonths = 0;
  const now = new Date();

  for (const entry of entries) {
    const start = parsePartialDate(entry.startDate);
    const end   = entry.isCurrent ? now : parsePartialDate(entry.endDate);
    if (start && end && end > start) {
      totalMonths += (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    }
  }

  const years = totalMonths / 12;
  return Math.round(years * 2) / 2; // Round to nearest 0.5
}

function parsePartialDate(raw: string): Date | null {
  if (!raw || raw === "Present") return new Date();
  const m = raw.match(/^(\d{4})-(\d{2})$/);
  if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1);
  const y = raw.match(/^\d{4}$/);
  if (y) return new Date(parseInt(y[0]), 0);
  return null;
}

function buildHeadline(role: string, skills: Array<{ name: string }>): string {
  if (!role && !skills.length) return "";
  if (role && skills.length >= 2) {
    const topSkills = skills.slice(0, 2).map(s => s.name).join(" & ");
    return `${role} specializing in ${topSkills}`;
  }
  if (role) return role;
  return skills.slice(0, 3).map(s => s.name).join(", ") + " Professional";
}

// ─── Parse quality gate ──────────────────────────────────────────────────────

/**
 * Score how confident we are that the parsed result is a real, usable candidate.
 * Returns 0-100. Below REVIEW_THRESHOLD → flag as needs review.
 *
 * A standard CV should have: name, email, at least one skill, some experience,
 * a role, and a location. Each present field contributes points.
 */
const REVIEW_THRESHOLD = 50;

export function scoreParseConfidence(c: ParsedCandidate): {
  score: number;
  missing: string[];
  needsReview: boolean;
} {
  const missing: string[] = [];
  let score = 0;

  // Core identity (40 pts)
  if (c.full_name && c.full_name !== "Unknown Candidate" && c.full_name.length > 2) {
    score += 20;
  } else {
    missing.push("full name");
  }

  if (c.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) {
    score += 20;
  } else {
    missing.push("email");
  }

  // Professional content (45 pts)
  if (c.skills && c.skills.length >= 2) {
    score += 15;
  } else {
    missing.push("skills");
  }

  if (c.current_role && c.current_role.length > 2) {
    score += 15;
  } else if (c.experience && c.experience.length > 0) {
    score += 10; // partial credit for having experience entries
  } else {
    missing.push("role / experience");
  }

  if (c.experience_years && c.experience_years > 0) {
    score += 10;
  }

  if (c.education_level && c.education_level.length > 0) {
    score += 5;
  }

  // Context (15 pts)
  if (c.location && c.location.length > 2) score += 8;
  if (c.experience && c.experience.length > 0) score += 7;

  // Penalty: if name looks like a URL or gibberish
  if (/https?:|www\.|\.com|\.org/i.test(c.full_name)) {
    score = Math.max(0, score - 30);
    missing.push("readable name (parsed name looks like a URL)");
  }

  // Penalty: if skills are suspiciously long (parsed body text, not actual skills)
  const avgSkillLen = c.skills.length
    ? c.skills.reduce((sum, s) => sum + s.name.length, 0) / c.skills.length
    : 0;
  if (avgSkillLen > 35) {
    score = Math.max(0, score - 20);
    missing.push("clean skill data (skills look like paragraphs)");
  }

  const needsReview = score < REVIEW_THRESHOLD || missing.includes("full name") || missing.includes("email");

  return { score, missing, needsReview };
}

// ─── Main entry points ────────────────────────────────────────────────────────

/** Parse a file buffer → structured candidate (no AI) */
export async function parseFileToCandidate(
  buffer: Buffer,
  mimetype: string,
  filename: string
): Promise<ParsedCandidate> {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const sourceType = ext === "pdf" ? "pdf"
    : ["docx", "doc"].includes(ext) ? "docx"
    : mimetype.startsWith("image/") ? "image_ocr"
    : "manual";

  const text = await extractTextFromBuffer(buffer, mimetype, filename);
  const candidate = parseResumeText(text, sourceType);
  delete candidate._rawText;

  // Apply quality gate — flag low-confidence parses for HR review
  const { score, missing, needsReview } = scoreParseConfidence(candidate);
  candidate._parseConfidence = score;
  candidate._needsReview     = needsReview;
  candidate._missingFields   = missing;
  candidate._nonStandard     = needsReview; // CandidateCsvPreview reads this

  return candidate;
}

/** Parse a URL → structured candidate (no AI) */
export async function parseUrlToCandidate(url: string): Promise<ParsedCandidate> {
  const text = await extractTextFromUrl(url);
  const candidate = parseResumeText(text, "url");
  delete candidate._rawText;

  // Apply quality gate
  const { score, missing, needsReview } = scoreParseConfidence(candidate);
  candidate._parseConfidence = score;
  candidate._needsReview     = needsReview;
  candidate._missingFields   = missing;
  candidate._nonStandard     = needsReview;

  return candidate;
}
