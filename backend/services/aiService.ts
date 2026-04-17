import axios from "axios";

export const extractCV = async (text: string) => {
  const prompt = `You are an ATS system

    Return ONLY valid JSON.

    Rules:
    - No text outside JSON
    - Skills must be objects

    Format:
    {
      "firstName": "",
      "lastName": "",
      "email": "",
      "headline": "",
      "skills": [
        {
          "name": "",
          "level": "",
          "yearsOfExperience": 0
        }
      ],
      "experience": [
        { "company": "", "role": "" }
      ],
      "education": [
        { "institution": "", "degree": "" }
      ]
    }

    CV:
    ${text.slice(0, 4000)}
    `;

  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY!}`,
    { contents: [{ parts: [{ text: prompt }] }] },
  );

  let output = res.data.candidates[0].content.parts[0].text;

  output = output
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(output);
  } catch (err) {
    console.error("AI Parse Error:", output);
    throw new Error("Invalid AI JSON");
  }
};

export const screenAI = async (job: any, applicants: any[]) => {
  const cleanJob = {
    title: job.title,
    description: job.description,
  };

  const cleanApplicants = applicants.slice(0, 3).map(a => ({
    id: a._id,
    name: `${a.firstName} ${a.lastName}`,
    headline: a.headline,
    skills: (a.skills || []).slice(0, 5).map((s: any) =>
      typeof s === "string" ? s : s.name
    )
  }));

  const prompt = `
You are an expert AI recruiter.

JOB:
${JSON.stringify(cleanJob)}

APPLICANTS:
${JSON.stringify(cleanApplicants)}

Return ONLY JSON:
{
  "candidates": [
    {
      "candidateId": "",
      "matchScore": 0,
      "strengths": [],
      "gaps": [],
      "recommendation": ""
    }
  ]
}
`;

  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    { contents: [{ parts: [{ text: prompt }] }] },
    { timeout: 30000 }
  );

  let output = res.data.candidates[0].content.parts[0].text;

  output = output
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  return JSON.parse(output);
};
