import axios from "axios";

const GEMINI_URL = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

// Safe free-tier models in fallback order.
// gemini-2.0-flash is the sweet spot: fast, capable, generous free quota.
// gemini-1.5-flash and 1.5-flash-8b as backups.
// DO NOT use "gemini-2.5-flash" — that model ID is invalid on free-tier keys and will always 429.
const MODELS = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b"];

// ── Retry helper for transient Gemini errors ──────────────────────────────────
async function fetchWithRetry(payload: any, maxRetries = 4) {
  let lastError: any;

  // Overall deadline — prevents hanging across all retries/models
  const overallDeadline = Date.now() + 90_000; // 90 seconds max total

  for (const model of MODELS) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (Date.now() > overallDeadline) {
        throw new Error("Gemini API timed out — overall deadline exceeded");
      }

      try {
        const res = await axios.post(GEMINI_URL(model), payload, { timeout: 60000 });
        return res;
      } catch (err: any) {
        const status = err.response?.status;
        lastError = err;

        if (status === 429 || status === 503) {
          // Respect Retry-After header if present, otherwise exponential backoff
          const retryAfterHeader = err.response?.headers?.["retry-after"];
          const retryAfterMs = retryAfterHeader
            ? parseInt(retryAfterHeader, 10) * 1000
            : Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 30000);

          console.warn(
            `Gemini [${model}] attempt ${attempt + 1} got ${status} — retrying in ${Math.round(retryAfterMs / 1000)}s`
          );
          await new Promise(r => setTimeout(r, retryAfterMs));
          continue;
        }

        // Non-retryable error on this model — move to next model
        console.warn(`Gemini [${model}] non-retryable error ${status} — trying next model`);
        break;
      }
    }
  }

  // All models exhausted
  const status = lastError?.response?.status;
  const geminiMsg = lastError?.response?.data?.error?.message;
  const error = new Error(geminiMsg || lastError?.message || "Gemini API call failed");
  (error as any).status = status;
  throw error;
}

// ── CV Extraction ─────────────────────────────────────────────────────────────

export const extractCV = async (text: string) => {
  // FIX 3: Guard against empty/failed upstream file parsing (PDF, DOC, link)
  if (!text || text.trim().length < 50) {
    throw new Error(
      "Extracted text is too short or empty — file parsing likely failed upstream (PDF/DOC/link)"
    );
  }

  const prompt = `You are a precise ATS data extraction engine. Your only job is to extract structured candidate data from the resume or CV text below.

Rules:
- If a field cannot be found in the text, return null — never guess or hallucinate.
- For array fields (skills, experience, education, etc.), return an empty array [] if nothing is found. Do NOT return a placeholder object inside the array.
- Skills must include a best-guess "level" from: Beginner, Intermediate, Advanced, Expert — infer from context (e.g. "5 years of Python" → Advanced).
- experience_years should be a number. If you can calculate it from the experience list, do so. If not found, return 0.
- education_level should be one of: None, High School, Associate, Bachelor, Master, PhD.
- Do not include any personal opinion, summary, or commentary.
- If the input text does not appear to be a resume or CV (e.g. it's a news article, product page, or gibberish), return exactly: { "error": "not_a_resume" }
- Return ONLY valid JSON. No markdown fences, no explanation, no preamble.

Required output format:
{
  "full_name": "",
  "email": "",
  "phone": "",
  "location": "",
  "current_role": "",
  "current_company": "",
  "experience_years": 0,
  "headline": "",
  "education_level": "",
  "education_field": "",
  "portfolio_url": "",
  "skills": [{ "name": "", "level": "", "yearsOfExperience": 0 }],
  "experience": [{ "company": "", "role": "", "startDate": "", "endDate": "" }],
  "education": [{ "institution": "", "degree": "", "field": "", "year": "" }],
  "certifications": [{ "name": "", "issuer": "", "year": "" }],
  "languages": [{ "name": "", "level": "" }],
  "projects": [{ "name": "", "description": "", "url": "" }],
  "socialLinks": { "linkedin": "", "github": "", "website": "" }
}

RESUME TEXT:
${text}`;

  let res: any;
  try {
    res = await fetchWithRetry({ contents: [{ parts: [{ text: prompt }] }] });
  } catch (err: any) {
    console.error(`Gemini API error (extractCV) [${err.status}]:`, err.message);
    throw err;
  }

  let output = res.data.candidates[0].content.parts[0].text;
  output = output.replace(/```json/g, "").replace(/```/g, "").trim();

  try {
    return JSON.parse(output);
  } catch (err) {
    console.error("CV extract parse error:", output);
    throw new Error("Invalid AI JSON from CV extraction");
  }
};

// ── AI Screening ──────────────────────────────────────────────────────────────

export const screenAI = async (job: any, applicants: any[], weights: any, shortlistSize?: number) => {
  const cleanJob = {
    title: job.title,
    department: job.department || "",
    description: job.description || "",
    required_skills: job.required_skills || [],
    preferred_skills: job.preferred_skills || [],
    experience_level: job.experience_level || "",
    education_required: job.education_level || "",
  };

  const cleanApplicants = applicants.map(a => ({
    id: String(a._id),
    name: a.full_name || `${a.firstName || ""} ${a.lastName || ""}`.trim(),
    current_role: a.current_role || a.headline || "",
    experience_years: a.experience_years ?? 0,
    education_level: a.education_level || "",
    skills: (a.skills || []).map((s: any) => (typeof s === "string" ? s : s.name)),
  }));

  // FIX 4: Correct shortlistSize falsy check (was broken when shortlistSize=0)
  const topN =
    shortlistSize != null && shortlistSize > 0 && shortlistSize < applicants.length
      ? shortlistSize
      : applicants.length;

  const prompt = `You are an expert, unbiased AI recruiter. Score and rank these applicants for the job below.

SCORING WEIGHTS (your sub-scores must reflect these proportions):
- Skills match: ${weights.skills}%
- Experience match: ${weights.experience}%
- Education match: ${weights.education}%
- Overall relevance: ${weights.relevance}%

JOB:
${JSON.stringify(cleanJob, null, 2)}

APPLICANTS:
${JSON.stringify(cleanApplicants, null, 2)}

Scoring rules:
- match_score is a weighted composite of the four sub-scores (0–100).
- A candidate missing more than 2 required skills must score below 50 overall.
- Do not pad scores. A genuinely weak candidate should receive an honest low score.
- If a candidate's data is mostly empty or missing, set confidence_level to "Low".
- "recommendation" must be exactly one of: "Strong Yes", "Yes", "Maybe", "No"
- For each gap, note whether it is a dealbreaker or a nice-to-have.
- bias_flags should flag any potential bias indicators (name-based, institution prestige, graduation year implying age, etc.) or be an empty array.
- Return exactly the top ${topN} candidates ranked by match_score descending.

Return ONLY valid JSON. No markdown, no preamble.

{
  "candidates": [
    {
      "applicant_id": "<the id field from applicants>",
      "applicant_name": "",
      "match_score": 0,
      "skills_score": 0,
      "experience_score": 0,
      "education_score": 0,
      "relevance_score": 0,
      "confidence_level": "High",
      "recommendation": "Strong Yes",
      "strengths": [],
      "gaps": [],
      "bias_flags": []
    }
  ]
}`;

  let res: any;
  try {
    res = await fetchWithRetry({ contents: [{ parts: [{ text: prompt }] }] });
  } catch (err: any) {
    console.error(`Gemini API error (screenAI) [${err.status}]:`, err.message);
    throw err;
  }

  let output = res.data.candidates[0].content.parts[0].text;
  output = output.replace(/```json/g, "").replace(/```/g, "").trim();

  try {
    const parsed = JSON.parse(output);

    // FIX 2: Guard against missing/malformed candidates array in AI response
    if (!parsed.candidates || !Array.isArray(parsed.candidates)) {
      console.error("Screening response missing candidates array:", parsed);
      throw new Error("AI screening response did not return a candidates array");
    }

    return parsed.candidates;
  } catch (err: any) {
    // Re-throw structured errors from the guard above
    if (err.message.includes("candidates array")) throw err;
    console.error("Screening parse error:", output);
    throw new Error("Invalid AI JSON from screening");
  }
};
