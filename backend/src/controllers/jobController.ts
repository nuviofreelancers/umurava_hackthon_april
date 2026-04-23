import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import Job from "../models/Job";
import { AuthRequest } from "../middlewares/authMiddleware";

function isValidId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

// GET /api/jobs
export async function listJobs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const jobs = await Job.find({ userId: req.user!.id }).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    next(err);
  }
}

// GET /api/jobs/:id
export async function getJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ message: "Invalid job ID" });
      return;
    }

    const job = await Job.findOne({ _id: id, userId: req.user!.id });
    if (!job) {
      res.status(404).json({ message: "Job not found" });
      return;
    }
    res.json(job);
  } catch (err) {
    next(err);
  }
}

// POST /api/jobs
export async function createJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      title, department, location, employment_type, experience_level,
      description, required_skills, preferred_skills,
      salary_range_min, salary_range_max, currency_symbol, status,
      screening_weights,
    } = req.body as Record<string, unknown>;

    if (!title) {
      res.status(400).json({ message: "Job title is required" });
      return;
    }

    const job = await Job.create({
      title, department, location, employment_type, experience_level,
      description, required_skills, preferred_skills,
      salary_range_min, salary_range_max, currency_symbol, status,
      screening_weights,
      userId: req.user!.id,
    });

    res.status(201).json(job);
  } catch (err) {
    next(err);
  }
}

// PUT /api/jobs/:id
export async function updateJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ message: "Invalid job ID" });
      return;
    }

    const job = await Job.findOneAndUpdate(
      { _id: id, userId: req.user!.id },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!job) {
      res.status(404).json({ message: "Job not found" });
      return;
    }
    res.json(job);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/jobs/:id
export async function deleteJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ message: "Invalid job ID" });
      return;
    }

    const job = await Job.findOneAndDelete({ _id: id, userId: req.user!.id });
    if (!job) {
      res.status(404).json({ message: "Job not found" });
      return;
    }
    res.json({ message: "Job deleted successfully" });
  } catch (err) {
    next(err);
  }
}
