import logger from "../utils/logger";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// Total attempts = 1 initial + MAX_RETRIES retries
const MAX_RETRIES = 4;
// Delays between retries — long enough for Gemini overloads to clear
const RETRY_DELAYS_MS = [3000, 8000, 15000, 25000];

// ─── UTILS ────────────────────────────────────────────────────────────────────

/** * Robust JSON extraction.*/
function extractJSON(text: string): string {
  const match = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  return match ? match[0].trim() : text.trim();
}

// ─── Gemini API caller ────────────────────────────────────────────────────────

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  let lastError: Error = new Error("Gemini call failed after all retries");

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
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
      lastError = networkErr instanceof Error ? networkErr : new Error(String(networkErr));
      logger.warn(`Gemini network error on attempt ${attempt + 1}: ${lastError.message}`);
      continue;
    }

    if (res.status === 503 || res.status === 429) {
      lastError = new Error(`Gemini ${res.status} — service overloaded`);
      logger.warn(`Gemini returned ${res.status} on attempt ${attempt + 1}/${MAX_RETRIES + 1}`);
      continue;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Gemini API error ${res.status}: ${body}`);
    }

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
You are a senior HR data engineer. Your only job is to extract structured data from resume text.
You never generate, invent, embellish, or pad. You output silence (omit the field) rather than noise.

STEP 1 — IS THIS ACTUALLY A RESUME?
Before doing anything, ask: does this text clearly belong to a specific person and describe their professional history?
Signs it is NOT a resume: it's a webpage with navigation links, a news article, a job description, a LinkedIn feed, random scraped text, or a document with no personal info.
If it is NOT a resume → output exactly this and nothing else: {"error":"not_a_resume"}

STEP 2 — HARD RULES:
R1. Output ONLY raw JSON. No markdown, no backticks, no prose, no explanations.
R2. OMIT any field you do not have real data for. Never use null, "", "N/A", or "Unknown".
R3. Never invent, assume, or infer anything not explicitly written in the text.

RESUME TEXT:
${text.slice(0, 12000)}
`.trim();

  const raw = await callGemini(prompt);
  const clean = extractJSON(raw);
  try {
    return JSON.parse(clean) as ExtractedCV;
  } catch (err) {
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
    ? `IMPORTANT: Evaluate all candidates, but ONLY return the top ${shortlistSize} best-matching candidates in your final JSON results array.`
    : "Evaluate and return results for every candidate provided.";

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
      `${e.role} @ ${e.company} [${e.startDate ?? "?"}–${e.endDate ?? "Present"}]${
        e.technologies?.length
          ? ` | Tech: ${e.technologies.slice(0, 5).join(", ")}`
          : ""
      }${e.description ? ` | ${e.description.slice(0, 120)}` : ""}`
    )
    .join("\n      ");

  const eduSummary = (a.education ?? [])
    .map((e: any) =>
      `${e.degree}${e.fieldOfStudy ? ` in ${e.fieldOfStudy}` : ""} @ ${e.institution}${
        e.endYear ? ` (${e.endYear})` : ""
      }`
    )
    .join("; ");

  const certSummary = (a.certifications ?? [])
    .map((c: any) => c.name)
    .join(", ");

  const projSummary = (a.projects ?? [])
    .slice(0, 3)
    .map((p: any) =>
      `${p.name}${
        p.technologies?.length
          ? ` [${p.technologies.slice(0, 4).join(", ")}]`
          : ""
      }${p.description ? `: ${p.description.slice(0, 80)}` : ""}`
    )
    .join(" | ");

  const langSummary = (a.languages ?? [])
    .map((l: any) => `${l.name} (${l.proficiency})`)
    .join(", ");

  return `CANDIDATE_ID: ${a._id}
      Name: ${a.full_name} | Headline: ${a.headline ?? "—"}
      Location: ${a.location ?? "—"} | Availability: ${a.availability?.status ?? "Unknown"} ${a.availability?.type ?? ""}
      Experience: ${a.experience_years ?? "?"} yrs total | Education: ${a.education_level ?? "—"}
      Skills: ${skillNames || "—"}
      Work History:
        ${expSummary || "—"}
      Education: ${eduSummary || "—"}
      Certifications: ${certSummary || "—"}
      Projects: ${projSummary || "—"}
      Languages: ${langSummary || "—"}`;
}).join("\n\n---\n\n");

  const prompt = `
You are TalentScreen's AI talent evaluator — an objective, evidence-based recruiter with no biases.
Your task: evaluate ${applicants.length} candidate(s) against the job spec below and produce ranked screening results.

${limitInstruction}

═══════════════════════════════════════
JOB SPECIFICATION
═══════════════════════════════════════
Title: ${job.title}
Department: ${job.department} | Type: ${job.employment_type} | Level: ${job.experience_level}
Required Skills: ${job.required_skills.join(", ") || "None specified"}
Preferred Skills: ${job.preferred_skills.join(", ") || "None specified"}
Job Description:
${job.description.slice(0, 2000)}

═══════════════════════════════════════
SCORING SYSTEM
═══════════════════════════════════════
Score each dimension 0-100 using the rubric below. Then compute:
match_score = (skills_score × ${w.skills} + experience_score × ${w.experience} + education_score × ${w.education} + relevance_score × ${w.relevance}) / 100
Round match_score to nearest integer.

SKILLS (${w.skills}% weight):
  100 = All required skills present at Advanced/Expert + majority of preferred skills
  80  = All required skills present
  60  = Most required skills present (missing 1-2 minor ones)
  40  = Partial match — has transferable or adjacent skills
  20  = Few relevant skills
  0   = Missing all required skills

EXPERIENCE (${w.experience}% weight):
  100 = Direct role match at exact seniority, with measurable impact in descriptions
  80  = Highly relevant domain with appropriate years
  60  = Adjacent domain or slightly under/over-qualified
  40  = Transferable experience but significant domain gap
  20  = Very limited relevant experience
  0   = Irrelevant background

EDUCATION (${w.education}% weight):
  100 = Exact degree + field match for the role
  80  = Correct level, adjacent field
  60  = Different level but compensated by experience
  40  = Unrelated degree
  0   = No formal education (exceptional experience CAN compensate — use judgment)

RELEVANCE (${w.relevance}% weight):
  100 = Ideal culture/domain/project fit — candidate would need zero ramp-up
  80  = Strong fit with minor gaps
  60  = Reasonable fit but 1-2 misalignments (location, availability, domain)
  40  = Needs significant onboarding
  0   = Poor overall fit

═══════════════════════════════════════
OUTPUT RULES
═══════════════════════════════════════
1. Return a JSON object with key "results" containing the ranked array.
2. applicant_id MUST exactly match the CANDIDATE_ID shown for each candidate.
3. Rank starts at 1 (best match).

4. strengths — strict rules:
   - Only write strengths directly evidenced by data in the candidate's profile above.
   - Name the specific skill, role, company, project, or achievement you are referencing.
   - NEVER write generic fluff like "good communicator" or "passionate".

5. gaps — strict rules:
   - Be specific. Note missing required skills or experience gaps.
   - type "dealbreaker" = missing something the job explicitly requires.
   - type "nice-to-have" = missing a preferred skill.

6. confidence_level — reflects data quality:
   "High"   = Complete profile (skills + detailed experience + education).
   "Medium" = Missing one major section.
   "Low"    = Sparse profile (fewer than 3 skills, no experience detail).

REQUIRED JSON FORMAT:
{"results": [{"applicant_id":"string","applicant_name":"string","rank":1,"match_score":0,"skills_score":0,"experience_score":0,"education_score":0,"relevance_score":0,"confidence_level":"High","recommendation":"Yes","strengths":["specific strength"],"gaps":[{"description":"specific gap","type":"nice-to-have"}],"bias_flags":[]}]}

═══════════════════════════════════════
CANDIDATES TO EVALUATE
═══════════════════════════════════════
${candidateSummaries}
`.trim();

  const raw = await callGemini(prompt);
  const clean = extractJSON(raw);
  try {
    const parsed = JSON.parse(clean);
    const results = Array.isArray(parsed) ? parsed : (parsed.results || []);

    if (!Array.isArray(results)) throw new Error("Response is not an array");

    const finalResults = shortlistSize ? results.slice(0, shortlistSize) : results;
    return finalResults as ScreeningResultAI[];
  } catch (err) {
    logger.error("Failed to parse screenAI response:", clean.slice(0, 500));
    throw new Error("AI returned malformed JSON during screening");
  }
}