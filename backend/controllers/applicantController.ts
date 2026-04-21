import { Request, Response } from "express";
import Applicant from "../models/Applicant";
import ScreeningResult from "../models/ScreeningResult";
import { parsePDF } from "../utils/pdfParser";
import { extractCV } from "../services/aiService";
import { validateResume } from "../utils/resumeValidator";
import mongoose from "mongoose";

interface AuthRequest extends Request {
  user?: { id: string };
}

// POST /api/applicants
// FIX: accept both job_id (snake) and jobId (camel) from the request body
export const createApplicant = async (req: AuthRequest, res: Response) => {
  try {
    const data: any = { ...req.body, userId: req.user!.id, sourceType: "manual" };

    // Frontend AddCandidateModal sends form.job_id (snake_case) — normalise to jobId
    const rawJobId = data.jobId || data.job_id;
    console.log("rawJobId:", rawJobId, "isValid:", mongoose.Types.ObjectId.isValid(rawJobId));
    delete data.job_id;
    if (rawJobId) {
      try {
        data.jobId = new mongoose.Types.ObjectId(rawJobId);
      } catch {
        console.warn("createApplicant: invalid jobId received:", rawJobId);
        delete data.jobId;
      }
    }

    const applicant = await Applicant.create(data);
    res.status(201).json(applicant);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating applicant" });
  }
};

// POST /api/applicants/bulk
export const bulkCreateApplicants = async (req: AuthRequest, res: Response) => {
  try {
    const { applicants, job_id, sourceType } = req.body;
    if (!Array.isArray(applicants) || applicants.length === 0) {
      return res.status(400).json({ message: "applicants must be a non-empty array" });
    }

    const duplicateWarnings: string[] = [];
    const crossJobMatches: string[] = [];

    const incomingEmails = applicants
      .map((a: any) => a.email?.trim().toLowerCase())
      .filter(Boolean);

    if (incomingEmails.length > 0) {
      const existing = await Applicant.find({
        userId: req.user!.id,
        email: { $in: incomingEmails },
        deletedAt: { $exists: false },
      }).select("email jobId full_name");

      for (const ex of existing) {
        const exJobId = (ex as any).jobId?.toString();
        const exName  = (ex as any).full_name || (ex as any).email;
        if (job_id && exJobId === job_id.toString()) {
          duplicateWarnings.push(exName);
        } else {
          crossJobMatches.push(exName);
        }
      }
    }

    // Resolve the jobId to use: prefer top-level job_id, then per-candidate jobId field
    const resolvedTopJobId = job_id && mongoose.Types.ObjectId.isValid(job_id)
      ? new mongoose.Types.ObjectId(job_id)
      : null;

    const docs = applicants.map((a: any) => {
      const perCandidateJobId = a.jobId && mongoose.Types.ObjectId.isValid(a.jobId)
        ? new mongoose.Types.ObjectId(a.jobId)
        : null;
      const finalJobId = resolvedTopJobId || perCandidateJobId;
      const doc: any = {
        ...a,
        userId: req.user!.id,
        sourceType: sourceType || a.sourceType || "manual",
        source: a.source || "",
      };
      if (finalJobId) doc.jobId = finalJobId;
      else delete doc.jobId;
      return doc;
    });

    let inserted: any[] = [];
  let insertErrors: string[] = [];

  try {
  inserted = await Applicant.insertMany(docs, { ordered: false });
  } catch (bulkErr: any) {
    // Mongoose bulk write errors expose partial results differently
    inserted = Object.values(bulkErr.insertedDocs ?? {});
    if (!inserted.length && bulkErr.result?.insertedIds) {
      // fallback: re-fetch by inserted IDs
      const ids = Object.values(bulkErr.result.insertedIds);
      inserted = await Applicant.find({ _id: { $in: ids } });
    }
    const writeErrors = bulkErr.writeErrors || bulkErr.errors || [];
    insertErrors = writeErrors.map((e: any) => `Row ${e.index}: ${e.errmsg || e.err?.errmsg || e.message}`);
  }

  res.status(201).json({ inserted, duplicateWarnings, crossJobMatches, ...(insertErrors.length ? { insertErrors } : {}) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error bulk importing applicants" });
  }
};

// GET /api/applicants
export const getApplicants = async (req: AuthRequest, res: Response) => {
  try {
    const filter: any = { userId: req.user!.id, deletedAt: { $exists: false } };
    const jobIdParam = req.query.job_id as string;
    if (jobIdParam && jobIdParam !== "undefined" && mongoose.Types.ObjectId.isValid(jobIdParam)) {
      filter.jobId = new mongoose.Types.ObjectId(jobIdParam);
    }

    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip  = (page - 1) * limit;

    const [applicants, total] = await Promise.all([
      Applicant.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Applicant.countDocuments(filter),
    ]);

    res.json({ data: applicants, page, limit, total, totalPages: Math.ceil(total / limit), hasMore: page * limit < total });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching applicants" });
  }
};

// GET /api/applicants/:id
export const getApplicantById = async (req: AuthRequest, res: Response) => {
  try {
    const applicant = await Applicant.findOne({ _id: req.params.id, userId: req.user!.id, deletedAt: { $exists: false } });
    if (!applicant) return res.status(404).json({ message: "Applicant not found" });
    res.json(applicant);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching applicant" });
  }
};

// PUT /api/applicants/:id
export const updateApplicant = async (req: AuthRequest, res: Response) => {
  try {
    const applicant = await Applicant.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.id },
      req.body,
      { returnDocument: "after", runValidators: false }
    );
    if (!applicant) return res.status(404).json({ message: "Applicant not found" });
    res.json(applicant);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating applicant" });
  }
};

// DELETE /api/applicants/:id — soft-delete so undo works
export const deleteApplicant = async (req: AuthRequest, res: Response) => {
  try {
    const applicant = await Applicant.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.id, deletedAt: { $exists: false } },
      { deletedAt: new Date() },
      { returnDocument: "after" }
    );
    if (!applicant) return res.status(404).json({ message: "Applicant not found" });
    res.json({ message: "Applicant deleted successfully", applicant });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting applicant" });
  }
};

// POST /api/applicants/:id/restore — undo soft-delete
export const restoreApplicant = async (req: AuthRequest, res: Response) => {
  try {
    const applicant = await Applicant.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.id, deletedAt: { $exists: true } },
      { $unset: { deletedAt: 1 } },
      { returnDocument: "after" }
    );
    if (!applicant) return res.status(404).json({ message: "Applicant not found or not deleted" });
    res.json({ message: "Applicant restored successfully", applicant });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error restoring applicant" });
  }
};

// ── Helper: extract text from buffer ─────────────────────────────────────────
async function extractTextFromBuffer(buffer: Buffer, mimetype: string, filename: string): Promise<string> {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();

  if (mimetype === "application/pdf" || ext === ".pdf") {
    return parsePDF(buffer);
  }

  // .docx — browsers may send as octet-stream, so always check extension too
  if (
    mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimetype === "application/octet-stream" && ext === ".docx" ||
    ext === ".docx"
  ) {
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    if (!result.value || result.value.trim().length < 10) {
      throw new Error("Could not extract text from .docx — file may be corrupt or password-protected.");
    }
    return result.value;
  }

  // .doc (legacy Word)
  if (
  mimetype === "application/msword" ||
  (mimetype === "application/octet-stream" && ext === ".doc") ||
  ext === ".doc"
  ) {
    throw new Error(
      "Legacy .doc files are not supported. Please save the file as .docx (Word 2007+) and re-upload."
    );
  }

  // Images — OCR
  if (
    ["image/jpeg", "image/jpg", "image/png", "image/tiff", "image/webp"].includes(mimetype) ||
    [".jpg", ".jpeg", ".png", ".tiff", ".webp"].includes(ext)
  ) {
    const Tesseract = require("tesseract.js");
    const { data: { text } } = await Tesseract.recognize(buffer, "eng", { logger: () => {} });
    return text;
  }

  throw new Error(`Unsupported file type: ${mimetype} (${ext}). Please upload PDF, Word (.docx/.doc), or an image.`);
}

// ── Google Drive / Docs URL normalizer ───────────────────────────────────────
function resolveGoogleUrl(url: string): { directUrl: string; type: "pdf" | "docx" | "html" } | null {
  try {
    const u = new URL(url);
    const host = u.hostname;

    const driveFileMatch = u.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveFileMatch) {
      return { directUrl: `https://drive.google.com/uc?export=download&id=${driveFileMatch[1]}`, type: "pdf" };
    }

    const openId = u.searchParams.get("id");
    if (host === "drive.google.com" && u.pathname === "/open" && openId) {
      return { directUrl: `https://drive.google.com/uc?export=download&id=${openId}`, type: "pdf" };
    }

    const docsMatch = u.pathname.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
    if (docsMatch) {
      return { directUrl: `https://docs.google.com/document/d/${docsMatch[1]}/export?format=txt`, type: "html" };
    }

    const slidesMatch = u.pathname.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
    if (slidesMatch) {
      return { directUrl: `https://docs.google.com/presentation/d/${slidesMatch[1]}/export?format=txt`, type: "html" };
    }

    return null;
  } catch {
    return null;
  }
}

async function extractTextFromUrl(url: string): Promise<string> {
  const fetch = require("node-fetch");
  const googleResolved = resolveGoogleUrl(url);
  const targetUrl = googleResolved ? googleResolved.directUrl : url;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  let res: any;
  try {
    res = await fetch(targetUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HRBot/1.0)" },
    });
  } catch (err: any) {
    if (err.name === "AbortError") throw new Error("URL request timed out after 20 seconds.");
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    if (googleResolved) {
      throw new Error(`Could not access Google Drive file. Share it as "Anyone with the link" (got ${res.status}).`);
    }
    throw new Error(`Could not fetch URL (${res.status}): ${res.statusText}`);
  }

  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/pdf") || contentType.includes("octet-stream")) {
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.slice(0, 4).toString("ascii") === "%PDF") return parsePDF(buffer);
    // If it's octet-stream but not a PDF, fall through to HTML extraction
    if (!contentType.includes("octet-stream")) {
      throw new Error("URL returned a binary file that is not a PDF.");
    }
  }

  if (contentType.includes("text/plain") || googleResolved?.type === "html") {
    const text = await res.text();
    if (text.trim().length < 50) throw new Error("The document appears empty or too short to parse.");
    return text;
  }

  if (contentType.includes("application/vnd.openxmlformats") || contentType.includes("application/msword")) {
    const mammoth = require("mammoth");
    const arrayBuffer = await res.arrayBuffer();
    const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) });
    return result.value;
  }

  const html = await res.text();
  const stripped = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (stripped.length < 100) throw new Error("Could not extract meaningful text from the URL.");
  return stripped;
}

// ── Schema normalizer ─────────────────────────────────────────────────────────
function normalizeCandidate(c: any): any {
  const full_name = c.full_name?.trim() || [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || "";
  const current_role = c.current_role?.trim() || c.headline?.trim() || "";

  let education_level = c.education_level || "";
  let education_field = c.education_field || "";
  if (!education_level && Array.isArray(c.education) && c.education.length > 0) {
    const latest = c.education[c.education.length - 1];
    education_level = latest.degree || "";
    education_field = latest.fieldOfStudy || latest["Field of Study"] || latest.field || "";
  }

  let experience_years = c.experience_years ?? 0;
  if (!experience_years && Array.isArray(c.experience) && c.experience.length > 0) {
    let totalMonths = 0;
    for (const exp of c.experience) {
      const start = exp["Start Date"] || exp.startDate;
      const end   = exp["End Date"]   || exp.endDate;
      if (start) {
        const startDate = new Date(start + (start.length === 7 ? "-01" : ""));
        const endDate   = (end === "Present" || exp["Is Current"])
          ? new Date()
          : new Date((end || "") + (end && end.length === 7 ? "-01" : ""));
        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
          totalMonths += (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
        }
      }
    }
    experience_years = Math.round(totalMonths / 12);
  }

  const rawSkills = c.skills;
  const skillsArray: any[] = Array.isArray(rawSkills)
    ? rawSkills
    : typeof rawSkills === "string" && rawSkills.trim()
      ? rawSkills.split(/[;|,]/).map((s: string) => s.trim()).filter(Boolean)
      : [];
  const skills = skillsArray.map((s: any) =>
    typeof s === "string" ? { name: s, level: "Intermediate", yearsOfExperience: 0 } : s
  );

  const education = (Array.isArray(c.education) ? c.education : []).map((e: any) => ({
    institution: e.institution || "",
    degree: e.degree || "",
    field: e.fieldOfStudy || e["Field of Study"] || e.field || "",
    year: String(e.endYear || e["End Year"] || e.year || ""),
  }));

  const experience = (Array.isArray(c.experience) ? c.experience : []).map((e: any) => ({
    company:   e.company   || "",
    role:      e.role      || "",
    startDate: e["Start Date"] || e.startDate || "",
    endDate:   e["End Date"]   || e.endDate   || "",
  }));

  const certifications = (Array.isArray(c.certifications) ? c.certifications : []).map((cert: any) => ({
    name:   cert.name   || "",
    issuer: cert.issuer || "",
    year:   cert.issueDate || cert["Issue Date"] || cert.year || "",
  }));

  const socialLinks = {
    linkedin: c.socialLinks?.linkedin || "",
    github:   c.socialLinks?.github   || "",
    website:  c.socialLinks?.portfolio || c.socialLinks?.website || "",
  };

  return {
    full_name,
    email:           c.email || "",
    phone:           c.phone || "",
    location:        c.location || "",
    headline:        c.headline || current_role,
    bio:             c.bio || "",
    current_role,
    current_company: c.current_company || (c.experience?.[0]?.company) || "",
    experience_years,
    education_level,
    education_field,
    skills,
    education,
    experience,
    certifications,
    languages: Array.isArray(c.languages)
      ? c.languages
      : typeof c.languages === "string" && c.languages.trim()
        ? c.languages.split(/[;|,]/).map((l: string) => ({ name: l.trim(), level: "" }))
        : [],
    projects: Array.isArray(c.projects)
      ? c.projects
      : typeof c.projects === "string" && c.projects.trim()
        ? c.projects.split(/[;|,]/).map((p: string) => ({ name: p.trim(), description: "", url: "" }))
        : [],
    socialLinks,
    portfolio_url: c.portfolio_url || c.socialLinks?.portfolio || c.socialLinks?.website || "",
    availability:  c.availability || { status: "", type: "" },
  };
}

async function checkDuplicateEmail(email: string, jobId: string | undefined, userId: string | undefined) {
  if (!email || !userId) return {};
  const existing = await Applicant.findOne({
    userId,
    email: email.trim().toLowerCase(),
    deletedAt: { $exists: false },
  }).select("jobId full_name");
  if (!existing) return {};
  const existingJobId = (existing as any).jobId?.toString();
  if (jobId && existingJobId === jobId.toString()) {
    return { duplicateWarnings: [(existing as any).full_name || email] };
  }
  return { crossJobMatches: [(existing as any).full_name || email] };
}

// ── CSV line parser ───────────────────────────────────────────────────────────
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = ""; let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if      (ch === '"' && !inQuotes)                        { inQuotes = true; }
    else if (ch === '"' && inQuotes && line[i + 1] === '"')  { current += '"'; i++; }
    else if (ch === '"' && inQuotes)                         { inQuotes = false; }
    else if (ch === "," && !inQuotes)                        { result.push(current.trim()); current = ""; }
    else                                                     { current += ch; }
  }
  result.push(current.trim());
  return result;
}

// POST /api/upload/candidates
// NOTE: Excel (.xlsx/.xls) requires `xlsx` package — install with: npm install xlsx
export const parseUploadedCandidates = async (req: Request, res: Response) => {
  try {
    const { job_id, cv_url } = req.body;

    // ── URL-based CV ──────────────────────────────────────────────────────────
    if (cv_url) {
      const rawText    = await extractTextFromUrl(cv_url);
      const structured = await extractCV(rawText);
      if ((structured as any).error === "not_a_resume") {
        return res.status(422).json({ message: "The URL does not appear to contain a resume or CV." });
      }
      const validated        = validateResume(structured);
      const duplicateWarning = await checkDuplicateEmail(validated.email, job_id, (req as any).user?.id);
      const candidate = {
        ...validated,
        sourceType: "url",
        cv_url,
        ...(job_id ? { jobId: job_id } : {}),
      };
      return res.json({ count: 1, candidates: [candidate], sourceType: "url", ...duplicateWarning });
    }

    if (!req.file) return res.status(400).json({ message: "No file or URL provided" });

    const { mimetype, originalname, buffer } = req.file;
    const ext = originalname.slice(originalname.lastIndexOf(".")).toLowerCase();

    // ── CSV ───────────────────────────────────────────────────────────────────
    if (mimetype === "text/csv" || mimetype === "text/plain" || ext === ".csv") {
      const text  = buffer.toString("utf-8").replace(/\r/g, "");
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) return res.status(400).json({ message: "CSV appears empty or has no data rows" });

      const headers      = parseCSVLine(lines[0]).map(h => h.replace(/"/g, ""));
      const candidates: any[] = [];
      const parseErrors: string[] = [];

      for (const line of lines.slice(1)) {
        try {
          const values = parseCSVLine(line);
          const obj: any = {};
          headers.forEach((h: string, i: number) => { obj[h] = values[i] || ""; });
          candidates.push({
            ...normalizeCandidate(obj),
            sourceType: "csv",
            ...(job_id ? { jobId: job_id } : {}),
          });
        } catch (rowErr: any) {
          parseErrors.push(`Row skipped — ${rowErr.message}`);
        }
      }

      if (candidates.length === 0) {
        return res.status(422).json({ message: "No valid candidates could be parsed from the CSV.", errors: parseErrors });
      }
      return res.json({ count: candidates.length, candidates, sourceType: "csv", ...(parseErrors.length ? { parseErrors } : {}) });
    }

    // ── Excel .xlsx / .xls — requires: npm install xlsx ──────────────────────
    if (
      ext === ".xlsx" || ext === ".xls" ||
      mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mimetype === "application/vnd.ms-excel"
    ) {
      let XLSX: any;
      try {
        XLSX = require("xlsx");
      } catch {
        return res.status(501).json({ message: "Excel support not installed. Run: npm install xlsx" });
      }
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

      if (rows.length === 0) return res.status(400).json({ message: "Excel file appears empty" });

      const candidates = rows.map((row: any) => ({
        ...normalizeCandidate(row),
        sourceType: "csv",
        ...(job_id ? { jobId: job_id } : {}),
      }));

      return res.json({ count: candidates.length, candidates, sourceType: "csv" });
    }

    // ── JSON ──────────────────────────────────────────────────────────────────
    if (mimetype === "application/json" || ext === ".json") {
      const parsed = JSON.parse(buffer.toString("utf-8"));
      const raw    = Array.isArray(parsed) ? parsed : [parsed];
      const candidates = raw.map((c: any) => ({
        ...normalizeCandidate(c),
        sourceType: "json",
        ...(job_id ? { jobId: job_id } : {}),
      }));
      return res.json({ count: candidates.length, candidates, sourceType: "json" });
    }

    // ── CV file: PDF / Word / image ───────────────────────────────────────────
    const rawText = await extractTextFromBuffer(buffer, mimetype, originalname);
    if (!rawText || rawText.trim().length < 50) {
      return res.status(422).json({ message: "Could not extract readable text from the file." });
    }

    const structured = await extractCV(rawText);
    if ((structured as any).error === "not_a_resume") {
      return res.status(422).json({ message: "The uploaded file does not appear to be a resume or CV." });
    }

    const validated        = validateResume(structured);
    const duplicateWarning = await checkDuplicateEmail(validated.email, job_id, (req as any).user?.id);
    const sourceType       = ext === ".pdf" ? "pdf" : [".docx", ".doc"].includes(ext) ? "docx" : "image_ocr";

    const candidate = {
      ...validated,
      sourceType,
      ...(job_id ? { jobId: job_id } : {}),
    };
    return res.json({ count: 1, candidates: [candidate], sourceType, ...duplicateWarning });

  } catch (error: any) {
  console.error("parseUploadedCandidates error:", error);
  
  // Handle Gemini rate limit / service unavailable
  if (error.status === 429) {
    return res.status(429).json({ 
      message: "AI service is rate-limited. Please wait ~30 seconds and try again." 
    });
  }
  if (error.status === 503) {
    return res.status(503).json({ 
      message: "AI service temporarily unavailable. Please retry shortly." 
    });
  }
  
  // Handle "not a resume" from AI
  if (error.message?.includes("not_a_resume")) {
    return res.status(422).json({ message: "The uploaded content does not appear to be a resume or CV." });
  }
  
  // Fallback for other errors
  res.status(500).json({ message: error.message || "Error parsing upload" });
}
};

// POST /api/upload/jobs
export const parseUploadedJobs = async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const { mimetype, originalname, buffer } = req.file;
    const ext = originalname.slice(originalname.lastIndexOf(".")).toLowerCase();

    if (mimetype === "text/csv" || mimetype === "text/plain" || ext === ".csv") {
      const text  = buffer.toString("utf-8").replace(/\r/g, "");
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) return res.status(400).json({ message: "CSV appears empty or has no data rows" });

      const headers = parseCSVLine(lines[0]).map(h => h.replace(/"/g, ""));
      const jobs    = lines.slice(1).map(line => {
        const values = parseCSVLine(line);
        const obj: any = {};
        headers.forEach((h, i) => { obj[h] = values[i] || ""; });
        return obj;
      });
      return res.json({ count: jobs.length, jobs });
    }

    if (mimetype === "application/json" || ext === ".json") {
      const parsed = JSON.parse(buffer.toString("utf-8"));
      const jobs   = Array.isArray(parsed) ? parsed : [parsed];
      return res.json({ count: jobs.length, jobs });
    }

    return res.status(400).json({ message: "Unsupported file type for job upload. Please use CSV or JSON." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error parsing job upload" });
  }
};
