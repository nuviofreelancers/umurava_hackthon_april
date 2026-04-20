import { Request, Response } from "express";
import Job from "../models/Job";
import Applicant from "../models/Applicant";
import ScreeningResult from "../models/ScreeningResult";
import { screenAI } from "../services/aiService";
import mongoose from "mongoose";

interface AuthRequest extends Request {
  user?: { id: string };
}


// Normalize gaps — AI may return strings or {description, type} objects
function normalizeGaps(gaps: any[]): { description: string; type: string }[] {
  if (!Array.isArray(gaps)) return [];
  return gaps.map(g => {
    if (typeof g === "string") return { description: g, type: "" };
    if (typeof g === "object" && g !== null) {
      return {
        description: g.description || g.text || g.gap || String(g),
        type: g.type || g.severity || "",
      };
    }
    return { description: String(g), type: "" };
  });
}

// POST /api/screen
export const runScreening = async (req: AuthRequest, res: Response) => {
  try {
    const { job_id, weights, shortlistSize } = req.body;
    if (!job_id) return res.status(400).json({ message: "job_id is required" });

    // Scope: only allow screening jobs owned by this user
    const job = await Job.findOne({ _id: job_id, userId: req.user!.id });
    if (!job) return res.status(404).json({ message: "Job not found" });

    const applicants = await Applicant.find({
      jobId: new mongoose.Types.ObjectId(job_id),
      userId: req.user!.id,
    });
    if (applicants.length === 0) {
      return res.status(400).json({ message: "No applicants found for this job" });
    }

    const effectiveWeights = weights || job.screening_weights || { skills: 25, experience: 25, education: 25, relevance: 25 };
    const effectiveShortlistSize = shortlistSize ? Number(shortlistSize) : applicants.length;

    // Run AI screening
    const aiResults = await screenAI(job, applicants, effectiveWeights, effectiveShortlistSize);

    // Delete prior results for this job
    await ScreeningResult.deleteMany({ job_id: new mongoose.Types.ObjectId(job_id) });

    // Save one document per candidate
    const savedResults = await ScreeningResult.insertMany(
      aiResults.map((r: any, idx: number) => ({
        job_id: new mongoose.Types.ObjectId(job_id),
        applicant_id: new mongoose.Types.ObjectId(r.applicant_id),
        applicant_name: r.applicant_name || "",
        rank: idx + 1,
        match_score: r.match_score ?? 0,
        skills_score: r.skills_score ?? 0,
        experience_score: r.experience_score ?? 0,
        education_score: r.education_score ?? 0,
        relevance_score: r.relevance_score ?? 0,
        confidence_level: r.confidence_level || "Medium",
        recommendation: r.recommendation || "",
        strengths: r.strengths || [],
        gaps: normalizeGaps(r.gaps || []),
        bias_flags: r.bias_flags || [],
      }))
    );

    await Job.findByIdAndUpdate(job_id, { last_screened_at: new Date() });

    // Return plain array — matches what the frontend slice expects
    res.json(savedResults);
  } catch (error) {
    console.error("Screening error:", error);
    res.status(500).json({ message: "Error running AI screening" });
  }
};

// GET /api/results
export const getResults = async (req: AuthRequest, res: Response) => {
  try {
    const filter: any = {};
    const jobIdParam  = req.query.job_id as string;
    const appIdParam  = req.query.applicant_id as string;

    if (jobIdParam && jobIdParam !== "undefined" && mongoose.Types.ObjectId.isValid(jobIdParam)) {
      filter.job_id = new mongoose.Types.ObjectId(jobIdParam);
      // Only return results for jobs owned by this user
      const job = await Job.findOne({ _id: jobIdParam, userId: req.user!.id });
      if (!job) return res.json([]);
    }
    if (appIdParam && appIdParam !== "undefined" && mongoose.Types.ObjectId.isValid(appIdParam)) {
      filter.applicant_id = new mongoose.Types.ObjectId(appIdParam);
    }

    const results = await ScreeningResult.find(filter).sort({ rank: 1 });
    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching results" });
  }
};

// DELETE /api/results/by-job/:jobId
export const deleteResultsByJob = async (req: AuthRequest, res: Response) => {
  try {
    const jobId = req.params.jobId;
    if (!jobId || Array.isArray(jobId)) return res.status(400).json({ message: "Invalid jobId" });
    const job = await Job.findOne({ _id: jobId, userId: req.user!.id });
    if (!job) return res.status(404).json({ message: "Job not found" });
    const { deletedCount } = await ScreeningResult.deleteMany({ job_id: new mongoose.Types.ObjectId(jobId) });
    res.json({ message: `${deletedCount} results deleted` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting results" });
  }
};

// DELETE /api/results/by-applicant/:id
export const deleteResultsByApplicant = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    if (!id || Array.isArray(id)) return res.status(400).json({ message: "Invalid id" });
    const { deletedCount } = await ScreeningResult.deleteMany({ applicant_id: new mongoose.Types.ObjectId(id) });
    res.json({ message: `${deletedCount} results deleted` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting results" });
  }
};
