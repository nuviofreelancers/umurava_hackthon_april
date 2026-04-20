export declare const extractCV: (text: string) => Promise<any>;
const res = await axios.post(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
  { contents: [{ parts: [{ text: prompt }] }] },
  { timeout: 30000 }
).catch((err) => {
  // Log the actual Gemini error body, not just the Axios wrapper
  const geminiError = err.response?.data?.error;
  console.error("Gemini API error:", geminiError || err.message);
  throw new Error(geminiError?.message || "Gemini API call failed");
});
export declare const screenAI: (job: any, applicants: any[], weights: any, shortlistSize?: number) => Promise<any>;