/**
 * aiService.ts — Gemini-only AI service
 *
 * Responsibilities:
 *   1. extractCV(text)      — Structure raw resume text into the ExtractedCV schema
 *   2. validateCV(parsed)   — Fact-check an already-parsed CV object for red flags
 *   3. readLink(url)        — Fetch & extract a CV from a Google Drive / Docs / any URL
 *   4. screenAI(...)        — Rank and score candidates against a job spec
 *
 * Pipeline for file uploads:  parser → extractCV() → validateCV()
 * Pipeline for link uploads:  readLink() [fetches + extracts in one shot] → validateCV()
 */

import logger from "../utils/logger";

// ─── Config ───────────────────────────────────────────────────────────────────

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// 1 initial attempt + up to 4 retries = 5 total
const MAX_RETRIES = 4;
const RETRY_DELAYS_MS = [3000, 8000, 15000, 25000];

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

/**
 * Pulls the top-level JSON object or array out of a string.
 * Prefers objects over arrays (screenAI returns { "results": [...] }).
 * Handles prose preambles and markdown fences from the model.
 */
function extractJSON(text: string): string {
  // Strip markdown fences (handles ```json ... ``` and ``` ... ```)
  const stripped = text
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/\s*```$/im, "")
    .trim();

  const objMatch = stripped.match(/\{[\s\S]*\}/);
  const arrMatch = stripped.match(/\[[\s\S]*\]/);

  if (objMatch && arrMatch) {
    // Return whichever container starts earlier in the string (the outer one)
    return (objMatch.index! <= arrMatch.index! ? objMatch[0] : arrMatch[0]).trim();
  }
  return (objMatch?.[0] ?? arrMatch?.[0] ?? stripped).trim();
}

// ─── Gemini API caller ────────────────────────────────────────────────────────

async function callGemini(prompt: string, maxTokens = 8192): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in environment");

  let lastError: Error = new Error("Gemini call failed after all retries");

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS_MS[attempt - 1] ?? 30000;
      logger.warn(`[Gemini] retry ${attempt}/${MAX_RETRIES} — waiting ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }

    let res: Response;
    try {
      res = await fetch(
        `${GEMINI_API_URL}/${MODEL}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: maxTokens,
              responseMimeType: "application/json",
            },
            safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
            ],
          }),
        }
      );
    } catch (networkErr) {
      lastError = networkErr instanceof Error ? networkErr : new Error(String(networkErr));
      logger.warn(`[Gemini] network error on attempt ${attempt + 1}: ${lastError.message}`);
      continue;
    }

    if (res.status === 503 || res.status === 429) {
      lastError = new Error(`Gemini ${res.status} — service overloaded or rate-limited`);
      logger.warn(`[Gemini] ${res.status} on attempt ${attempt + 1}/${MAX_RETRIES + 1}`);
      continue;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Gemini API error ${res.status}: ${body}`);
    }

    const data = await res.json() as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!text) throw new Error("Gemini returned an empty response body");

    logger.info(`[Gemini] success on attempt ${attempt + 1}`);
    return text;
  }

  logger.error(`[Gemini] failed after ${MAX_RETRIES + 1} attempts: ${lastError.message}`);
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
FIELD-BY-FIELD RULES (read carefully — every rule is enforced):

NAME
- Extract first_name, last_name, full_name separately.
- If no clear human name exists → {"error":"not_a_resume"}.

EMAIL / PHONE
- Email → lowercase. Phone → preserve country code if present.
- Absent → omit entirely. Never fabricate.

LOCATION — format: "City, Country". City only if country is absent. Omit if unclear.

HEADLINE
- Only generate if you have at least a role AND one skill to reference.
- Format: "[Seniority] [Role] specializing in [Skill1] and [Skill2]"
- Sparse profile → omit.

BIO
- Requires at minimum 3 distinct verifiable facts (role + skills + exp length OR education).
- Exactly 2 sentences. Factual only — no "passionate", "dynamic", "results-driven".
- Fewer than 3 facts → omit entirely.

EXPERIENCE_YEARS
- Sum non-overlapping date ranges from the experience array. Round to nearest 0.5.
- No dates anywhere in the resume → omit entirely. Do NOT estimate.

SKILLS
- Extract only skills explicitly named in the text (tools, languages, frameworks, methodologies).
- Do NOT infer skills from job titles or company names alone.
- Level rules (use the LOWEST that fits the evidence):
    "Expert"       → explicitly called expert/lead/architect, OR 5+ years stated for that skill
    "Advanced"     → 3–5 years stated, OR senior-level role context clearly tied to that skill
    "Intermediate" → 1–3 years stated, OR clearly used regularly in a described role
    "Beginner"     → learning/trainee/exposure/< 1 year mentioned
    OMIT level     → zero evidence of proficiency — do NOT default to Intermediate
- yearsOfExperience: only if a specific number is stated for that exact skill. Omit otherwise.

EXPERIENCE ENTRIES
- Minimum: company name OR role title must be present.
- startDate / endDate: format "YYYY-MM". Use "Present" for current role. Missing date → omit that field, never guess.
- description: only real descriptive text from the resume — do NOT summarise the title.
- technologies: only items explicitly named in that specific job entry.

EDUCATION
- Minimum: institution name OR degree name.
- Degree normalisation: PhD/Doctorate→"PhD" | Master/MSc/MBA/MEng→"Master" | Bachelor/BSc/BA/BEng→"Bachelor" | Associate→"Associate" | Diploma/HND/High School/Secondary→"High School"
- startYear / endYear: only explicit year numbers. Never infer.
- education_level: pick the highest degree level found.

CERTIFICATIONS / PROJECTS
- Only explicitly named. Do not infer from skills or experience descriptions.
- Projects: include link only if a URL literally appears in the text.

SOCIAL LINKS / PORTFOLIO
- Only URLs literally present in the text. Never construct or guess from the person's name.

AVAILABILITY
- Default to { "status": "Available", "type": "Full-time" } ONLY if nothing contradicts it.
- "not looking" / "currently employed, not seeking" → "Not Available".
`.trim();

// ─── 1. extractCV ─────────────────────────────────────────────────────────────

/**
 * Structures raw resume text (from a parser) into the ExtractedCV schema.
 * Returns { error: "not_a_resume" } if the text is not a resume.
 */
export async function extractCV(text: string): Promise<ExtractedCV> {
  const prompt = `
You are a senior HR data engineer. Your sole task: extract structured data from resume text.
You never invent, embellish, or pad. When data is absent, you omit the field — silence over noise.

══════════════════════════════════════════════
STEP 1 — IS THIS A RESUME?
══════════════════════════════════════════════
Ask: does this text belong to a specific person and describe their professional history?

NOT a resume if: navigation links dominate, it's a news article, a job description,
a LinkedIn feed, random scraped web content, or there is no personal info.

If NOT a resume → output exactly this JSON and nothing else:
{"error":"not_a_resume"}

If you are unsure → output {"error":"not_a_resume"}. Rejecting is safer than hallucinating.

══════════════════════════════════════════════
STEP 2 — HARD RULES (override everything else)
══════════════════════════════════════════════
R1. Output ONLY raw JSON. No markdown, no backticks, no prose, no explanations.
R2. Omit any field you have no real data for. Never use null, "", "N/A", "Unknown", or placeholders.
R3. Never invent, assume, or infer anything not explicitly written in the text.
R4. Illegible or garbled section → omit that entire section.

══════════════════════════════════════════════
STEP 3 — FIELD RULES
══════════════════════════════════════════════
${CV_FIELD_RULES}

══════════════════════════════════════════════
STEP 4 — OUTPUT SCHEMA (omit keys with no real data)
══════════════════════════════════════════════
${CV_SCHEMA}

══════════════════════════════════════════════
RESUME TEXT
══════════════════════════════════════════════
${text.slice(0, 12000)}
`.trim();

  const raw = await callGemini(prompt);
  const clean = extractJSON(raw);
  try {
    return JSON.parse(clean) as ExtractedCV;
  } catch (err) {
    logger.error("[Gemini] extractCV parse failed:", clean.slice(0, 500));
    throw new Error("AI returned malformed JSON during CV extraction");
  }
}

// ─── 2. validateCV ────────────────────────────────────────────────────────────

/**
 * Fact-checks a structured ExtractedCV object for implausible, inconsistent,
 * or suspicious data. Runs AFTER extractCV (or after manual parsers).
 *
 * Does NOT re-extract data — only audits what is already there.
 */
export async function validateCV(parsed: ExtractedCV): Promise<CVValidationResult> {
  // Skip validation if the CV was already rejected upstream
  if (parsed.error === "not_a_resume") {
    return {
      is_valid: false,
      confidence: "Low",
      flags: [{ field: "root", issue: "missing_critical", detail: "Document was rejected as not a resume." }],
      overall_note: "Document is not a resume.",
    };
  }

  const prompt = `
You are a senior recruitment auditor with expertise in detecting fraudulent or implausible CVs.
You are given a structured CV object (already parsed from a resume). Your job is to fact-check it.

You are NOT re-extracting data. You are auditing what is already there for:
  - Implausible values (e.g. experience_years: 40 for someone who graduated in 2020)
  - Internal inconsistencies (e.g. endYear before startYear, current role at a company listed as ended)
  - Suspicious inflation (e.g. 15 Expert-level skills with only 2 years total experience)
  - Missing critical fields (a CV with no name, no skills, and no experience is useless)
  - Date logic errors (overlapping roles that sum to more years than the person's career span)
  - Skill level vs experience_years mismatch (Expert in React with 6 months total experience is suspicious)

IMPORTANT RULES:
- Only flag genuine problems. Do NOT flag stylistic choices or optional missing fields.
- A CV with 3 skills and 1 job entry is sparse but may still be valid for a junior candidate — do not flag unless something is actively wrong.
- Be proportionate. A single suspicious skill level is a low-severity flag; a date that makes someone born before the internet "Expert" in React is high-severity.
- is_valid should be false ONLY if there are dealbreaker flags (e.g. no identity info at all, dates that are logically impossible, or evidence of fabrication).
- confidence reflects how complete and credible the profile is overall, NOT match quality.

PARSED CV:
${JSON.stringify(parsed, null, 2).slice(0, 8000)}

Return ONLY this JSON structure — no prose, no markdown, no backticks:
{
  "is_valid": true,
  "confidence": "High | Medium | Low",
  "flags": [
    {
      "field": "experience_years",
      "issue": "implausible | inconsistent | suspicious | missing_critical",
      "detail": "Specific human-readable explanation of what is wrong"
    }
  ],
  "overall_note": "One sentence summary of the CV's credibility"
}

If there are no issues: return flags as an empty array [] and is_valid as true.
`.trim();

  const raw = await callGemini(prompt);
  const clean = extractJSON(raw);
  try {
    return JSON.parse(clean) as CVValidationResult;
  } catch (err) {
    logger.error("[Gemini] validateCV parse failed:", clean.slice(0, 500));
    // Return a safe fallback — don't block the whole upload on a validation parse failure
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
 * This replaces the parser stage entirely for link-based uploads.
 * Gemini is instructed to first describe what it found at the URL,
 * then extract structured data if it is a resume.
 *
 * Note: Gemini cannot truly "browse" arbitrary URLs, but it handles
 * Google Drive share links and publicly accessible document URLs well
 * via its URL-context capability. For Drive links, ensure the document
 * is set to "Anyone with the link can view".
 */
export async function readLink(url: string): Promise<ExtractedCV> {
  const prompt = `
You are a senior HR data engineer. A candidate has submitted the following URL as their resume:
${url}

Your task:
1. Access the content at this URL.
2. Determine if it is a resume or CV belonging to a specific person.
3. If it is a resume → extract and return structured data following the rules below.
4. If it is NOT a resume (broken link, login wall, job description, article, etc.) → return {"error":"not_a_resume"}.

══════════════════════════════════════════════
HARD RULES
══════════════════════════════════════════════
R1. Output ONLY raw JSON. No markdown, no backticks, no prose.
R2. Omit any field you have no real data for. Never use null, "", "N/A", "Unknown".
R3. Never invent, assume, or infer anything not in the document.
R4. If the link requires a login or is inaccessible → {"error":"not_a_resume"}.

══════════════════════════════════════════════
FIELD RULES
══════════════════════════════════════════════
${CV_FIELD_RULES}

══════════════════════════════════════════════
OUTPUT SCHEMA (omit keys with no real data)
══════════════════════════════════════════════
${CV_SCHEMA}
`.trim();

  const raw = await callGemini(prompt);
  const clean = extractJSON(raw);
  try {
    return JSON.parse(clean) as ExtractedCV;
  } catch (err) {
    logger.error("[Gemini] readLink parse failed:", clean.slice(0, 500));
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

  // Normalise weights to sum to 100
  const total = weights.skills + weights.experience + weights.education + weights.relevance;
  const w = {
    skills:     Math.round((weights.skills / total) * 100),
    experience: Math.round((weights.experience / total) * 100),
    education:  Math.round((weights.education / total) * 100),
    relevance:  Math.round((weights.relevance / total) * 100),
  };

  const limitInstruction = shortlistSize
    ? `IMPORTANT: Evaluate ALL ${applicants.length} candidate(s), but return ONLY the top ${shortlistSize} in the final JSON array, ranked by match_score descending.`
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
You are TalentScreen's AI talent evaluator — an objective, evidence-based recruiter.
You evaluate candidates strictly on merit. You do not make assumptions. You do not award points for data that is not present.

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
Score each of the four dimensions 0–100 using the rubrics below.
Then compute:
  match_score = (skills_score × ${w.skills} + experience_score × ${w.experience} + education_score × ${w.education} + relevance_score × ${w.relevance}) / 100
Round match_score to nearest integer.

SKILLS (${w.skills}% weight)
  100 = All required skills present at Advanced/Expert + most preferred skills
  80  = All required skills present
  60  = Most required skills (missing 1–2 minor ones)
  40  = Partial — has transferable or adjacent skills
  20  = Few relevant skills
  0   = Missing all required skills
  ⚠ If skills section is entirely absent → skills_score: 0

EXPERIENCE (${w.experience}% weight)
  100 = Direct role match at exact seniority, measurable impact in descriptions
  80  = Highly relevant domain, appropriate years
  60  = Adjacent domain or slightly under/over-qualified
  40  = Transferable but significant domain gap
  20  = Very limited relevant experience
  0   = Irrelevant background or no experience data
  ⚠ If experience section is entirely absent → experience_score: 0

EDUCATION (${w.education}% weight)
  100 = Exact degree + field match for this role
  80  = Correct level, adjacent field
  60  = Different level but compensated by strong experience
  40  = Unrelated degree
  0   = No formal education data (strong experience CAN compensate — use judgment)
  ⚠ If education section is entirely absent → education_score: 0

RELEVANCE (${w.relevance}% weight)
  100 = Ideal domain/culture/location fit — zero ramp-up needed
  80  = Strong fit with minor gaps
  60  = Reasonable fit, 1–2 misalignments (location, availability, domain)
  40  = Needs significant onboarding
  0   = Poor overall fit

══════════════════════════════════════════════
OUTPUT RULES
══════════════════════════════════════════════
1. Return a JSON object with key "results" containing the ranked array.
2. applicant_id MUST exactly match the CANDIDATE_ID for each candidate — do not alter it.
3. Rank starts at 1 (best match). No two candidates share the same rank.

4. strengths — evidence-only rules:
   - Only cite strengths directly evidenced by profile data.
   - Name the specific skill, role, company, project, or tool you are referencing.
   - Sparse profile (< 3 skills, no experience detail) → maximum 1 strength, or use: ["Insufficient profile data to assess strengths"]
   - NEVER write: "good communicator", "team player", "fast learner", "passionate", or any trait not backed by data.

5. gaps — specificity rules:
   - Name the exact missing required skill or experience gap.
   - "Missing Python experience" ✓ | "Lacks technical skills" ✗
   - If experience_years is materially below the job level, note both the candidate's years and what the job implies.
   - type "dealbreaker" = explicitly required by the job spec and cannot be quickly learned.
   - type "nice-to-have" = preferred skill or minor misalignment.

6. confidence_level — reflects profile data quality, NOT match quality:
   "High"   = skills list + ≥ 2 experience entries with descriptions + education
   "Medium" = missing one major section (e.g. no experience descriptions, no education)
   "Low"    = sparse — fewer than 3 skills, no experience detail, or mostly blank
              → automatically add a gap: {"description": "Sparse profile — scores are estimates; recommend manual review", "type": "nice-to-have"}

7. recommendation thresholds:
   "Strong Yes" = match_score ≥ 82 AND no dealbreaker gaps AND confidence High or Medium
   "Yes"        = match_score ≥ 68 AND no dealbreaker gaps
   "Maybe"      = match_score ≥ 50 OR recoverable gaps OR confidence Low
   "No"         = match_score < 50 OR has dealbreaker gaps

8. bias_flags: flag any scoring influence from non-merit factors (gender-coded language, career gaps,
   institution prestige, non-English names, nationality, age signals). Empty array [] if none found.

REQUIRED JSON FORMAT:
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
      "strengths": ["specific, evidence-backed strength"],
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

  // screenAI responses can be large (many candidates × detailed output) — use a higher token budget
  const raw = await callGemini(prompt, 16384);
  const clean = extractJSON(raw);
  try {
    const parsed = JSON.parse(clean);
    const results: ScreeningResultAI[] = Array.isArray(parsed)
      ? parsed
      : (parsed.results ?? []);

    if (!Array.isArray(results)) throw new Error("Screening response is not an array");

    const finalResults = shortlistSize ? results.slice(0, shortlistSize) : results;
    logger.info(`[Gemini] screenAI complete — evaluated ${applicants.length}, returning ${finalResults.length}`);
    return finalResults;
  } catch (err) {
    logger.error("[Gemini] screenAI parse failed (first 2000 chars):", clean.slice(0, 2000));
    logger.error("[Gemini] screenAI parse failed (last 500 chars):", clean.slice(-500));
    throw new Error("AI returned malformed JSON during screening");
  }
}
