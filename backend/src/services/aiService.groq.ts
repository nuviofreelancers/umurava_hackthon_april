/**
 * aiService.groq.ts — Groq-only AI service (drop-in replacement for aiService.ts)
 *
 * WHY GROQ:
 *   - Free tier: 14,400 requests/day, 500k tokens/day on llama-3.3-70b
 *   - Response time: ~300ms (significantly faster than Gemini on free tier)
 *   - No 503/429 overload errors typical of Gemini free tier
 *   - 100% OpenAI-compatible API
 *
 * SETUP:
 *   1. Go to https://console.groq.com → sign in → API Keys → Create API Key
 *   2. Add to your .env: GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
 *   3. Swap this file in as aiService.ts — nothing else changes
 *
 * MODEL OPTIONS (all free):
 *   - "llama-3.3-70b-versatile"  ← best quality (default)
 *   - "llama-3.1-8b-instant"     ← fastest, lower quality
 *   - "mixtral-8x7b-32768"       ← good for long context
 *
 * Responsibilities:
 *   1. extractCV(text)   — Structure raw resume text into the ExtractedCV schema
 *   2. validateCV(parsed) — Fact-check a parsed CV for red flags
 *   3. readLink(url)     — Fetch & extract a CV from a URL (best-effort; Groq is text-only)
 *   4. screenAI(...)     — Rank and score candidates against a job spec
 */

import logger from "../utils/logger";

// ─── Config ───────────────────────────────────────────────────────────────────

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 3000, 8000];

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

function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/im, "").replace(/\s*```$/im, "").trim();
}

function extractJSON(text: string): string {
  const stripped = stripCodeFences(text);
  const match = stripped.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  return match ? match[0].trim() : stripped;
}

// ─── Groq API caller ──────────────────────────────────────────────────────────

async function callGroq(prompt: string, forceJsonObject = true): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set in environment");

  let lastError: Error = new Error("Groq call failed after all retries");

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS_MS[attempt - 1] ?? 10000;
      logger.warn(`[Groq] retry ${attempt}/${MAX_RETRIES} — waiting ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }

    let res: Response;
    try {
      const body: Record<string, unknown> = {
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 8192,
      };
      // json_object mode forces valid JSON — use for all structured calls
      if (forceJsonObject) {
        body.response_format = { type: "json_object" };
      }

      res = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (networkErr) {
      lastError = networkErr instanceof Error ? networkErr : new Error(String(networkErr));
      logger.warn(`[Groq] network error on attempt ${attempt + 1}: ${lastError.message}`);
      continue;
    }

    if (res.status === 429 || res.status === 503) {
      lastError = new Error(`Groq ${res.status} — rate limited`);
      logger.warn(`[Groq] ${res.status} on attempt ${attempt + 1}/${MAX_RETRIES + 1}`);
      continue;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Groq API error ${res.status}: ${body}`);
    }

    const data = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const text = data.choices?.[0]?.message?.content ?? "";
    if (!text) throw new Error("Groq returned empty response");

    logger.info(`[Groq] success on attempt ${attempt + 1} — model: ${MODEL}`);
    return text;
  }

  logger.error(`[Groq] failed after ${MAX_RETRIES + 1} attempts: ${lastError.message}`);
  throw lastError;
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
BIO: Only with ≥3 distinct facts. Exactly 2 factual sentences. No opinions or filler words. Fewer facts → omit.
EXPERIENCE_YEARS: Sum non-overlapping date ranges. Round to 0.5. No dates anywhere → omit.
SKILLS: Only explicitly named tools/languages/frameworks. Level rules (use lowest that fits):
  "Expert" → explicitly stated, or 5+ yrs for that skill.
  "Advanced" → 3–5 yrs or senior context for that skill.
  "Intermediate" → 1–3 yrs or regular use in a role.
  "Beginner" → learning/trainee/exposure/<1 yr.
  OMIT level → zero evidence. Do NOT default to Intermediate.
  yearsOfExperience → only if explicitly stated for that exact skill.
EXPERIENCE ENTRIES: Minimum company OR role. startDate/endDate → "YYYY-MM" or "Present". Missing → omit that date.
  description → real text only, not a paraphrase of the title.
  technologies → only items named in that specific job entry.
EDUCATION: Degree normalisation: PhD/Doctorate→"PhD" | Master/MSc/MBA/MEng→"Master" | Bachelor/BSc/BA/BEng→"Bachelor" | Associate→"Associate" | Diploma/HND/High School→"High School". education_level = highest degree found.
CERTIFICATIONS/PROJECTS: Only explicitly named. Projects: include link only if URL appears in text.
SOCIAL LINKS: Only URLs literally in the text. Never construct from person's name.
AVAILABILITY: Default {"status":"Available","type":"Full-time"} unless text contradicts it.
`.trim();

// ─── 1. extractCV ─────────────────────────────────────────────────────────────

/**
 * Structures raw resume text (from a parser) into the ExtractedCV schema.
 * Returns { error: "not_a_resume" } if the text is not a resume.
 *
 * NOTE: Groq's json_object mode requires the prompt to mention "JSON" — it does.
 * The response will always be valid JSON, so parse failures here are genuinely malformed.
 */
export async function extractCV(text: string): Promise<ExtractedCV> {
  const prompt = `
You are a senior HR data engineer. Extract structured JSON data from resume text.
Never invent, embellish, or pad. Omit fields when data is absent.

STEP 1 — IS THIS A RESUME?
Does the text belong to a specific person and describe their professional history?
NOT a resume: navigation-heavy webpages, articles, job descriptions, LinkedIn feeds, or no personal info.
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

  const raw = await callGroq(prompt, true);
  const clean = extractJSON(raw);
  try {
    return JSON.parse(clean) as ExtractedCV;
  } catch (err) {
    logger.error("[Groq] extractCV parse failed:", clean.slice(0, 500));
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

Return ONLY this JSON structure:
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

  const raw = await callGroq(prompt, true);
  const clean = extractJSON(raw);
  try {
    return JSON.parse(clean) as CVValidationResult;
  } catch (err) {
    logger.error("[Groq] validateCV parse failed:", clean.slice(0, 500));
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
 * Attempts to handle a resume submitted as a URL.
 *
 * ⚠ GROQ LIMITATION: Groq/Llama cannot browse URLs or access Google Drive.
 *   This function exists for API compatibility with aiService.ts (Gemini).
 *   It will always return { error: "not_a_resume" } since Groq is text-only.
 *
 *   For link-based CV reading, use aiService.ts (Gemini) or aiService.gem-groq.ts
 *   which falls back to Gemini for link handling.
 */
export async function readLink(_url: string): Promise<ExtractedCV> {
  logger.warn("[Groq] readLink called — Groq cannot access URLs. Returning not_a_resume.");
  logger.warn("[Groq] Switch to aiService.ts (Gemini) or aiService.gem-groq.ts for link support.");
  return { error: "not_a_resume" };
}

// ─── 4. screenAI ──────────────────────────────────────────────────────────────

/**
 * Ranks and scores a list of candidates against a job spec.
 * Returns results sorted by rank (1 = best match).
 *
 * NOTE: Groq's json_object mode requires a top-level object, so we ask for
 * {"results": [...]} and unwrap it — same as the Gemini version.
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
  applicants: Array<{
    _id: string;
    full_name: string;
    headline?: string;
    skills?: Array<{ name: string; level?: string; yearsOfExperience?: number } | string>;
    experience?: Array<{
      company: string;
      role: string;
      startDate?: string;
      endDate?: string;
      description?: string;
      technologies?: string[];
    }>;
    education?: Array<{
      institution: string;
      degree: string;
      fieldOfStudy?: string;
      endYear?: number;
    }>;
    experience_years?: number;
    education_level?: string;
    certifications?: Array<{ name: string; issuer?: string }>;
    projects?: Array<{ name: string; description?: string; technologies?: string[] }>;
    languages?: Array<{ name: string; proficiency?: string }>;
    location?: string;
    availability?: { status?: string; type?: string };
  }>,
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
      .map((s) =>
        typeof s === "string"
          ? s
          : `${s.name}${s.level ? ` (${s.level})` : ""}${s.yearsOfExperience ? ` ${s.yearsOfExperience}yr` : ""}`
      )
      .join(", ");

    const expSummary = (a.experience ?? [])
      .slice(0, 5)
      .map((e) =>
        `${e.role} @ ${e.company} [${e.startDate ?? "?"}–${e.endDate ?? "Present"}]` +
        `${e.technologies?.length ? ` | Tech: ${e.technologies.slice(0, 5).join(", ")}` : ""}` +
        `${e.description ? ` | ${e.description.slice(0, 120)}` : ""}`
      )
      .join("\n  ");

    const eduSummary = (a.education ?? [])
      .map((e) =>
        `${e.degree}${e.fieldOfStudy ? ` in ${e.fieldOfStudy}` : ""} @ ${e.institution}` +
        `${e.endYear ? ` (${e.endYear})` : ""}`
      )
      .join("; ");

    const certSummary = (a.certifications ?? []).map((c) => c.name).join(", ");

    const projSummary = (a.projects ?? [])
      .slice(0, 3)
      .map((p) =>
        `${p.name}${p.technologies?.length ? ` [${p.technologies.slice(0, 4).join(", ")}]` : ""}` +
        `${p.description ? `: ${p.description.slice(0, 80)}` : ""}`
      )
      .join(" | ");

    const langSummary = (a.languages ?? [])
      .map((l) => `${l.name} (${l.proficiency})`)
      .join(", ");

    return `
CANDIDATE_ID: ${a._id}
Name: ${a.full_name} | Headline: ${a.headline ?? "—"}
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

SKILLS (${w.skills}%): 100=all required+most preferred | 80=all required | 60=missing 1–2 minor | 40=adjacent | 20=few | 0=none. Absent section → 0.
EXPERIENCE (${w.experience}%): 100=direct role match exact seniority | 80=highly relevant | 60=adjacent/off-level | 40=transferable | 20=minimal | 0=irrelevant. Absent → 0.
EDUCATION (${w.education}%): 100=exact degree+field | 80=correct level adj field | 60=different level+strong exp | 40=unrelated | 0=no data. Absent → 0.
RELEVANCE (${w.relevance}%): 100=ideal fit zero ramp-up | 80=strong minor gaps | 60=reasonable 1–2 misalignments | 40=needs onboarding | 0=poor fit.

══════════════════════════════════════════════
OUTPUT RULES
══════════════════════════════════════════════
1. Return a JSON object: {"results": [...]} — Groq requires a top-level object.
2. applicant_id MUST exactly match the CANDIDATE_ID — do not alter it.
3. Rank starts at 1. No ties.
4. strengths: evidence-only. Name specific skills/roles/tools. Sparse profile → max 1 or ["Insufficient profile data"].
   NEVER: "good communicator", "team player", "passionate", or any untested trait.
5. gaps: specific. "Missing Python" ✓ | "Lacks technical skills" ✗.
   type "dealbreaker" = explicitly required + cannot be quickly learned.
   type "nice-to-have" = preferred or minor misalignment.
6. confidence_level (data quality, not match quality):
   "High" = skills + ≥2 experience entries with descriptions + education
   "Medium" = missing one major section
   "Low" = sparse (<3 skills, no experience detail) → add gap: {"description":"Sparse profile — recommend manual review","type":"nice-to-have"}
7. recommendation: "Strong Yes"(≥82+no dealbreaker+High/Medium) | "Yes"(≥68+no dealbreaker) | "Maybe"(≥50 or Low conf) | "No"(<50 or dealbreaker).
8. bias_flags: flag non-merit scoring influences. [] if none.

REQUIRED FORMAT:
{"results": [{"applicant_id":"<exact CANDIDATE_ID>","applicant_name":"string","rank":1,"match_score":0,"skills_score":0,"experience_score":0,"education_score":0,"relevance_score":0,"confidence_level":"High","recommendation":"Yes","strengths":["evidence-backed strength"],"gaps":[{"description":"specific gap","type":"nice-to-have"}],"bias_flags":[]}]}

══════════════════════════════════════════════
CANDIDATES TO EVALUATE
══════════════════════════════════════════════
${candidateSummaries}
`.trim();

  const raw = await callGroq(prompt, true);
  const clean = extractJSON(raw);
  try {
    const parsed = JSON.parse(clean) as { results?: ScreeningResultAI[] } | ScreeningResultAI[];
    const results: ScreeningResultAI[] = Array.isArray(parsed)
      ? parsed
      : ((parsed as any).results ?? []);

    if (!Array.isArray(results)) throw new Error("Screening response is not an array");

    const finalResults = shortlistSize ? results.slice(0, shortlistSize) : results;
    logger.info(`[Groq] screenAI complete — evaluated ${applicants.length}, returning ${finalResults.length} for "${job.title}"`);
    return finalResults;
  } catch (err) {
    logger.error("[Groq] screenAI parse failed:", clean.slice(0, 500));
    throw new Error("AI returned malformed JSON during screening");
  }
}
