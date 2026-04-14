import { Request, Response } from "express";
import Applicant from "../models/Applicant";
import { parsePDF } from "../utils/pdfParser";
import { extractCV } from "../services/aiService";
import mongoose from "mongoose";

// ✅ 1. Create Applicant (Manual JSON)
export const createApplicant = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    if (!jobId || Array.isArray(jobId)) {
    return res.status(400).json({ message: "Invalid jobId" });
  }

    const applicant = await Applicant.create({
      ...req.body,
      jobId: new mongoose.Types.ObjectId(jobId),
      sourceType: "manual",
    });

    res.status(201).json({
      message: "Applicant created successfully",
      applicant,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating applicant" });
  }
};

// ✅ 2. Upload CV (PDF → AI → DB)
export const uploadCV = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // 📄 Extract text
    const rawText = await parsePDF(req.file.buffer);

    // 🤖 AI extraction
    const structuredData = await extractCV(rawText);

    // ✅ FIX skills
    const formattedSkills = (structuredData.skills || []).map((skill: any) => {
      if (typeof skill === "string") {
        return {
          name: skill,
          level: "Unknown",
          yearsOfExperience: 0,
        };
      }
      return skill;
    });

    // 💾 Save
    const applicant = await Applicant.create({
      ...structuredData,
      skills: formattedSkills, // ✅ IMPORTANT
      jobId,
      rawText,
      sourceType: "pdf",
    });

    res.status(201).json({
      message: "CV uploaded and processed successfully",
      applicant,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error processing CV" });
  }
};

// ✅ 3. Get All Applicants for a Job
export const getApplicantsByJob = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const applicants = await Applicant.find({
    jobId: new mongoose.Types.ObjectId(jobId as string)
  }).sort({ createdAt: -1 });

    res.json({
      count: applicants.length,
      applicants,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching applicants" });
  }
};

// ✅ 4. Get Single Applicant
export const getApplicantById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const applicant = await Applicant.findById(id);

    if (!applicant) {
      return res.status(404).json({ message: "Applicant not found" });
    }

    res.json(applicant);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching applicant" });
  }
};

// ✅ 5. Delete Applicant
export const deleteApplicant = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const applicant = await Applicant.findByIdAndDelete(id);
    if (!applicant) {
      return res.status(404).json({ message: "Applicant not found" });
    }
    res.json({
      message: "Applicant deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting applicant" });
  }
};