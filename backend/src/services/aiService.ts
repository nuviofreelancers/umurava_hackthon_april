import logger from "../utils/logger";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// Total attempts = 1 initial + MAX_RETRIES retries
const MAX_RETRIES = 4;
// Delays between retries — long enough for Gemini overloads to clear
const RETRY_DELAYS_MS = [3000, 8000, 15000, 25000];

// ─── Gemini API caller with correct retry logic ────────────────────────────────

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  let lastError: Error = new Error("Gemini call failed after all retries");

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Wait before retries (not before first attempt)
    if (attempt > 0) {
      const delay = RETRY_DELAYS_MS[attempt - 1] ?? 30000;
      logger.warn(`Gemini retry ${attempt}/${MAX_RETRIES} — waiting ${delay}ms before next attempt`);
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
              maxOutputTokens: 8192,
            },
            safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
            ],
          }),
        }
      );
    } catch (networkErr) {
      // Network-level failure (DNS, timeout, connection reset)
      lastError = networkErr instanceof Error ? networkErr : new Error(String(networkErr));
      logger.warn(`Gemini network error on attempt ${attempt + 1}: ${lastError.message}`);
      continue;
    }

    // Retryable: service overloaded or rate limited
    if (res.status === 503 || res.status === 429) {
      const retryAfterHeader = res.headers.get("Retry-After");
      lastError = new Error(`Gemini ${res.status} — service overloaded`);
      logger.warn(`Gemini returned ${res.status} on attempt ${attempt + 1}/${MAX_RETRIES + 1}${retryAfterHeader ? ` (Retry-After: ${retryAfterHeader}s)` : ""}`);
      // Honour server-sent Retry-After if present and larger than our delay
      if (retryAfterHeader && attempt < MAX_RETRIES) {
        const serverDelay = parseInt(retryAfterHeader, 10) * 1000;
        const ourDelay = RETRY_DELAYS_MS[attempt] ?? 30000;
        if (serverDelay > ourDelay) {
          await new Promise((r) => setTimeout(r, serverDelay));
          // Skip the normal delay at the top of the loop
          attempt++; // manually bump so the loop's wait is skipped on next iteration
          if (attempt > MAX_RETRIES) break;
        }
      }
      continue;
    }

    // Non-retryable HTTP error
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Gemini API error ${res.status}: ${body}`);
    }

    // Parse successful response
    const data = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!text) throw new Error("Gemini returned an empty response body");

    logger.info(`Gemini responded successfully on attempt ${attempt + 1}`);
    return text;
  }

  logger.error(`Gemini failed after ${MAX_RETRIES + 1} attempts: ${lastError.message}`);
  throw lastError;
}

/** Strip markdown code fences that Gemini sometimes wraps around JSON */
function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

// ─── CV EXTRACTION ─────────────────────────────────────────────────────────────

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

export async function extractCV(text: string): Promise<ExtractedCV> {
  const prompt = `
You are an expert HR data extraction system. Your sole task is to parse the resume text below and return a single valid JSON object.

STRICT RULES:
1. OUTPUT: Return ONLY raw JSON. No markdown fences, no prose, no explanation.
2. NOT A RESUME: If the text is clearly not a CV/resume, return exactly: {"error":"not_a_resume"}
3. NO HALLUCINATION: Extract ONLY information explicitly present in the text.
4. MISSING FIELDS: Omit fields entirely if absent — do NOT use null, "N/A", or empty placeholders.
5. DATES: Use "YYYY-MM" for start/end dates. Use "Present" for current roles.
6. SKILLS LEVEL: Exactly one of: "Beginner" | "Intermediate" | "Advanced" | "Expert"
7. LANGUAGE PROFICIENCY: Exactly: "Basic" | "Conversational" | "Fluent" | "Native"
8. AVAILABILITY STATUS: Exactly: "Available" | "Open to Opportunities" | "Not Available"
9. AVAILABILITY TYPE: Exactly: "Full-time" | "Part-time" | "Contract"
10. EDUCATION LEVEL: Exactly: "High School" | "Associate" | "Bachelor" | "Master" | "PhD" | "Other"
11. NAME: Provide first_name, last_name, AND full_name.
12. HEADLINE: Synthesize a 6-12 word professional title from their most recent role and key skills.
13. EXPERIENCE_YEARS: Calculate total professional years from all experience entries. Round to 0.5.
14. SOCIAL LINKS: Only include verifiable URLs explicitly present in the text.

REQUIRED JSON STRUCTURE:
{
  "first_name": "string", "last_name": "string", "full_name": "string",
  "email": "string", "phone": "string", "headline": "string",
  "bio": "string (2-4 sentence professional summary)",
  "location": "string (City, Country)", "current_role": "string", "current_company": "string",
  "experience_years": number, "education_level": "Bachelor", "education_field": "string",
  "skills": [{ "name": "string", "level": "Advanced", "yearsOfExperience": number }],
  "languages": [{ "name": "string", "proficiency": "Fluent" }],
  "experience": [{ "company": "string", "role": "string", "startDate": "YYYY-MM", "endDate": "YYYY-MM or Present", "description": "string", "technologies": ["string"], "isCurrent": false }],
  "education": [{ "institution": "string", "degree": "string", "fieldOfStudy": "string", "startYear": number, "endYear": number }],
  "certifications": [{ "name": "string", "issuer": "string", "issueDate": "YYYY-MM" }],
  "projects": [{ "name": "string", "description": "string", "technologies": ["string"], "role": "string", "link": "string", "startDate": "YYYY-MM", "endDate": "YYYY-MM" }],
  "availability": { "status": "Available", "type": "Full-time" },
  "socialLinks": { "linkedin": "string", "github": "string", "portfolio": "string" },
  "portfolio_url": "string"
}

RESUME TEXT:
${text.slice(0, 12000)}
`.trim();

  const raw = await callGemini(prompt);
  const clean = stripCodeFences(raw);
  try {
    return JSON.parse(clean) as ExtractedCV;
  } catch {
    logger.error("Failed to parse extractCV response as JSON:", clean.slice(0, 500));
    throw new Error("AI returned malformed JSON during CV extraction");
  }
}

// ─── AI SCREENING ──────────────────────────────────────────────────────────────

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

export async function screenAI(
  job: {
    _id: string; title: string; description: string;
    required_skills: string[]; preferred_skills: string[];
    experience_level: string; employment_type: string; department: string;
  },
  applicants: Array<{
    _id: string; full_name: string; headline?: string;
    skills?: Array<{ name: string; level?: string; yearsOfExperience?: number } | string>;
    experience?: Array<{ company: string; role: string; startDate?: string; endDate?: string; description?: string; technologies?: string[] }>;
    education?: Array<{ institution: string; degree: string; fieldOfStudy?: string; endYear?: number }>;
    experience_years?: number; education_level?: string;
    certifications?: Array<{ name: string; issuer?: string }>;
    projects?: Array<{ name: string; description?: string; technologies?: string[] }>;
    languages?: Array<{ name: string; proficiency?: string }>;
    location?: string; availability?: { status?: string; type?: string };
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

  const candidateSummaries = applicants.map((a) => {
    const skillNames = (a.skills ?? []).map((s) =>
      typeof s === "string" ? s : `${s.name}${s.level ? ` (${s.level})` : ""}${s.yearsOfExperience ? ` ${s.yearsOfExperience}yr` : ""}`
    ).join(", ");
    const expSummary = (a.experience ?? []).slice(0, 4)
      .map((e) => `${e.role} @ ${e.company} [${e.startDate ?? "?"}–${e.endDate ?? "Present"}]${e.technologies?.length ? ` | Tech: ${e.technologies.slice(0, 6).join(", ")}` : ""}`)
      .join(" | ");
    const eduSummary = (a.education ?? [])
      .map((e) => `${e.degree}${e.fieldOfStudy ? ` in ${e.fieldOfStudy}` : ""} @ ${e.institution}${e.endYear ? ` (${e.endYear})` : ""}`)
      .join("; ");
    const certSummary = (a.certifications ?? []).map((c) => c.name).join(", ");
    const projSummary = (a.projects ?? []).slice(0, 3)
      .map((p) => `${p.name}${p.technologies?.length ? ` [${p.technologies.slice(0, 4).join(", ")}]` : ""}`)
      .join("; ");
    return `CANDIDATE_ID: ${a._id}
Name: ${a.full_name}
Headline: ${a.headline ?? "—"}
Location: ${a.location ?? "—"}
Experience: ${a.experience_years ?? "?"} years | Education: ${a.education_level ?? "—"}
Availability: ${a.availability?.status ?? "Unknown"} (${a.availability?.type ?? "—"})
Skills: ${skillNames || "—"}
Work History: ${expSummary || "—"}
Education: ${eduSummary || "—"}
Certifications: ${certSummary || "—"}
Projects: ${projSummary || "—"}`;
  }).join("\n\n---\n\n");

  const prompt = `
You are TalentScreen's senior AI recruiter — an objective, bias-aware talent evaluation engine.
Evaluate and rank ${applicants.length} candidate(s) against the job specification below.

JOB SPECIFICATION
Title: ${job.title} | Department: ${job.department} | Type: ${job.employment_type} | Level: ${job.experience_level}
Required Skills: ${job.required_skills.join(", ") || "None specified"}
Preferred Skills: ${job.preferred_skills.join(", ") || "None specified"}
Description: ${job.description.slice(0, 2000)}

SCORING WEIGHTS: Skills ${w.skills}% | Experience ${w.experience}% | Education ${w.education}% | Relevance ${w.relevance}%

SCORING RUBRIC (0-100 per dimension):
SKILLS: 100=all required at Expert/Advanced + preferred | 80=all required present | 60=most required | 40=partial | 0=missing critical
EXPERIENCE: 100=direct match, correct seniority, impact-driven descriptions | 80=highly relevant | 60=adjacent domain | 40=transferable | 0=irrelevant
EDUCATION: 100=exact degree+field | 80=correct level+field | 60=related degree | 40=unrelated | 0=none (exceptional experience can compensate)
RELEVANCE: 100=perfect culture/domain/project fit | 80=strong alignment | 60=some misalignments | 40=significant ramp-up needed | 0=poor fit

COMPOSITE: match_score = (skills*${w.skills} + experience*${w.experience} + education*${w.education} + relevance*${w.relevance}) / 100 — round to integer

CONFIDENCE: "High"=complete detailed profile | "Medium"=some gaps, score +/-10 | "Low"=sparse profile, indicative only
RECOMMENDATION: "Strong Yes">=82 no dealbreakers | "Yes">=68 no dealbreakers | "Maybe">=50 or recoverable gaps | "No"<50 or critical gaps

BIAS CHECK — MANDATORY: flag in bias_flags any scoring influence from: gender-coded language, career gap penalization, institution prestige bias, non-English profile penalization, or any non-merit factor. Empty array if none.

TIE-BREAKING: 1) higher skills_score 2) higher experience_score 3) High > Medium > Low confidence 4) more direct experience years

OUTPUT RULES:
- Return ONLY a raw JSON array. No markdown, no preamble.
- Every candidate appears exactly once. Rank starts at 1.
- applicant_id must match CANDIDATE_ID exactly.
- strengths: 2-5 specific evidence-based points (not generic praise)
- gaps: 1-4 items each with description and type ("dealbreaker" or "nice-to-have")
- ${shortlistSize ? `Return only the top ${shortlistSize} candidates` : "Return ALL candidates ranked"}

JSON STRUCTURE:
[{"applicant_id":"string","applicant_name":"string","rank":1,"match_score":0,"skills_score":0,"experience_score":0,"education_score":0,"relevance_score":0,"confidence_level":"High","recommendation":"Yes","strengths":[],"gaps":[{"description":"string","type":"nice-to-have"}],"bias_flags":[]}]

CANDIDATES:
${candidateSummaries}
`.trim();

  const raw = await callGemini(prompt);
  const clean = stripCodeFences(raw);
  try {
    const parsed = JSON.parse(clean) as ScreeningResultAI[];
    if (!Array.isArray(parsed)) throw new Error("Gemini screening response is not an array");
    return parsed;
  } catch {
    logger.error("Failed to parse screenAI response as JSON:", clean.slice(0, 500));
    throw new Error("AI returned malformed JSON during screening");
  }
}
