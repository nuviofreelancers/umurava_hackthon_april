import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import Applicant from "../models/Applicant";
import { AuthRequest } from "../middlewares/authMiddleware";
import { sendInterviewEmail } from "../services/emailService";
import logger from "../utils/logger";

function isValidId(id: string): boolean {
  return id && id !== "undefined" ? mongoose.Types.ObjectId.isValid(id) : false;
}

// PUT /api/applicants/:id/interview
export async function scheduleInterview(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ message: "Invalid applicant ID" });
      return;
    }

    const { interview_date, interview_platform, interview_link, job_title } = req.body as {
      interview_date?: string;
      interview_platform?: string;
      interview_link?: string;
      job_title?: string;
    };

    if (!interview_date) {
      res.status(400).json({ message: "Interview date is required" });
      return;
    }

    const applicant = await Applicant.findOneAndUpdate(
      { _id: id, userId: req.user!.id, isDeleted: false },
      {
        $set: {
          interview_status:   "scheduled",
          interview_date:     new Date(interview_date),
          interview_platform: interview_platform ?? "",
          interview_link:     interview_link ?? "",
        },
      },
      { new: true }
    );

    if (!applicant) {
      res.status(404).json({ message: "Applicant not found" });
      return;
    }

    // Send email notification (non-blocking — log failure but don't fail the request)
    if (applicant.email) {
      sendInterviewEmail({
        to:            applicant.email,
        candidateName: applicant.full_name,
        jobTitle:      job_title ?? "Open Position",
        interviewDate: new Date(interview_date),
        platform:      interview_platform ?? "TBD",
        link:          interview_link,
      }).catch((err: Error) => logger.warn("Interview email failed:", err.message));
    }

    res.json(applicant);
  } catch (err) {
    next(err);
  }
}

// PUT /api/applicants/:id/interview/cancel
export async function cancelInterview(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ message: "Invalid applicant ID" });
      return;
    }

    const applicant = await Applicant.findOneAndUpdate(
      { _id: id, userId: req.user!.id, isDeleted: false },
      { $set: { interview_status: "cancelled" } },
      { new: true }
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
