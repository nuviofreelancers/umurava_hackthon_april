import axios from "axios";

// ── CV Extraction ──────────────────────────────────────────────────────────────

export const extractCV = async (text: string) => {
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

  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    { contents: [{ parts: [{ text: prompt }] }] },
    { timeout: 30000 }
  );

  let output = res.data.candidates[0].content.parts[0].text;
  output = output.replace(/```json/g, "").replace(/```/g, "").trim();

  try {
    return JSON.parse(output);
  } catch (err) {
    console.error("CV extract parse error:", output);
    throw new Error("Invalid AI JSON from CV extraction");
  }
};

// ── AI Screening ───────────────────────────────────────────────────────────────

export const screenAI = async (job: any, applicants: any[], weights: any, shortlistSize?: number) => {
  const cleanJob = {
    title: job.title,
    department: job.department || "",
    description: job.description || "",
    required_skills: job.required_skills || [],
    preferred_skills: job.preferred_skills || [],
    experience_level: job.experience_level || "",
    education_required: job.education_level || ""
  };

  const cleanApplicants = applicants.map(a => ({
    id: String(a._id),
    name: a.full_name || `${a.firstName || ""} ${a.lastName || ""}`.trim(),
    current_role: a.current_role || a.headline || "",
    experience_years: a.experience_years ?? 0,
    education_level: a.education_level || "",
    skills: (a.skills || []).map((s: any) => typeof s === "string" ? s : s.name)
  }));

  const topN = shortlistSize && shortlistSize < applicants.length ? shortlistSize : applicants.length;

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

  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    { contents: [{ parts: [{ text: prompt }] }] },
    { timeout: 60000 }
  );

  let output = res.data.candidates[0].content.parts[0].text;
  output = output.replace(/```json/g, "").replace(/```/g, "").trim();

  try {
    const parsed = JSON.parse(output);
    return parsed.candidates;
  } catch (err) {
    console.error("Screening parse error:", output);
    throw new Error("Invalid AI JSON from screening");
  }
};
