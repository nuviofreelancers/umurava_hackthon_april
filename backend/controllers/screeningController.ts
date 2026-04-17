import { Request, Response } from "express";
import Job from "../models/Job";
import Applicant from "../models/Applicant";
import ScreeningResult from "../models/ScreeningResult";
import { screenAI } from "../services/aiService";
import mongoose from "mongoose"

export const runScreening = async (req: Request, res: Response) => {
  const { jobId } = req.params;

  const job = await Job.findById(jobId);
  const applicants = await Applicant.find({ jobId: new mongoose.Types.ObjectId(jobId as string) });

  const result = await screenAI(job, applicants);

  const saved = await ScreeningResult.create({
    jobId: new mongoose.Types.ObjectId(jobId as string),
    candidates: result.candidates,
  });

  res.json(saved);
};