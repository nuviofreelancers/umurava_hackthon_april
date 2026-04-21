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
export const createApplicant = async (req: AuthRequest, res: Response) => {
  try {
    const applicant = await Applicant.create({ ...req.body, userId: req.user!.id, sourceType: "manual" });
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

    // ── Duplicate detection ────────────────────────────────────────────────
    // Check each incoming candidate: does this email already exist for this user?
    // If job_id is provided, also check if they already applied to THIS specific job.
    const duplicateWarnings: string[] = [];
    const crossJobMatches: string[] = [];

    const incomingEmails = applicants
      .map((a: any) => a.email?.trim().toLowerCase())
      .filter(Boolean);

    if (incomingEmails.length > 0) {
      // Find any existing applicants for this user with matching emails
      const existing = await Applicant.find({
        userId: req.user!.id,
        email: { $in: incomingEmails },
      }).select("email jobId full_name");

      for (const ex of existing) {
        const exEmail = (ex as any).email?.toLowerCase();
        const exJobId = (ex as any).jobId?.toString();
        const exName  = (ex as any).full_name || exEmail;

        if (job_id && exJobId === job_id.toString()) {
          // Same candidate, same job
          duplicateWarnings.push(exName);
        } else {
          // Same candidate, different job
          crossJobMatches.push(exName);
        }
      }
    }

    const docs = applicants.map((a: any) => ({
      ...a,
      userId: req.user!.id,
      jobId: job_id ? new mongoose.Types.ObjectId(job_id) : undefined,
      sourceType: sourceType || a.sourceType || "manual",
      // Preserve user-defined source label (LinkedIn, Upwork, etc.)
      source: a.source || "",
    }));

    const inserted = await Applicant.insertMany(docs, { ordered: false });

    res.status(201).json({
      inserted,
      duplicateWarnings,   // candidates already in this job
      crossJobMatches,     // candidates who applied to another job before
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error bulk importing applicants" });
  }
};

// GET /api/applicants — supports ?page=&limit= for pagination
export const getApplicants = async (req: AuthRequest, res: Response) => {
  try {
    const filter: any = { userId: req.user!.id };
    const jobIdParam = req.query.job_id as string;
    if (jobIdParam && jobIdParam !== "undefined" && mongoose.Types.ObjectId.isValid(jobIdParam)) {
      filter.jobId = new mongoose.Types.ObjectId(jobIdParam);
    }

    // FIX: pagination — defaults to page 1, 50 per page
    const page  = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip  = (page - 1) * limit;

    const [applicants, total] = await Promise.all([
      Applicant.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Applicant.countDocuments(filter),
    ]);

    res.json({
      data: applicants,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching applicants" });
  }
};

// GET /api/applicants/:id
export const getApplicantById = async (req: AuthRequest, res: Response) => {
  try {
    const applicant = await Applicant.findOne({ _id: req.params.id, userId: req.user!.id });
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

// DELETE /api/applicants/:id
export const deleteApplicant = async (req: AuthRequest, res: Response) => {
  try {
    const applicant = await Applicant.findOneAndDelete({ _id: req.params.id, userId: req.user!.id });
    if (!applicant) return res.status(404).json({ message: "Applicant not found" });
    await ScreeningResult.deleteMany({ applicant_id: req.params.id });
    res.json({ message: "Applicant deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting applicant" });
  }
};

// ── Helper: extract text from a buffer based on mimetype / extension ──────────
async function extractTextFromBuffer(buffer: Buffer, mimetype: string, filename: string): Promise<string> {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();

  // PDF
  if (mimetype === "application/pdf" || ext === ".pdf") {
    return parsePDF(buffer);
  }

  // Word .docx
  if (
    mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === ".docx"
  ) {
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // Word .doc (legacy)
  if (mimetype === "application/msword" || ext === ".doc") {
    // mammoth handles .doc too, though fidelity may vary
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // Image — OCR via Tesseract
  if (
    ["image/jpeg", "image/jpg", "image/png", "image/tiff", "image/webp"].includes(mimetype) ||
    [".jpg", ".jpeg", ".png", ".tiff", ".webp"].includes(ext)
  ) {
    const Tesseract = require("tesseract.js");
    const { data: { text } } = await Tesseract.recognize(buffer, "eng", { logger: () => {} });
    return text;
  }

  throw new Error(`Cannot extract text from file type: ${mimetype}`);
}

// ── Helper: fetch and strip text from a URL ───────────────────────────────────
// ── Google Drive / Docs URL normalizer ───────────────────────────────────────
// Converts any Google Drive or Docs share URL into a direct-download URL.
// Returns null if the URL is not a Google Drive/Docs link.
function resolveGoogleUrl(url: string): { directUrl: string; type: "pdf" | "docx" | "html" } | null {
  try {
    const u = new URL(url);
    const host = u.hostname; // drive.google.com or docs.google.com

    // ── Google Drive file: drive.google.com/file/d/FILE_ID/view ──────────────
    const driveFileMatch = u.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveFileMatch) {
      const fileId = driveFileMatch[1];
      return {
        directUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
        type: "pdf", // most CV files on Drive are PDFs; content-type check below handles the rest
      };
    }

    // ── Google Drive open link: drive.google.com/open?id=FILE_ID ─────────────
    const openId = u.searchParams.get("id");
    if (host === "drive.google.com" && u.pathname === "/open" && openId) {
      return {
        directUrl: `https://drive.google.com/uc?export=download&id=${openId}`,
        type: "pdf",
      };
    }

    // ── Google Docs: docs.google.com/document/d/DOC_ID/... ───────────────────
    const docsMatch = u.pathname.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
    if (docsMatch) {
      const docId = docsMatch[1];
      // Export as plain text — best for CV content extraction
      return {
        directUrl: `https://docs.google.com/document/d/${docId}/export?format=txt`,
        type: "html",
      };
    }

    // ── Google Slides / Sheets (less common for CVs, handle gracefully) ───────
    const slidesMatch = u.pathname.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
    if (slidesMatch) {
      return {
        directUrl: `https://docs.google.com/presentation/d/${slidesMatch[1]}/export?format=txt`,
        type: "html",
      };
    }

    return null;
  } catch {
    return null;
  }
}

async function extractTextFromUrl(url: string): Promise<string> {
  const fetch = require("node-fetch");

  // Resolve Google Drive/Docs URLs to direct download URLs
  const googleResolved = resolveGoogleUrl(url);
  const targetUrl = googleResolved ? googleResolved.directUrl : url;

  const res = await fetch(targetUrl, {
    timeout: 20000,
    redirect: "follow",
    headers: {
      // Mimic a browser enough to avoid bot-detection on some pages
      "User-Agent": "Mozilla/5.0 (compatible; HRBot/1.0)",
    },
  });

  if (!res.ok) {
    if (googleResolved) {
      throw new Error(
        `Could not access the Google Drive file. Make sure it is shared as "Anyone with the link" (got ${res.status}).`
      );
    }
    throw new Error(`Could not fetch URL: ${res.statusText}`);
  }

  const contentType = res.headers.get("content-type") || "";

  // PDF — whether from Drive or direct link
  if (contentType.includes("application/pdf") || contentType.includes("octet-stream")) {
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    // Verify it's actually a PDF (starts with %PDF)
    if (buffer.slice(0, 4).toString() === "%PDF") {
      return parsePDF(buffer);
    }
  }

  // Plain text (Google Docs export=txt, .txt files)
  if (contentType.includes("text/plain") || googleResolved?.type === "html") {
    const text = await res.text();
    if (text.trim().length < 50) throw new Error("The document appears to be empty or too short to parse.");
    return text;
  }

  // Word document
  if (
    contentType.includes("application/vnd.openxmlformats") ||
    contentType.includes("application/msword")
  ) {
    const mammoth = require("mammoth");
    const arrayBuffer = await res.arrayBuffer();
    const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) });
    return result.value;
  }

  // HTML page (LinkedIn, portfolio, etc.) — strip tags
  const html = await res.text();
  const stripped = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (stripped.length < 100) throw new Error("Could not extract meaningful text from the URL. For Google Drive files, ensure the file is shared publicly.");
  return stripped;
}


// ── Umurava schema normalizer ─────────────────────────────────────────────────
// Maps the Umurava Talent Profile Schema fields to our internal DB schema.
// Handles both Umurava format (firstName/lastName, headline, etc.)
// and our own format (full_name, current_role, etc.) gracefully.
function normalizeCandidate(c: any): any {
  // Name: Umurava uses firstName + lastName, we use full_name
  const full_name = c.full_name?.trim() ||
    [c.firstName, c.lastName].filter(Boolean).join(" ").trim() ||
    "";

  // Role: Umurava uses headline as the primary professional title
  const current_role = c.current_role?.trim() || c.headline?.trim() || "";

  // Education: flatten from array if needed
  let education_level = c.education_level || "";
  let education_field = c.education_field || "";
  if (!education_level && Array.isArray(c.education) && c.education.length > 0) {
    const latest = c.education[c.education.length - 1];
    education_level = latest.degree || "";
    education_field = latest.fieldOfStudy || latest["Field of Study"] || latest.field || "";
  }

  // experience_years: calculate from experience array if not provided
  let experience_years = c.experience_years ?? 0;
  if (!experience_years && Array.isArray(c.experience) && c.experience.length > 0) {
    let totalMonths = 0;
    for (const exp of c.experience) {
      const start = exp["Start Date"] || exp.startDate;
      const end = exp["End Date"] || exp.endDate;
      if (start) {
        const startDate = new Date(start + (start.length === 7 ? "-01" : ""));
        const endDate = (end === "Present" || exp["Is Current"]) ? new Date() : new Date((end || "") + (end && end.length === 7 ? "-01" : ""));
        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
          totalMonths += (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
        }
      }
    }
    experience_years = Math.round(totalMonths / 12);
  }

  // Skills: handle string (CSV cell), array of strings, or array of objects
  const rawSkills = c.skills;
  const skillsArray: any[] = Array.isArray(rawSkills)
    ? rawSkills
    : typeof rawSkills === "string" && rawSkills.trim()
      ? rawSkills.split(/[;|,]/).map((s: string) => s.trim()).filter(Boolean)
      : [];
  const skills = skillsArray.map((s: any) =>
    typeof s === "string" ? { name: s, level: "Intermediate", yearsOfExperience: 0 } : s
  );

  // Education array: normalise field names
  const education = (Array.isArray(c.education) ? c.education : []).map((e: any) => ({
    institution: e.institution || "",
    degree: e.degree || "",
    field: e.fieldOfStudy || e["Field of Study"] || e.field || "",
    year: String(e.endYear || e["End Year"] || e.year || ""),
  }));

  // Experience array: normalise field names
  const experience = (Array.isArray(c.experience) ? c.experience : []).map((e: any) => ({
    company: e.company || "",
    role: e.role || "",
    startDate: e["Start Date"] || e.startDate || "",
    endDate: e["End Date"] || e.endDate || "",
  }));

  // Certifications: normalise Issue Date → year
  const certifications = (Array.isArray(c.certifications) ? c.certifications : []).map((cert: any) => ({
    name: cert.name || "",
    issuer: cert.issuer || "",
    year: cert.issueDate || cert["Issue Date"] || cert.year || "",
  }));

  // Social links: Umurava uses portfolio, we use website
  const socialLinks = {
    linkedin: c.socialLinks?.linkedin || "",
    github: c.socialLinks?.github || "",
    website: c.socialLinks?.portfolio || c.socialLinks?.website || "",
  };

  // Portfolio URL: prefer explicit field, then social portfolio
  const portfolio_url = c.portfolio_url || c.socialLinks?.portfolio || c.socialLinks?.website || "";

  // Availability
  const availability = c.availability || { status: "", type: "" };

  return {
    full_name,
    email: c.email || "",
    phone: c.phone || "",
    location: c.location || "",
    headline: c.headline || current_role,
    bio: c.bio || "",
    current_role,
    current_company: c.current_company || (c.experience?.[0]?.company) || "",
    experience_years,
    education_level,
    education_field,
    skills,
    education,
    experience,
    certifications,
    languages: Array.isArray(c.languages) ? c.languages : [],
    projects: Array.isArray(c.projects) ? c.projects : [],
    socialLinks,
    portfolio_url,
    availability,
  };
}

// ── Helper: check if an email already exists in the system for this user ──────
async function checkDuplicateEmail(email: string, jobId: string | undefined, userId: string | undefined) {
  if (!email || !userId) return {};
  const existing = await Applicant.findOne({ userId, email: email.trim().toLowerCase() }).select("jobId full_name");
  if (!existing) return {};
  const existingJobId = (existing as any).jobId?.toString();
  if (jobId && existingJobId === jobId.toString()) {
    return { duplicateWarnings: [(existing as any).full_name || email] };
  }
  return { crossJobMatches: [(existing as any).full_name || email] };
}

// POST /api/upload/candidates  — parse structured CSV/JSON or extract CV from file/URL
export const parseUploadedCandidates = async (req: Request, res: Response) => {
  try {
    const { job_id, cv_url } = req.body;

    // ── URL-based CV ───────────────────────────────────────────────────────────
    if (cv_url) {
      const rawText = await extractTextFromUrl(cv_url);
      const structured = await extractCV(rawText);
      if ((structured as any).error === "not_a_resume") {
        return res.status(422).json({ message: "The URL does not appear to contain a resume or CV." });
      }
      const validated = validateResume(structured);

      // FIX: check for duplicate by email before returning
      const duplicateWarning = await checkDuplicateEmail(validated.email, job_id, (req as any).user?.id);

      const candidate = { ...validated, sourceType: "url", cv_url, ...(job_id ? { jobId: job_id } : {}) };
      return res.json({ count: 1, candidates: [candidate], sourceType: "url", ...duplicateWarning });
    }

    if (!req.file) return res.status(400).json({ message: "No file or URL provided" });

    const { mimetype, originalname, buffer } = req.file;
    const ext = originalname.slice(originalname.lastIndexOf(".")).toLowerCase();

    // ── Structured bulk: CSV ───────────────────────────────────────────────────
    if (mimetype === "text/csv" || mimetype === "text/plain" || ext === ".csv") {
      const text = buffer.toString("utf-8");
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) return res.status(400).json({ message: "CSV appears empty or has no data rows" });

      // Proper CSV parser — respects quoted fields that contain commas
      // e.g. "React, Node.js, PostgreSQL" stays as one value
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"' && !inQuotes) {
            inQuotes = true;
          } else if (ch === '"' && inQuotes && line[i + 1] === '"') {
            current += '"'; i++; // escaped quote inside quoted field
          } else if (ch === '"' && inQuotes) {
            inQuotes = false;
          } else if (ch === "," && !inQuotes) {
            result.push(current.trim());
            current = "";
          } else {
            current += ch;
          }
        }
        result.push(current.trim());
        return result;
      };

      const headers = parseCSVLine(lines[0]).map(h => h.replace(/"/g, ""));
      const candidates: any[] = [];
      const parseErrors: string[] = [];
      for (const line of lines.slice(1)) {
        try {
          const values = parseCSVLine(line);
          const obj: any = {};
          headers.forEach((h: string, i: number) => { obj[h] = values[i] || ""; });
          if (job_id) obj.jobId = job_id;
          obj.sourceType = "csv";
          candidates.push({ ...normalizeCandidate(obj), sourceType: "csv", ...(job_id ? { jobId: job_id } : {}) });
        } catch (rowErr: any) {
          parseErrors.push(`Row skipped — ${rowErr.message}`);
        }
      }
      if (candidates.length === 0) {
        return res.status(422).json({ message: "No valid candidates could be parsed from the CSV.", errors: parseErrors });
      }
      return res.json({ count: candidates.length, candidates, sourceType: "csv", ...(parseErrors.length ? { parseErrors } : {}) });
    }

    // ── Structured bulk: JSON ──────────────────────────────────────────────────
    if (mimetype === "application/json" || ext === ".json") {
      const parsed = JSON.parse(buffer.toString("utf-8"));
      const raw = Array.isArray(parsed) ? parsed : [parsed];
      const candidates = raw.map((c: any) => ({ ...normalizeCandidate(c), sourceType: "json", ...(job_id ? { jobId: job_id } : {}) }));
      return res.json({ count: candidates.length, candidates, sourceType: "json" });
    }

    // ── CV file: PDF, Word, or image — AI extraction ──────────────────────────
    const rawText = await extractTextFromBuffer(buffer, mimetype, originalname);

    if (!rawText || rawText.trim().length < 50) {
      return res.status(422).json({ message: "Could not extract readable text from the file. If it's a scanned image, ensure the scan is clear." });
    }

    const structured = await extractCV(rawText);

    if ((structured as any).error === "not_a_resume") {
      return res.status(422).json({ message: "The uploaded file does not appear to be a resume or CV." });
    }

    const validated = validateResume(structured);

    // FIX: check for duplicate by email before returning
    const duplicateWarning = await checkDuplicateEmail(validated.email, job_id, (req as any).user?.id);

    const sourceType = ext === ".pdf" ? "pdf" : [".docx", ".doc"].includes(ext) ? "docx" : "image_ocr";
    const candidate = { ...validated, sourceType, ...(job_id ? { jobId: job_id } : {}) };
    return res.json({ count: 1, candidates: [candidate], sourceType, ...duplicateWarning });

  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message || "Error parsing upload" });
  }
};

// POST /api/upload/jobs — CSV or JSON only
export const parseUploadedJobs = async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const { mimetype, originalname, buffer } = req.file;
    const ext = originalname.slice(originalname.lastIndexOf(".")).toLowerCase();

    if (mimetype === "text/csv" || mimetype === "text/plain" || ext === ".csv") {
      const text = buffer.toString("utf-8");
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) return res.status(400).json({ message: "CSV appears empty or has no data rows" });

      // FIX: use proper quoted-CSV parser — handles commas inside quoted fields
      // (e.g. job descriptions like "Build, test, and deploy" stay as one value)
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"' && !inQuotes) {
            inQuotes = true;
          } else if (ch === '"' && inQuotes && line[i + 1] === '"') {
            current += '"'; i++;
          } else if (ch === '"' && inQuotes) {
            inQuotes = false;
          } else if (ch === "," && !inQuotes) {
            result.push(current.trim());
            current = "";
          } else {
            current += ch;
          }
        }
        result.push(current.trim());
        return result;
      };

      const headers = parseCSVLine(lines[0]).map(h => h.replace(/"/g, ""));
      const jobs = lines.slice(1).map(line => {
        const values = parseCSVLine(line);
        const obj: any = {};
        headers.forEach((h, i) => { obj[h] = values[i] || ""; });
        return obj;
      });
      return res.json({ count: jobs.length, jobs });
    }

    if (mimetype === "application/json" || ext === ".json") {
      const parsed = JSON.parse(buffer.toString("utf-8"));
      const jobs = Array.isArray(parsed) ? parsed : [parsed];
      return res.json({ count: jobs.length, jobs });
    }

    return res.status(400).json({ message: "Unsupported file type for job upload. Please use CSV or JSON." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error parsing job upload" });
  }
};
