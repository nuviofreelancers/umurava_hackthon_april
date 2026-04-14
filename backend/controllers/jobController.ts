import { Request, Response } from "express";
import Job from "../models/Job";

// ✅ Create Job
export const createJob = async (req: Request, res: Response) => {
  try {
    const { title, requiredSkills, experienceLevel, education } = req.body;
    // basic validation
    if (!title || !experienceLevel || !education) {
      return res.status(400).json({
        message: "Please provide all required fields",
      });
    }
    if (!Array.isArray(requiredSkills)) {
    return res.status(400).json({
      message: "requiredSkills must be an array",
    });
  }

    const job = await Job.create({
      title,
      requiredSkills,
      experienceLevel,
      education,
    });

    res.status(201).json({
      message: "Job created successfully",
      job,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while creating job" });
  }
};

//  Get All Jobs
export const getJobs = async (_req: Request, res: Response) => {
  try {
    const jobs = await Job.find().sort({ createdAt: -1 });
    res.json({
      count: jobs.length,
      jobs,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while fetching jobs" });
  }
};

//  Get Single Job
export const getJobById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    res.json(job);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching job" });
  }
};

//  Update Job
export const updateJob = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const job = await Job.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    res.json({
      message: "Job updated successfully",
      job,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating job" });
  }
};

//  Delete Job
export const deleteJob = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const job = await Job.findByIdAndDelete(id);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    res.json({
      message: "Job deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting job" });
  }
};