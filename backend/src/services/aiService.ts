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
You are a senior HR data engineer. Your only job is to extract structured data from resume text.
You never generate, invent, embellish, or pad. You output silence (omit the field) rather than noise.

STEP 1 — IS THIS ACTUALLY A RESUME?
Before doing anything, ask: does this text clearly belong to a specific person and describe their professional history?
Signs it is NOT a resume: it's a webpage with navigation links, a news article, a job description, a LinkedIn feed, random scraped text, or a document with no personal info.
If it is NOT a resume → output exactly this and nothing else: {"error":"not_a_resume"}
If you are unsure → output {"error":"not_a_resume"} anyway. It is better to reject than to hallucinate.

STEP 2 — HARD RULES (these override everything else):
R1. Output ONLY raw JSON. No markdown, no backticks, no prose, no explanations.
R2. OMIT any field you do not have real data for. Never use null, "", "N/A", "Unknown", "Not specified", or placeholder text.
R3. Never invent, assume, or infer anything not explicitly written in the text.
R4. If a section exists but is illegible, garbled, or too short to parse, omit that whole section.

STEP 3 — FIELD-BY-FIELD RULES:

NAME
- Extract first_name, last_name, and full_name separately.
- If you cannot find a clear human name, omit all three and return {"error":"not_a_resume"}.

EMAIL / PHONE
- Extract exactly as written. Email → lowercase. Phone → keep country code if present.
- If absent, omit entirely.

LOCATION
- Format: "City, Country". If only a city is present, use just "City".
- If absent or ambiguous, omit.

HEADLINE
- Only include if you have at least a role AND one skill to work with.
- Format: "[Seniority] [Role] specializing in [Skill1] and [Skill2]"
- If the profile is too sparse to write a meaningful headline, omit it.

BIO
- Only write a bio if you have at least 3 distinct facts about the person (role, skills, experience length, or education).
- Write exactly 2 factual sentences. No opinions, no filler ("passionate", "dynamic", "results-driven").
- If fewer than 3 facts are available, omit bio entirely.

EXPERIENCE_YEARS
- Calculate by summing non-overlapping date ranges from the experience array.
- Round to nearest 0.5.
- If NO dates exist anywhere in the resume, omit experience_years entirely. Do NOT guess.

SKILLS
- Extract only skills explicitly named in the text (tools, languages, frameworks, methodologies).
- Do NOT infer skills from job titles or company names alone.
- Level inference (use the LOWEST level that fits the evidence):
    "Expert"       → explicitly called expert/lead/architect OR 5+ years stated for that specific skill
    "Advanced"     → 3-5 years stated, or senior-level role context clearly tied to that skill
    "Intermediate" → 1-3 years stated, or clearly used regularly in a described role
    "Beginner"     → explicitly described as learning, trainee, exposure, or < 1 year
    OMIT level field entirely → if there is zero evidence of proficiency level. Do not default to Intermediate.
- yearsOfExperience: only include if a number is explicitly stated for that specific skill. Omit otherwise.

EXPERIENCE (work history entries)
- Only include entries that have at minimum a company name OR a role title.
- startDate / endDate: format "YYYY-MM". Use "Present" for current. If a date is missing for an entry, omit that date field entirely — do not guess.
- description: only include if there is actual descriptive text in the resume. Do not summarise the job title as a description.
- technologies: only list items explicitly mentioned in that specific job entry.

EDUCATION
- Only include entries with at minimum an institution name OR a degree name.
- Degree level mapping: PhD/Doctorate→"PhD" | Master/MSc/MBA/MEng→"Master" | Bachelor/BSc/BA/BEng/BE→"Bachelor" | Associate→"Associate" | Diploma/HND/Secondary/High School→"High School"
- startYear / endYear: only include if explicitly stated as a year number. Never infer.

CERTIFICATIONS / PROJECTS
- Only include if explicitly named in the text. Do not infer from skills or experience descriptions.

SOCIAL LINKS
- Only include URLs that literally appear in the text. Never construct or guess URLs from a person's name.

AVAILABILITY
- Default to { "status": "Available", "type": "Full-time" } ONLY if no contradicting information exists.
- If the text says "not looking", "currently employed and not seeking", or similar → use "Not Available".

STEP 4 — OUTPUT STRUCTURE (omit any key with no real data):
{
  "first_name": "string",
  "last_name": "string",
  "full_name": "string",
  "email": "string",
  "phone": "string",
  "headline": "string",
  "bio": "string",
  "location": "string",
  "current_role": "string",
  "current_company": "string",
  "experience_years": 0,
  "education_level": "Bachelor",
  "education_field": "string",
  "skills": [{ "name": "string", "level": "Intermediate", "yearsOfExperience": 0 }],
  "languages": [{ "name": "string", "proficiency": "Fluent" }],
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
  "availability": { "status": "Available", "type": "Full-time" },
  "socialLinks": { "linkedin": "string", "github": "string", "portfolio": "string", "website": "string" },
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
    const skillNames = (a.skills ?? [])
      .map((s) => typeof s === "string" ? s : `${s.name}${s.level ? ` (${s.level})` : ""}${s.yearsOfExperience ? ` ${s.yearsOfExperience}yr` : ""}`)
      .join(", ");
    const expSummary = (a.experience ?? []).slice(0, 5)
      .map((e) => `${e.role} @ ${e.company} [${e.startDate ?? "?"}–${e.endDate ?? "Present"}]${e.technologies?.length ? ` | Tech: ${e.technologies.slice(0, 5).join(", ")}` : ""}${e.description ? ` | ${e.description.slice(0, 120)}` : ""}`)
      .join("\n  ");
    const eduSummary = (a.education ?? [])
      .map((e) => `${e.degree}${e.fieldOfStudy ? ` in ${e.fieldOfStudy}` : ""} @ ${e.institution}${e.endYear ? ` (${e.endYear})` : ""}`)
      .join("; ");
    const certSummary = (a.certifications ?? []).map((c) => c.name).join(", ");
    const projSummary = (a.projects ?? []).slice(0, 3)
      .map((p) => `${p.name}${p.technologies?.length ? ` [${p.technologies.slice(0, 4).join(", ")}]` : ""}${p.description ? `: ${p.description.slice(0, 80)}` : ""}`)
      .join(" | ");
    const langSummary = (a.languages ?? []).map((l) => `${l.name} (${l.proficiency})`).join(", ");

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
1. Return ONLY a raw JSON array. No markdown, no preamble, no code fences.
2. applicant_id MUST exactly match the CANDIDATE_ID shown for each candidate. Do not alter it.
3. Rank starts at 1 (best match). Every candidate appears exactly once.

4. strengths — strict rules:
   - Only write strengths directly evidenced by data in the candidate's profile above.
   - Name the specific skill, role, company, project, or achievement you are referencing.
   - If a candidate has a sparse profile (few skills, no experience detail, no projects), write FEWER strengths — 1 is acceptable.
   - NEVER write: "good communicator", "team player", "fast learner", "passionate", or any trait not supported by data.
   - If you cannot find any genuine strength relevant to this job: ["Insufficient profile data to assess strengths"]

5. gaps — strict rules:
   - Be specific. "Missing Python experience" is acceptable. "Lacks technical skills" is not.
   - If a required skill from the job spec is absent from the candidate's profile, it is a gap — name the skill.
   - If experience_years is significantly below the job level, note it with the actual numbers.
   - type "dealbreaker" = missing something the job explicitly requires and cannot be taught quickly.
   - type "nice-to-have" = missing a preferred skill or minor misalignment.

6. confidence_level — reflects data quality, not match quality:
   "High"   = candidate has a skills list + at least 2 experience entries with descriptions + education
   "Medium" = candidate is missing one major section (e.g. no experience descriptions, or no education)
   "Low"    = sparse profile — fewer than 3 skills, no experience detail, or mostly blank fields.
              When Low: automatically add a gap: {"description": "Sparse profile — scores are estimates only and candidate needs manual review", "type": "nice-to-have"}

7. Scoring discipline for incomplete profiles:
   - If a dimension has NO data (e.g. education section is entirely blank), score that dimension 0.
   - Do not award points for information not present in the profile.
   - A candidate with no education data gets education_score: 0 (unless job spec explicitly says education is not required).
   - Do not use average scores as a fallback. Absence of data = 0 for that dimension.

8. bias_flags: flag ANY scoring influence from non-merit factors (gender-coded language, career gaps,
   institution prestige, non-English background, nationality, age signals). Empty array if none.

9. recommendation thresholds:
   "Strong Yes" = match_score >= 82 AND no dealbreaker gaps AND confidence is High or Medium
   "Yes"        = match_score >= 68 AND no dealbreaker gaps
   "Maybe"      = match_score >= 50 OR recoverable gaps OR confidence is Low (needs human review)
   "No"         = match_score < 50 OR has dealbreaker gaps


JSON STRUCTURE:
[{"applicant_id":"string","applicant_name":"string","rank":1,"match_score":0,"skills_score":0,"experience_score":0,"education_score":0,"relevance_score":0,"confidence_level":"High","recommendation":"Yes","strengths":["specific strength"],"gaps":[{"description":"specific gap","type":"nice-to-have"}],"bias_flags":[]}]

═══════════════════════════════════════
CANDIDATES TO EVALUATE
═══════════════════════════════════════
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
