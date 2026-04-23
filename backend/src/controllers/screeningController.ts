import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import Applicant from "../models/Applicant";
import Job from "../models/Job";
import ScreeningResult, { IGap } from "../models/ScreeningResult";
import { AuthRequest } from "../middlewares/authMiddleware";
import { screenAI, ScreeningResultAI } from "../services/aiService";
import logger from "../utils/logger";

function isValidId(id: string): boolean {
  return id && id !== "undefined" ? mongoose.Types.ObjectId.isValid(id) : false;
}

/** Normalize AI gap output — handles both string[] and object[] from the AI */
function normalizeGaps(raw: unknown): IGap[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((g) => {
    if (typeof g === "string") return { description: g, type: "" as const };
    const go = g as Record<string, unknown>;
    return {
      description: String(go.description ?? go.gap ?? g ?? ""),
      type: (["dealbreaker", "nice-to-have"].includes(String(go.type ?? "")) ? go.type : "") as IGap["type"],
    };
  }).filter((g) => g.description);
}

// POST /api/screen
export async function runScreening(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { job_id, weights, shortlistSize } = req.body as {
      job_id?: string;
      weights?: { skills: number; experience: number; education: number; relevance: number };
      shortlistSize?: number;
    };

    if (!job_id || !isValidId(job_id)) {
      res.status(400).json({ message: "A valid job_id is required" });
      return;
    }

    if (!weights || typeof weights !== "object") {
      res.status(400).json({ message: "Screening weights are required" });
      return;
    }

    const weightTotal = (weights.skills ?? 0) + (weights.experience ?? 0) + (weights.education ?? 0) + (weights.relevance ?? 0);
    if (weightTotal <= 0) {
      res.status(400).json({ message: "Screening weights must sum to a positive number" });
      return;
    }

    // Fetch job — ensure it belongs to this user
    const job = await Job.findOne({ _id: job_id, userId: req.user!.id });
    if (!job) {
      res.status(404).json({ message: "Job not found" });
      return;
    }

    // Fetch all active candidates for this job
    const applicants = await Applicant.find({ jobId: job_id, userId: req.user!.id, isDeleted: false });

    if (applicants.length === 0) {
      res.status(400).json({ message: "No candidates found for this job — add candidates before screening" });
      return;
    }

    logger.info(`Running AI screening for job "${job.title}" — ${applicants.length} candidates`);

    // Call Gemini
    const aiResults: ScreeningResultAI[] = await screenAI(
      {
        _id:              job.id,
        title:            job.title,
        description:      job.description,
        required_skills:  job.required_skills,
        preferred_skills: job.preferred_skills,
        experience_level: job.experience_level,
        employment_type:  job.employment_type,
        department:       job.department,
      },
      applicants.map((a) => ({
        _id:              a.id,
        full_name:        a.full_name,
        headline:         a.headline,
        skills:           a.skills,
        experience:       a.experience,
        education:        a.education,
        experience_years: a.experience_years,
        education_level:  a.education_level,
        certifications:   a.certifications,
        projects:         a.projects,
        languages:        a.languages,
        location:         a.location,
        availability:     a.availability,
      })),
      weights,
      shortlistSize
    );

    // Delete old results and insert fresh ones atomically
    await ScreeningResult.deleteMany({ job_id });

    const docs = aiResults
      .filter((r) => isValidId(r.applicant_id))
      .map((r) => ({
        job_id:           job_id,
        applicant_id:     r.applicant_id,
        applicant_name:   r.applicant_name,
        rank:             r.rank,
        match_score:      Math.round(Math.min(100, Math.max(0, r.match_score))),
        skills_score:     Math.round(Math.min(100, Math.max(0, r.skills_score ?? 0))),
        experience_score: Math.round(Math.min(100, Math.max(0, r.experience_score ?? 0))),
        education_score:  Math.round(Math.min(100, Math.max(0, r.education_score ?? 0))),
        relevance_score:  Math.round(Math.min(100, Math.max(0, r.relevance_score ?? 0))),
        confidence_level: r.confidence_level ?? "Medium",
        recommendation:   r.recommendation ?? "Maybe",
        strengths:        Array.isArray(r.strengths) ? r.strengths : [],
        gaps:             normalizeGaps(r.gaps),
        bias_flags:       Array.isArray(r.bias_flags) ? r.bias_flags : [],
      }));

    const inserted = await ScreeningResult.insertMany(docs);

    // Update job's screening_weights and last_screened_at
    await Job.findByIdAndUpdate(job_id, {
      $set: { screening_weights: weights, last_screened_at: new Date() },
    });

    logger.info(`Screening complete for job "${job.title}" — ${inserted.length} results saved`);
    res.json(inserted);
  } catch (err) {
    next(err);
  }
}

// GET /api/results
export async function listResults(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { job_id, applicant_id } = req.query as Record<string, string>;

    // Scope results to jobs owned by this user — prevents cross-user data leakage
    const userJobIds = await Job.find({ userId: req.user!.id }).select("_id");
    const ownedJobIds = userJobIds.map((j) => j._id);

    const filter: Record<string, unknown> = { job_id: { $in: ownedJobIds } };
    if (job_id && isValidId(job_id))             filter.job_id = job_id;
    if (applicant_id && isValidId(applicant_id)) filter.applicant_id = applicant_id;

    logger.info(`[listResults] user=${req.user!.id} job_id=${job_id ?? "all"} → owned jobs=${ownedJobIds.length}`);
    const results = await ScreeningResult.find(filter).sort({ rank: 1 });
    res.json(results);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/results/by-job/:jobId
export async function deleteResultsByJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { jobId } = req.params;
    if (!isValidId(jobId)) {
      res.status(400).json({ message: "Invalid job ID" });
      return;
    }
    // Only delete results belonging to jobs owned by this user
    const job = await Job.findOne({ _id: jobId, userId: req.user!.id });
    if (!job) { res.status(404).json({ message: "Job not found" }); return; }
    const result = await ScreeningResult.deleteMany({ job_id: jobId });
    res.json({ message: `Deleted ${result.deletedCount} screening results` });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/results/by-applicant/:applicantId
export async function deleteResultsByApplicant(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { applicantId } = req.params;
    if (!isValidId(applicantId)) {
      res.status(400).json({ message: "Invalid applicant ID" });
      return;
    }
    const result = await ScreeningResult.deleteMany({ applicant_id: applicantId });
    res.json({ message: `Deleted ${result.deletedCount} screening results` });
  } catch (err) {
    next(err);
  }
}
