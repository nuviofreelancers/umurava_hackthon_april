import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import Applicant from "../models/Applicant";
import { AuthRequest } from "../middlewares/authMiddleware";
import { parseFileToCandidate, parseUrlToCandidate } from "../utils/resumeParser";
import { normalizeCandidate } from "../utils/normalizeCandidate";
import logger from "../utils/logger";

function isValidId(id: string): boolean {
  return id && id !== "undefined" ? mongoose.Types.ObjectId.isValid(id) : false;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

// GET /api/applicants
export async function listApplicants(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { job_id, page = "1", limit = "30" } = req.query as Record<string, string>;
    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip     = (pageNum - 1) * limitNum;

    const filter: Record<string, unknown> = { userId: req.user!.id, isDeleted: false };
    if (job_id && isValidId(job_id)) filter.jobId = job_id;

    const [applicants, total] = await Promise.all([
      Applicant.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Applicant.countDocuments(filter),
    ]);

    logger.info(`[listApplicants] user=${req.user!.id} job_id=${job_id ?? 'all'} page=${pageNum} → found=${applicants.length} total=${total}`);

    res.set("X-Total-Count", String(total));
    res.set("X-Page", String(pageNum));
    res.set("X-Limit", String(limitNum));
    res.json(applicants);
  } catch (err) {
    next(err);
  }
}

// GET /api/applicants/:id
export async function getApplicant(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ message: "Invalid applicant ID" });
      return;
    }

    const applicant = await Applicant.findOne({ _id: id, userId: req.user!.id, isDeleted: false });
    if (!applicant) {
      res.status(404).json({ message: "Applicant not found" });
      return;
    }
    res.json(applicant);
  } catch (err) {
    next(err);
  }
}

// POST /api/applicants
export async function createApplicant(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, unknown>;
    if (!body.full_name && !(body.first_name && body.last_name)) {
      res.status(400).json({ message: "Candidate name is required" });
      return;
    }
    if (!body.email) {
      res.status(400).json({ message: "Candidate email is required" });
      return;
    }

    const normalized = normalizeCandidate(body);

    // Accept jobId from either camelCase or snake_case field
    const rawJobId = (body.jobId ?? body.job_id) as string | undefined;
    const jobIdField = rawJobId && isValidId(rawJobId) ? { jobId: rawJobId } : {};

    logger.info(`[createApplicant] user=${req.user!.id} name="${normalized.full_name}" email="${normalized.email}" jobId=${rawJobId ?? 'none'}`);

    const applicant = await Applicant.create({
      ...normalized,
      ...jobIdField,
      userId: req.user!.id,
      sourceType: "manual",
    });

    logger.info(`[createApplicant] created applicant id=${applicant.id}`);
    res.status(201).json(applicant);
  } catch (err) {
    next(err);
  }
}

// POST /api/applicants/bulk
export async function bulkCreateApplicants(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { applicants: raw, job_id, sourceType } = req.body as {
      applicants: Array<Record<string, unknown>>;
      job_id?: string;
      sourceType?: string;
    };

    if (!Array.isArray(raw) || raw.length === 0) {
      res.status(400).json({ message: "No candidates provided" });
      return;
    }

    // Also accept jobId from within individual candidate objects (sent by CandidateCsvPreview)
    const resolvedJobId = job_id || String((raw[0] as Record<string, unknown>)?.jobId ?? "");
    const effectiveJobId = resolvedJobId && isValidId(resolvedJobId) ? resolvedJobId : undefined;

    logger.info(`[bulkCreate] user=${req.user!.id} incoming=${raw.length} effectiveJobId=${effectiveJobId ?? "none"} sourceType=${sourceType ?? "manual"}`);

    // Candidates without emails cannot be deduped or saved reliably — separate them
    const withEmail    = raw.filter((a) => String(a.email ?? "").trim());
    const withoutEmail = raw.filter((a) => !String(a.email ?? "").trim());
    if (withoutEmail.length > 0) {
      logger.warn(`[bulkCreate] ${withoutEmail.length} candidate(s) have no email and will be skipped`);
    }

    // Deduplicate ONLY within the same job+user — not globally
    // This allows the same candidate to be in multiple jobs
    const emails = withEmail.map((a) => String(a.email).toLowerCase().trim());
    const existingEmails = new Set<string>();

    if (emails.length > 0) {
      const existingFilter: Record<string, unknown> = { email: { $in: emails }, userId: req.user!.id, isDeleted: false };
      if (effectiveJobId) existingFilter.jobId = effectiveJobId;
      const existing = await Applicant.find(existingFilter).select("email");
      existing.forEach((e) => existingEmails.add(e.email.toLowerCase()));
      if (existingEmails.size > 0) logger.info(`[bulkCreate] ${existingEmails.size} duplicate(s) in this job — skipping`);
    }

    const toInsert = withEmail
      .map((a) => normalizeCandidate(a))
      .filter((a) => !existingEmails.has(String(a.email ?? "").toLowerCase().trim()))
      .map((a) => ({
        ...a,
        userId: req.user!.id,
        ...(effectiveJobId ? { jobId: effectiveJobId } : {}),
        sourceType: sourceType ?? "manual",
      }));

    const skipped = raw.length - toInsert.length;
    logger.info(`[bulkCreate] toInsert=${toInsert.length} skipped=${skipped}`);

    if (toInsert.length === 0) {
      logger.warn(`[bulkCreate] nothing to insert — all were duplicates or missing email`);
      // Return empty array (not 0) so Redux slice can handle it consistently
      res.json({ inserted: [], skipped, message: "All candidates already exist or have no email" });
      return;
    }

    const inserted = await Applicant.insertMany(toInsert, { ordered: false });
    logger.info(`[bulkCreate] inserted ${inserted.length} applicants`);
    res.status(201).json({ inserted, skipped });
  } catch (err) {
    next(err);
  }
}

// PUT /api/applicants/:id
export async function updateApplicant(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ message: "Invalid applicant ID" });
      return;
    }

    const applicant = await Applicant.findOneAndUpdate(
      { _id: id, userId: req.user!.id, isDeleted: false },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!applicant) {
      res.status(404).json({ message: "Applicant not found" });
      return;
    }
    res.json(applicant);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/applicants/:id  (soft delete)
export async function deleteApplicant(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ message: "Invalid applicant ID" });
      return;
    }

    const applicant = await Applicant.findOneAndUpdate(
      { _id: id, userId: req.user!.id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true }
    );

    if (!applicant) {
      res.status(404).json({ message: "Applicant not found" });
      return;
    }
    res.json({ message: "Applicant deleted", id });
  } catch (err) {
    next(err);
  }
}

// POST /api/applicants/:id/restore  (undo delete)
export async function restoreApplicant(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ message: "Invalid applicant ID" });
      return;
    }

    const applicant = await Applicant.findOneAndUpdate(
      { _id: id, userId: req.user!.id, isDeleted: true },
      { $set: { isDeleted: false }, $unset: { deletedAt: "" } },
      { new: true }
    );

    if (!applicant) {
      res.status(404).json({ message: "Applicant not found or was not deleted" });
      return;
    }
    res.json(applicant);
  } catch (err) {
    next(err);
  }
}

// ─── UPLOAD HANDLERS ──────────────────────────────────────────────────────────

// POST /api/upload/candidates
export async function parseUploadedCandidates(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { job_id, cv_url } = req.body as { job_id?: string; cv_url?: string };

    // ── Branch: URL upload (AI-free scrape) ──────────────────────────────────
    if (cv_url) {
      const candidate = await parseUrlToCandidate(cv_url);
      if (!candidate.email && !candidate.full_name) {
        res.status(422).json({ message: "The URL does not appear to contain a resume" });
        return;
      }
      const normalized = normalizeCandidate(candidate as unknown as Record<string, unknown>);
      return res.json({ count: 1, candidates: [{ ...normalized, sourceType: "url" }], sourceType: "url" }) as unknown as void;
    }

    // ── Branch: File upload ───────────────────────────────────────────────────
    const file = (req as AuthRequest & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ message: "No file or URL provided" });
      return;
    }

    const ext = file.originalname.toLowerCase().split(".").pop() ?? "";

    // ── CSV: parse rows directly ──────────────────────────────────────────────
    if (ext === "csv" || file.mimetype === "text/csv") {
      const text = file.buffer.toString("utf-8");
      const lines = text.split(/\r?\n/).filter(Boolean);
      const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      const candidates = lines.slice(1).map((line) => {
        const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = values[i] ?? ""; });
        return obj;
      });
      res.json({ count: candidates.length, candidates, sourceType: "csv" });
      return;
    }

    // ── JSON: normalize directly ──────────────────────────────────────────────
    if (ext === "json" || file.mimetype === "application/json") {
      const parsed = JSON.parse(file.buffer.toString("utf-8")) as unknown;
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      const normalized = candidates.map((c) => normalizeCandidate(c as Record<string, unknown>));
      res.json({ count: normalized.length, candidates: normalized, sourceType: "json" });
      return;
    }

    // ── PDF / DOCX / Image: AI-free heuristic parsing ────────────────────────
    const candidate = await parseFileToCandidate(file.buffer, file.mimetype, file.originalname);

    if (!candidate.email && !candidate.full_name) {
      res.status(422).json({ message: "Could not extract candidate data — check the file is a readable resume" });
      return;
    }

    const normalized = normalizeCandidate(candidate as unknown as Record<string, unknown>);
    res.json({ count: 1, candidates: [normalized], sourceType: candidate.sourceType });
  } catch (err: unknown) {
    const error = err as Error & { status?: number };
    logger.error("parseUploadedCandidates error:", error.message);
    if (error.message?.includes("too short") || error.message?.includes("empty")) {
      res.status(422).json({ message: "File appears to be empty or image-only — try a text-based PDF or DOCX" });
      return;
    }
    next(err);
  }
}

// POST /api/upload/jobs
export async function parseUploadedJobs(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const file = (req as AuthRequest & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }

    const ext = file.originalname.toLowerCase().split(".").pop() ?? "";

    if (ext === "json" || file.mimetype === "application/json") {
      const parsed = JSON.parse(file.buffer.toString("utf-8")) as unknown;
      const jobs = Array.isArray(parsed) ? parsed : [parsed];
      res.json({ count: jobs.length, jobs });
      return;
    }

    if (ext === "csv" || file.mimetype === "text/csv" || file.mimetype === "text/plain") {
      const text = file.buffer.toString("utf-8");
      const lines = text.split(/\r?\n/).filter(Boolean);
      const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      const jobs = lines.slice(1).map((line) => {
        const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = values[i] ?? ""; });
        return obj;
      });
      res.json({ count: jobs.length, jobs });
      return;
    }

    res.status(400).json({ message: "Job files must be CSV or JSON" });
  } catch (err) {
    next(err);
  }
}
