"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseUploadedJobs = exports.parseUploadedCandidates = exports.deleteApplicant = exports.updateApplicant = exports.getApplicantById = exports.getApplicants = exports.bulkCreateApplicants = exports.createApplicant = void 0;
const Applicant_1 = __importDefault(require("../models/Applicant"));
const ScreeningResult_1 = __importDefault(require("../models/ScreeningResult"));
const pdfParser_1 = require("../utils/pdfParser");
const aiService_1 = require("../services/aiService");
const resumeValidator_1 = require("../utils/resumeValidator");
const mongoose_1 = __importDefault(require("mongoose"));
// POST /api/applicants
const createApplicant = async (req, res) => {
    try {
        const applicant = await Applicant_1.default.create({ ...req.body, userId: req.user.id, sourceType: "manual" });
        res.status(201).json(applicant);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error creating applicant" });
    }
};
exports.createApplicant = createApplicant;
// POST /api/applicants/bulk
const bulkCreateApplicants = async (req, res) => {
    try {
        const { applicants, job_id, sourceType } = req.body;
        if (!Array.isArray(applicants) || applicants.length === 0) {
            return res.status(400).json({ message: "applicants must be a non-empty array" });
        }
        const docs = applicants.map((a) => ({
            ...a,
            userId: req.user.id,
            jobId: job_id ? new mongoose_1.default.Types.ObjectId(job_id) : undefined,
            sourceType: sourceType || a.sourceType || "manual",
        }));
        const inserted = await Applicant_1.default.insertMany(docs, { ordered: false });
        res.status(201).json(inserted);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error bulk importing applicants" });
    }
};
exports.bulkCreateApplicants = bulkCreateApplicants;
// GET /api/applicants
const getApplicants = async (req, res) => {
    try {
        const filter = { userId: req.user.id };
        if (req.query.job_id) {
            filter.jobId = new mongoose_1.default.Types.ObjectId(req.query.job_id);
        }
        const applicants = await Applicant_1.default.find(filter).sort({ createdAt: -1 });
        res.json(applicants);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching applicants" });
    }
};
exports.getApplicants = getApplicants;
// GET /api/applicants/:id
const getApplicantById = async (req, res) => {
    try {
        const applicant = await Applicant_1.default.findOne({ _id: req.params.id, userId: req.user.id });
        if (!applicant)
            return res.status(404).json({ message: "Applicant not found" });
        res.json(applicant);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching applicant" });
    }
};
exports.getApplicantById = getApplicantById;
// PUT /api/applicants/:id
const updateApplicant = async (req, res) => {
    try {
        const applicant = await Applicant_1.default.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, req.body, { returnDocument: "after", runValidators: false });
        if (!applicant)
            return res.status(404).json({ message: "Applicant not found" });
        res.json(applicant);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error updating applicant" });
    }
};
exports.updateApplicant = updateApplicant;
// DELETE /api/applicants/:id
const deleteApplicant = async (req, res) => {
    try {
        const applicant = await Applicant_1.default.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        if (!applicant)
            return res.status(404).json({ message: "Applicant not found" });
        await ScreeningResult_1.default.deleteMany({ applicant_id: req.params.id });
        res.json({ message: "Applicant deleted successfully" });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error deleting applicant" });
    }
};
exports.deleteApplicant = deleteApplicant;
// ── Helper: extract text from a buffer based on mimetype / extension ──────────
async function extractTextFromBuffer(buffer, mimetype, filename) {
    const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
    // PDF
    if (mimetype === "application/pdf" || ext === ".pdf") {
        return (0, pdfParser_1.parsePDF)(buffer);
    }
    // Word .docx
    if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        ext === ".docx") {
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
    if (["image/jpeg", "image/jpg", "image/png", "image/tiff", "image/webp"].includes(mimetype) ||
        [".jpg", ".jpeg", ".png", ".tiff", ".webp"].includes(ext)) {
        const Tesseract = require("tesseract.js");
        const { data: { text } } = await Tesseract.recognize(buffer, "eng", { logger: () => { } });
        return text;
    }
    throw new Error(`Cannot extract text from file type: ${mimetype}`);
}
// ── Helper: fetch and strip text from a URL ───────────────────────────────────
// ── Google Drive / Docs URL normalizer ───────────────────────────────────────
// Converts any Google Drive or Docs share URL into a direct-download URL.
// Returns null if the URL is not a Google Drive/Docs link.
function resolveGoogleUrl(url) {
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
    }
    catch {
        return null;
    }
}
async function extractTextFromUrl(url) {
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
            throw new Error(`Could not access the Google Drive file. Make sure it is shared as "Anyone with the link" (got ${res.status}).`);
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
            return (0, pdfParser_1.parsePDF)(buffer);
        }
    }
    // Plain text (Google Docs export=txt, .txt files)
    if (contentType.includes("text/plain") || googleResolved?.type === "html") {
        const text = await res.text();
        if (text.trim().length < 50)
            throw new Error("The document appears to be empty or too short to parse.");
        return text;
    }
    // Word document
    if (contentType.includes("application/vnd.openxmlformats") ||
        contentType.includes("application/msword")) {
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
    if (stripped.length < 100)
        throw new Error("Could not extract meaningful text from the URL. For Google Drive files, ensure the file is shared publicly.");
    return stripped;
}
// ── Umurava schema normalizer ─────────────────────────────────────────────────
// Maps the Umurava Talent Profile Schema fields to our internal DB schema.
// Handles both Umurava format (firstName/lastName, headline, etc.)
// and our own format (full_name, current_role, etc.) gracefully.
function normalizeCandidate(c) {
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
        education_field = latest["Field of Study"] || latest.field || "";
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
    // Skills: already in correct format {name, level, yearsOfExperience}
    const skills = (c.skills || []).map((s) => typeof s === "string" ? { name: s, level: "Intermediate", yearsOfExperience: 0 } : s);
    // Education array: normalise field names
    const education = (c.education || []).map((e) => ({
        institution: e.institution || "",
        degree: e.degree || "",
        field: e["Field of Study"] || e.field || "",
        year: String(e["End Year"] || e.year || ""),
    }));
    // Experience array: normalise field names
    const experience = (c.experience || []).map((e) => ({
        company: e.company || "",
        role: e.role || "",
        startDate: e["Start Date"] || e.startDate || "",
        endDate: e["End Date"] || e.endDate || "",
    }));
    // Certifications: normalise Issue Date → year
    const certifications = (c.certifications || []).map((cert) => ({
        name: cert.name || "",
        issuer: cert.issuer || "",
        year: cert["Issue Date"] || cert.year || "",
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
        languages: c.languages || [],
        projects: c.projects || [],
        socialLinks,
        portfolio_url,
        availability,
    };
}
// POST /api/upload/candidates  — parse structured CSV/JSON or extract CV from file/URL
const parseUploadedCandidates = async (req, res) => {
    try {
        const { job_id, cv_url } = req.body;
        // ── URL-based CV ───────────────────────────────────────────────────────────
        if (cv_url) {
            const rawText = await extractTextFromUrl(cv_url);
            const structured = await (0, aiService_1.extractCV)(rawText);
            if (structured.error === "not_a_resume") {
                return res.status(422).json({ message: "The URL does not appear to contain a resume or CV." });
            }
            const validated = (0, resumeValidator_1.validateResume)(structured);
            const candidate = { ...validated, sourceType: "url", cv_url, ...(job_id ? { jobId: job_id } : {}) };
            return res.json({ count: 1, candidates: [candidate], sourceType: "url" });
        }
        if (!req.file)
            return res.status(400).json({ message: "No file or URL provided" });
        const { mimetype, originalname, buffer } = req.file;
        const ext = originalname.slice(originalname.lastIndexOf(".")).toLowerCase();
        // ── Structured bulk: CSV ───────────────────────────────────────────────────
        if (mimetype === "text/csv" || mimetype === "text/plain" || ext === ".csv") {
            const text = buffer.toString("utf-8");
            const lines = text.split("\n").filter(l => l.trim());
            if (lines.length < 2)
                return res.status(400).json({ message: "CSV appears empty or has no data rows" });
            const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
            const candidates = lines.slice(1).map(line => {
                const values = line.split(",").map(v => v.trim().replace(/"/g, ""));
                const obj = {};
                headers.forEach((h, i) => { obj[h] = values[i] || ""; });
                if (job_id)
                    obj.jobId = job_id;
                obj.sourceType = "csv";
                return { ...normalizeCandidate(obj), sourceType: "csv", ...(job_id ? { jobId: job_id } : {}) };
            });
            return res.json({ count: candidates.length, candidates, sourceType: "csv" });
        }
        // ── Structured bulk: JSON ──────────────────────────────────────────────────
        if (mimetype === "application/json" || ext === ".json") {
            const parsed = JSON.parse(buffer.toString("utf-8"));
            const raw = Array.isArray(parsed) ? parsed : [parsed];
            const candidates = raw.map((c) => ({ ...normalizeCandidate(c), sourceType: "json", ...(job_id ? { jobId: job_id } : {}) }));
            return res.json({ count: candidates.length, candidates, sourceType: "json" });
        }
        // ── CV file: PDF, Word, or image — AI extraction ──────────────────────────
        const rawText = await extractTextFromBuffer(buffer, mimetype, originalname);
        if (!rawText || rawText.trim().length < 50) {
            return res.status(422).json({ message: "Could not extract readable text from the file. If it's a scanned image, ensure the scan is clear." });
        }
        const structured = await (0, aiService_1.extractCV)(rawText);
        if (structured.error === "not_a_resume") {
            return res.status(422).json({ message: "The uploaded file does not appear to be a resume or CV." });
        }
        const validated = (0, resumeValidator_1.validateResume)(structured);
        const sourceType = ext === ".pdf" ? "pdf" : [".docx", ".doc"].includes(ext) ? "docx" : "image_ocr";
        const candidate = { ...validated, sourceType, ...(job_id ? { jobId: job_id } : {}) };
        return res.json({ count: 1, candidates: [candidate], sourceType });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || "Error parsing upload" });
    }
};
exports.parseUploadedCandidates = parseUploadedCandidates;
// POST /api/upload/jobs — CSV or JSON only
const parseUploadedJobs = async (req, res) => {
    try {
        if (!req.file)
            return res.status(400).json({ message: "No file uploaded" });
        const { mimetype, originalname, buffer } = req.file;
        const ext = originalname.slice(originalname.lastIndexOf(".")).toLowerCase();
        if (mimetype === "text/csv" || mimetype === "text/plain" || ext === ".csv") {
            const text = buffer.toString("utf-8");
            const lines = text.split("\n").filter(l => l.trim());
            if (lines.length < 2)
                return res.status(400).json({ message: "CSV appears empty or has no data rows" });
            const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
            const jobs = lines.slice(1).map(line => {
                const values = line.split(",").map(v => v.trim().replace(/"/g, ""));
                const obj = {};
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
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error parsing job upload" });
    }
};
exports.parseUploadedJobs = parseUploadedJobs;
//# sourceMappingURL=applicantController.js.map