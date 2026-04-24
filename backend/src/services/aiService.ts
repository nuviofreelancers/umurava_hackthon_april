/**
 * aiService.gem-groq.ts — Gemini-primary with automatic Groq fallback
 *
 * Strategy:
 *   - Every call attempts Gemini first (better quality, supports URL reading)
 *   - If Gemini fails (503, 429, network error, or key missing) → falls back to Groq
 *   - If both fail → throws a combined error
 *   - readLink() always uses Gemini (Groq cannot browse URLs)
 *
 * SETUP:
 *   Set at least one of these in your .env:
 *     GEMINI_API_KEY=...   (primary)
 *     GROQ_API_KEY=...     (fallback)
 *   Both is ideal. Either one alone will work.
 *
 * Responsibilities:
 *   1. extractCV(text)    — Structure raw resume text into the ExtractedCV schema
 *   2. validateCV(parsed) — Fact-check a parsed CV for red flags
 *   3. readLink(url)      — Fetch & extract a CV from a URL (Gemini only)
 *   4. screenAI(...)      — Rank and score candidates against a job spec
 */

import logger from "../utils/logger";

// ─── Config ───────────────────────────────────────────────────────────────────

const GEMINI_API_URL     = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODEL       = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_MAX_RETRIES = 3;
const GEMINI_DELAYS_MS   = [3000, 8000, 15000];

const GROQ_API_URL      = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL        = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GROQ_MAX_RETRIES  = 2;
const GROQ_DELAYS_MS    = [1000, 4000];

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface ExtractedCV {
  error?: "not_a_resume";
  first_name?: string;
  last_name?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  headline?: string;
  bio?: string;
  location?: string;
  current_role?: string;
  current_company?: string;
  experience_years?: number;
  skills?: Array<{ name: string; level: string; yearsOfExperience?: number }>;
  languages?: Array<{ name: string; proficiency: string }>;
  experience?: Array<{
    company: string;
    role: string;
    startDate: string;
    endDate: string;
    description?: string;
    technologies?: string[];
    isCurrent?: boolean;
  }>;
  education?: Array<{
    institution: string;
    degree: string;
    fieldOfStudy?: string;
    startYear?: number;
    endYear?: number;
  }>;
  certifications?: Array<{ name: string; issuer?: string; issueDate?: string }>;
  projects?: Array<{
    name: string;
    description?: string;
    technologies?: string[];
    role?: string;
    link?: string;
    startDate?: string;
    endDate?: string;
  }>;
  availability?: { status?: string; type?: string; startDate?: string };
  socialLinks?: { linkedin?: string; github?: string; portfolio?: string; website?: string };
  education_level?: string;
  education_field?: string;
  portfolio_url?: string;
}

export interface CVValidationResult {
  is_valid: boolean;
  confidence: "High" | "Medium" | "Low";
  flags: Array<{
    field: string;
    issue: "implausible" | "inconsistent" | "suspicious" | "missing_critical";
    detail: string;
  }>;
  overall_note: string;
}

export interface ScreeningWeights {
  skills: number;
  experience: number;
  education: number;
  relevance: number;
}

export interface ScreeningResultAI {
  applicant_id: string;
  applicant_name: string;
  rank: number;
  match_score: number;
  skills_score: number;
  experience_score: number;
  education_score: number;
  relevance_score: number;
  confidence_level: "High" | "Medium" | "Low";
  recommendation: "Strong Yes" | "Yes" | "Maybe" | "No";
  strengths: string[];
  gaps: Array<{ description: string; type: "dealbreaker" | "nice-to-have" | "" }>;
  bias_flags: string[];
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function extractJSON(text: string): string {
  const stripped = text.replace(/^```(?:json)?\s*/im, "").replace(/\s*```$/im, "").trim();
  const match = stripped.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  return match ? match[0].trim() : stripped;
}

// ─── Gemini caller ────────────────────────────────────────────────────────────

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  let lastError: Error = new Error("Gemini failed");

  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = GEMINI_DELAYS_MS[attempt - 1] ?? 20000;
      logger.warn(`[gem-groq][Gemini] retry ${attempt}/${GEMINI_MAX_RETRIES} — waiting ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      const res = await fetch(
        `${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 8192,
            },
            safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
            ],
          }),
        }
      );

      if (res.status === 503 || res.status === 429) {
        lastError = new Error(`Gemini ${res.status} — overloaded/rate-limited`);
        logger.warn(`[gem-groq][Gemini] ${res.status} on attempt ${attempt + 1}`);
        continue;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Gemini API error ${res.status}: ${body}`);
      }

      const data = await res.json() as any;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (!text) throw new Error("Gemini returned empty response");

      logger.info(`[gem-groq][Gemini] ✅ success on attempt ${attempt + 1}`);
      return text;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === GEMINI_MAX_RETRIES) break;
    }
  }
  throw lastError;
}

// ─── Groq caller ──────────────────────────────────────────────────────────────

async function callGroq(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  let lastError: Error = new Error("Groq failed");

  for (let attempt = 0; attempt <= GROQ_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = GROQ_DELAYS_MS[attempt - 1] ?? 8000;
      logger.warn(`[gem-groq][Groq] retry ${attempt}/${GROQ_MAX_RETRIES} — waiting ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      const res = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          max_tokens: 8192,
          response_format: { type: "json_object" },
        }),
      });

      if (res.status === 429 || res.status === 503) {
        lastError = new Error(`Groq ${res.status} — rate limited`);
        continue;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Groq error ${res.status}: ${body}`);
      }

      const data = await res.json() as any;
      const text = data.choices?.[0]?.message?.content ?? "";
      if (!text) throw new Error("Groq returned empty response");

      logger.info(`[gem-groq][Groq] ✅ success on attempt ${attempt + 1}`);
      return text;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === GROQ_MAX_RETRIES) break;
    }
  }
  throw lastError;
}

// ─── Unified fallback orchestrator ────────────────────────────────────────────

type Provider = "gemini" | "groq";

async function callWithFallback(
  prompt: string,
  context: string,
  groqNeedsResultsWrapper = false
): Promise<{ text: string; provider: Provider }> {
  // Try Gemini first
  if (process.env.GEMINI_API_KEY) {
    try {
      const text = await callGemini(prompt);
      return { text, provider: "gemini" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[gem-groq] Gemini failed for ${context}: ${msg} — falling back to Groq`);
    }
  } else {
    logger.info(`[gem-groq] No GEMINI_API_KEY — going straight to Groq for ${context}`);
  }

  // Groq fallback
  if (!process.env.GROQ_API_KEY) {
    throw new Error("Both Gemini and Groq are unavailable — set GEMINI_API_KEY and/or GROQ_API_KEY in .env");
  }

  // Groq's json_object mode requires a top-level object, not an array.
  // For calls that return arrays, we wrap in {"results":[...]} and unwrap on parse.
  let groqPrompt = prompt;
  if (groqNeedsResultsWrapper) {
    groqPrompt += `\n\nGROQ NOTE: Your response must be a JSON object. Wrap the candidates array like this: {"results": [...]}`;
  }

  const text = await callGroq(groqPrompt);
  return { text, provider: "groq" };
}

// ─── Shared prompt fragments ──────────────────────────────────────────────────

const CV_SCHEMA = `{
  "first_name": "string",
  "last_name": "string",
  "full_name": "string",
  "email": "string",
  "phone": "string",
  "headline": "string",
  "bio": "string",
  "location": "City, Country",
  "current_role": "string",
  "current_company": "string",
  "experience_years": 0,
  "education_level": "Bachelor | Master | PhD | Associate | High School",
  "education_field": "string",
  "skills": [{ "name": "string", "level": "Expert | Advanced | Intermediate | Beginner", "yearsOfExperience": 0 }],
  "languages": [{ "name": "string", "proficiency": "Native | Fluent | Professional | Conversational | Basic" }],
  "experience": [{
    "company": "string",
    "role": "string",
    "startDate": "YYYY-MM",
    "endDate": "YYYY-MM or Present",
    "description": "string",
    "technologies": ["string"],
    "isCurrent": false
  }],
  "education": [{
    "institution": "string",
    "degree": "string",
    "fieldOfStudy": "string",
    "startYear": 0,
    "endYear": 0
  }],
  "certifications": [{ "name": "string", "issuer": "string", "issueDate": "YYYY-MM" }],
  "projects": [{ "name": "string", "description": "string", "technologies": ["string"], "role": "string", "link": "string" }],
  "availability": { "status": "Available | Not Available | Open to Opportunities", "type": "Full-time | Part-time | Contract | Freelance" },
  "socialLinks": { "linkedin": "string", "github": "string", "portfolio": "string", "website": "string" },
  "portfolio_url": "string"
}`;

const CV_FIELD_RULES = `
NAME: Extract first_name, last_name, full_name. No name found → {"error":"not_a_resume"}.
EMAIL/PHONE: Email → lowercase. Phone → preserve country code. Absent → omit.
LOCATION: "City, Country". City only if country absent. Unclear → omit.
HEADLINE: Only if role + skill both exist. Format: "[Seniority] [Role] specializing in [Skill1] and [Skill2]".
BIO: Only with ≥3 distinct facts. Exactly 2 factual sentences. No opinions or filler. Fewer facts → omit.
EXPERIENCE_YEARS: Sum non-overlapping date ranges. Round to 0.5. No dates anywhere → omit.
SKILLS: Only explicitly named tools/languages/frameworks. Level rules (use lowest that fits):
  "Expert" → explicitly stated, or 5+ yrs for that skill.
  "Advanced" → 3–5 yrs or senior context tied to that skill.
  "Intermediate" → 1–3 yrs or regular use in a role.
  "Beginner" → learning/trainee/exposure/<1 yr.
  OMIT level → zero evidence. Do NOT default to Intermediate.
  yearsOfExperience → only if explicitly stated for that exact skill.
EXPERIENCE ENTRIES: Minimum company OR role. startDate/endDate → "YYYY-MM" or "Present". Missing → omit that date.
  description → real descriptive text only, not a paraphrase of the title.
  technologies → only items explicitly named in that specific job entry.
EDUCATION: Degree normalisation: PhD/Doctorate→"PhD" | Master/MSc/MBA/MEng→"Master" | Bachelor/BSc/BA/BEng→"Bachelor" | Associate→"Associate" | Diploma/HND/High School→"High School". education_level = highest degree found.
CERTIFICATIONS/PROJECTS: Only explicitly named. Projects: include link only if URL literally appears in text.
SOCIAL LINKS: Only URLs literally in the text. Never construct from person's name.
AVAILABILITY: Default {"status":"Available","type":"Full-time"} unless text contradicts it.
`.trim();

// ─── 1. extractCV ─────────────────────────────────────────────────────────────

/**
 * Structures raw resume text (from a parser) into the ExtractedCV schema.
 * Returns { error: "not_a_resume" } if the text is not a resume.
 */
export async function extractCV(text: string): Promise<ExtractedCV> {
  const prompt = `
You are a senior HR data engineer. Extract structured JSON data from resume text.
Never invent, embellish, or pad. Omit fields when data is absent.

STEP 1 — IS THIS A RESUME?
Does the text belong to a specific person and describe their professional history?
NOT a resume: navigation-heavy pages, articles, job descriptions, LinkedIn feeds, or no personal info.
If NOT a resume → return exactly: {"error":"not_a_resume"}
If unsure → return {"error":"not_a_resume"} — rejecting is safer than hallucinating.

STEP 2 — HARD RULES
R1. Return ONLY a raw JSON object. No markdown, no backticks, no prose.
R2. Omit any field with no real data. Never use null, "", "N/A", "Unknown", or placeholders.
R3. Never invent, assume, or infer anything not explicitly written.
R4. Illegible or garbled section → omit entirely.

STEP 3 — FIELD RULES
${CV_FIELD_RULES}

STEP 4 — OUTPUT SCHEMA (omit keys with no real data)
${CV_SCHEMA}

RESUME TEXT:
${text.slice(0, 12000)}
`.trim();

  const { text: raw, provider } = await callWithFallback(prompt, "extractCV", false);
  const clean = extractJSON(raw);
  try {
    const result = JSON.parse(clean) as ExtractedCV;
    logger.info(`[gem-groq] extractCV complete via ${provider}`);
    return result;
  } catch (err) {
    logger.error(`[gem-groq][${provider}] extractCV parse failed:`, clean.slice(0, 500));
    throw new Error("AI returned malformed JSON during CV extraction");
  }
}

// ─── 2. validateCV ────────────────────────────────────────────────────────────

/**
 * Fact-checks a structured ExtractedCV object for implausible, inconsistent,
 * or suspicious data. Runs AFTER extractCV (or after manual parsers).
 */
export async function validateCV(parsed: ExtractedCV): Promise<CVValidationResult> {
  if (parsed.error === "not_a_resume") {
    return {
      is_valid: false,
      confidence: "Low",
      flags: [{ field: "root", issue: "missing_critical", detail: "Document was rejected as not a resume." }],
      overall_note: "Document is not a resume.",
    };
  }

  const prompt = `
You are a senior recruitment auditor. You are given a structured CV object (already parsed).
Your job: fact-check it for red flags. Return a JSON validation report.

CHECK FOR:
- Implausible values (e.g. experience_years: 40 for someone who graduated in 2020)
- Internal inconsistencies (endYear before startYear, current role listed as ended)
- Suspicious skill inflation (15 Expert-level skills with only 2 years total experience)
- Missing critical fields (no name + no skills + no experience = useless record)
- Date logic errors (overlapping roles summing to more years than career span)
- Skill level vs experience_years mismatch (Expert in React with 6 months total experience)

RULES:
- Only flag genuine problems. Do NOT flag stylistic choices or optional missing fields.
- A sparse CV (3 skills, 1 job) may be valid for a junior — only flag if something is actively wrong.
- is_valid = false ONLY for dealbreaker flags (impossible dates, no identity info, fabrication evidence).
- confidence reflects overall completeness and credibility, NOT match quality.
- Empty flags array [] if no issues found.

PARSED CV:
${JSON.stringify(parsed, null, 2).slice(0, 8000)}

Return ONLY this JSON structure (no prose, no markdown):
{
  "is_valid": true,
  "confidence": "High | Medium | Low",
  "flags": [
    {
      "field": "string (e.g. experience_years, skills[2].level)",
      "issue": "implausible | inconsistent | suspicious | missing_critical",
      "detail": "Specific human-readable explanation"
    }
  ],
  "overall_note": "One sentence summary of the CV's credibility"
}
`.trim();

  const { text: raw, provider } = await callWithFallback(prompt, "validateCV", false);
  const clean = extractJSON(raw);
  try {
    const result = JSON.parse(clean) as CVValidationResult;
    logger.info(`[gem-groq] validateCV complete via ${provider}`);
    return result;
  } catch (err) {
    logger.error(`[gem-groq] validateCV parse failed:`, clean.slice(0, 500));
    return {
      is_valid: true,
      confidence: "Low",
      flags: [{
        field: "validation",
        issue: "missing_critical",
        detail: "AI validation returned malformed output — manual review recommended.",
      }],
      overall_note: "Validation could not be completed. Treat result with caution.",
    };
  }
}

// ─── 3. readLink ──────────────────────────────────────────────────────────────

/**
 * Reads a resume from a URL (Google Drive, Google Docs, Dropbox, personal site, etc.)
 * and returns a structured ExtractedCV.
 *
 * ALWAYS uses Gemini — Groq/Llama cannot browse URLs.
 * If Gemini is unavailable, this throws rather than silently returning garbage.
 *
 * For Google Drive: ensure the document is set to "Anyone with the link can view".
 */
export async function readLink(url: string): Promise<ExtractedCV> {
  if (!process.env.GEMINI_API_KEY) {
    logger.error("[gem-groq] readLink requires GEMINI_API_KEY — Groq cannot browse URLs");
    throw new Error("Link-based CV reading requires Gemini. Set GEMINI_API_KEY in your .env.");
  }

  const prompt = `
You are a senior HR data engineer. A candidate has submitted the following URL as their resume:
${url}

Your task:
1. Access the content at this URL.
2. Determine if it is a resume or CV belonging to a specific person.
3. If it is a resume → extract and return structured data following the rules below.
4. If it is NOT a resume (broken link, login wall, job description, article, etc.) → return {"error":"not_a_resume"}.

HARD RULES
R1. Return ONLY a raw JSON object. No markdown, no backticks, no prose.
R2. Omit any field with no real data. Never use null, "", "N/A", "Unknown".
R3. Never invent, assume, or infer anything not in the document.
R4. If the link requires a login or is inaccessible → {"error":"not_a_resume"}.

FIELD RULES
${CV_FIELD_RULES}

OUTPUT SCHEMA (omit keys with no real data)
${CV_SCHEMA}
`.trim();

  // readLink always goes to Gemini directly — no fallback to Groq
  const raw = await callGemini(prompt);
  const clean = extractJSON(raw);
  try {
    const result = JSON.parse(clean) as ExtractedCV;
    logger.info(`[gem-groq] readLink complete via Gemini for: ${url.slice(0, 80)}`);
    return result;
  } catch (err) {
    logger.error("[gem-groq] readLink parse failed:", clean.slice(0, 500));
    throw new Error("AI returned malformed JSON while reading resume link");
  }
}

// ─── 4. screenAI ──────────────────────────────────────────────────────────────

/**
 * Ranks and scores a list of candidates against a job spec.
 * Returns results sorted by rank (1 = best match).
 */
export async function screenAI(
  job: {
    _id: string;
    title: string;
    description: string;
    required_skills: string[];
    preferred_skills: string[];
    experience_level: string;
    employment_type: string;
    department: string;
  },
  applicants: Array<any>,
  weights: ScreeningWeights,
  shortlistSize?: number
): Promise<ScreeningResultAI[]> {
  if (applicants.length === 0) return [];

  const total = weights.skills + weights.experience + weights.education + weights.relevance;
  const w = {
    skills:     Math.round((weights.skills / total) * 100),
    experience: Math.round((weights.experience / total) * 100),
    education:  Math.round((weights.education / total) * 100),
    relevance:  Math.round((weights.relevance / total) * 100),
  };

  const limitInstruction = shortlistSize
    ? `IMPORTANT: Evaluate ALL ${applicants.length} candidate(s), but return ONLY the top ${shortlistSize} in the results array, ranked by match_score descending.`
    : `Evaluate and return results for all ${applicants.length} candidate(s).`;

  const candidateSummaries = applicants.map((a) => {
    const skillNames = (a.skills ?? [])
      .map((s: any) =>
        typeof s === "string"
          ? s
          : `${s.name}${s.level ? ` (${s.level})` : ""}${s.yearsOfExperience ? ` ${s.yearsOfExperience}yr` : ""}`
      )
      .join(", ");

    const expSummary = (a.experience ?? [])
      .slice(0, 5)
      .map((e: any) =>
        `${e.role} @ ${e.company} [${e.startDate ?? "?"}–${e.endDate ?? "Present"}]` +
        `${e.technologies?.length ? ` | Tech: ${e.technologies.slice(0, 5).join(", ")}` : ""}` +
        `${e.description ? ` | ${e.description.slice(0, 120)}` : ""}`
      )
      .join("\n      ");

    const eduSummary = (a.education ?? [])
      .map((e: any) =>
        `${e.degree}${e.fieldOfStudy ? ` in ${e.fieldOfStudy}` : ""} @ ${e.institution}` +
        `${e.endYear ? ` (${e.endYear})` : ""}`
      )
      .join("; ");

    const certSummary = (a.certifications ?? []).map((c: any) => c.name).join(", ");

    const projSummary = (a.projects ?? [])
      .slice(0, 3)
      .map((p: any) =>
        `${p.name}${p.technologies?.length ? ` [${p.technologies.slice(0, 4).join(", ")}]` : ""}` +
        `${p.description ? `: ${p.description.slice(0, 80)}` : ""}`
      )
      .join(" | ");

    const langSummary = (a.languages ?? [])
      .map((l: any) => `${l.name} (${l.proficiency})`)
      .join(", ");

    return `
CANDIDATE_ID: ${a._id}
Name: ${a.full_name ?? "Unknown"} | Headline: ${a.headline ?? "—"}
Location: ${a.location ?? "—"} | Availability: ${a.availability?.status ?? "Unknown"} ${a.availability?.type ?? ""}
Total Experience: ${a.experience_years ?? "?"} yrs | Education Level: ${a.education_level ?? "—"}
Skills: ${skillNames || "—"}
Work History:
  ${expSummary || "—"}
Education: ${eduSummary || "—"}
Certifications: ${certSummary || "—"}
Projects: ${projSummary || "—"}
Languages: ${langSummary || "—"}`.trim();
  }).join("\n\n---\n\n");

  const prompt = `
You are TalentScreen's AI talent evaluator — objective, evidence-based, no biases.
Evaluate candidates strictly on merit. Do not award points for absent data.

${limitInstruction}

══════════════════════════════════════════════
JOB SPECIFICATION
══════════════════════════════════════════════
Title:            ${job.title}
Department:       ${job.department}
Type:             ${job.employment_type}
Level:            ${job.experience_level}
Required Skills:  ${job.required_skills.join(", ") || "None specified"}
Preferred Skills: ${job.preferred_skills.join(", ") || "None specified"}
Description:
${job.description.slice(0, 2000)}

══════════════════════════════════════════════
SCORING SYSTEM
══════════════════════════════════════════════
match_score = (skills_score × ${w.skills} + experience_score × ${w.experience} + education_score × ${w.education} + relevance_score × ${w.relevance}) / 100
Round to nearest integer.

SKILLS (${w.skills}%): 100=all required+most preferred | 80=all required | 60=missing 1–2 minor | 40=adjacent | 20=few | 0=none or absent section.
EXPERIENCE (${w.experience}%): 100=direct role match exact seniority | 80=highly relevant | 60=adjacent/off-level | 40=transferable | 20=minimal | 0=irrelevant or absent.
EDUCATION (${w.education}%): 100=exact degree+field | 80=correct level adj field | 60=different level+strong exp | 40=unrelated | 0=no data.
RELEVANCE (${w.relevance}%): 100=ideal fit zero ramp-up | 80=strong minor gaps | 60=reasonable 1–2 misalignments | 40=needs onboarding | 0=poor fit.

══════════════════════════════════════════════
OUTPUT RULES
══════════════════════════════════════════════
1. Return a JSON object with key "results" containing the ranked array.
2. applicant_id MUST exactly match the CANDIDATE_ID — do not alter it.
3. Rank starts at 1 (best match). No ties.
4. strengths: evidence-only. Name specific skills/roles/tools. Sparse → max 1 strength or ["Insufficient profile data"].
   NEVER: "good communicator", "team player", "passionate", or traits not backed by data.
5. gaps: specific. "Missing Python experience" ✓ | "Lacks technical skills" ✗.
   "dealbreaker" = explicitly required + cannot be quickly learned.
   "nice-to-have" = preferred or minor misalignment.
6. confidence_level (data quality, NOT match quality):
   "High" = skills + ≥2 experience entries with descriptions + education
   "Medium" = missing one major section
   "Low" = sparse (<3 skills, no experience detail) → add gap: {"description":"Sparse profile — recommend manual review","type":"nice-to-have"}
7. recommendation: "Strong Yes"(≥82+no dealbreaker+High/Medium) | "Yes"(≥68+no dealbreaker) | "Maybe"(≥50 or Low conf) | "No"(<50 or dealbreaker).
8. bias_flags: flag non-merit scoring influences. [] if none.

REQUIRED FORMAT:
{
  "results": [
    {
      "applicant_id": "<exact CANDIDATE_ID>",
      "applicant_name": "string",
      "rank": 1,
      "match_score": 0,
      "skills_score": 0,
      "experience_score": 0,
      "education_score": 0,
      "relevance_score": 0,
      "confidence_level": "High",
      "recommendation": "Yes",
      "strengths": ["evidence-backed strength"],
      "gaps": [{ "description": "specific gap", "type": "nice-to-have" }],
      "bias_flags": []
    }
  ]
}

══════════════════════════════════════════════
CANDIDATES TO EVALUATE
══════════════════════════════════════════════
${candidateSummaries}
`.trim();

  const { text: raw, provider } = await callWithFallback(prompt, `screenAI(${job.title})`, true);
  const clean = extractJSON(raw);

  try {
    const parsed = JSON.parse(clean);
    const results: ScreeningResultAI[] = Array.isArray(parsed)
      ? parsed
      : (parsed.results ?? []);

    if (!Array.isArray(results)) throw new Error("Screening response is not an array");

    const finalResults = shortlistSize ? results.slice(0, shortlistSize) : results;
    logger.info(`[gem-groq] screenAI complete via ${provider} — evaluated ${applicants.length}, returning ${finalResults.length}`);
    return finalResults;
  } catch (err) {
    logger.error(`[gem-groq] screenAI parse failed:`, clean.slice(0, 500));
    throw new Error("AI returned malformed JSON during screening");
  }
}
