import { Request, Response } from "express";
import Job from "../models/Job";
import Applicant from "../models/Applicant";
import ScreeningResult from "../models/ScreeningResult";

interface AuthRequest extends Request {
  user?: { id: string };
}

// POST /api/jobs
export const createJob = async (req: AuthRequest, res: Response) => {
  try {
    const job = await Job.create({ ...req.body, userId: req.user!.id });
    res.status(201).json(job);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while creating job" });
  }
};

// GET /api/jobs
export const getJobs = async (req: AuthRequest, res: Response) => {
  try {
    const jobs = await Job.find({ userId: req.user!.id }).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while fetching jobs" });
  }
};

// GET /api/jobs/:id
export const getJobById = async (req: AuthRequest, res: Response) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, userId: req.user!.id });
    if (!job) return res.status(404).json({ message: "Job not found" });
    res.json(job);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching job" });
  }
};

// PUT /api/jobs/:id
export const updateJob = async (req: AuthRequest, res: Response) => {
  try {
    const job = await Job.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.id },
      req.body,
      { returnDocument: "after", runValidators: false }
    );
    if (!job) return res.status(404).json({ message: "Job not found" });
    res.json(job);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating job" });
  }
};

// DELETE /api/jobs/:id
export const deleteJob = async (req: AuthRequest, res: Response) => {
  try {
    const job = await Job.findOneAndDelete({ _id: req.params.id, userId: req.user!.id });
    if (!job) return res.status(404).json({ message: "Job not found" });
    const id = req.params.id;
    if (!id) return res.status(400).json({ message: "Missing id" });
    await ScreeningResult.deleteMany({ job_id: id });
    await Applicant.deleteMany({ jobId: id });
    res.json({ message: "Job deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting job" });
  }
};
