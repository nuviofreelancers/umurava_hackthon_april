import express from "express";
import {
  createApplicant,
  uploadCV,
  getApplicantsByJob,
  getApplicantById,
  deleteApplicant,
} from "../controllers/applicantController";
import { upload } from "../utils/upload";
import { protect } from "../middlewares/authMiddleware";

const applicationRouter = express.Router();

// ✅ Create manually
applicationRouter.post("/create-application/:jobId", protect, createApplicant);
// ✅ Upload CV (PDF)
applicationRouter.post("/:jobId/upload", protect, upload.single("file"), uploadCV);
// ✅ Get all applicants for a job
applicationRouter.get("/get-all-applications/:jobId", protect, getApplicantsByJob);
// ✅ Get single applicant
applicationRouter.get("/single-application/:id", protect, getApplicantById);
// ✅ Delete applicant
applicationRouter.delete("/delete-application/:id", protect, deleteApplicant);

export default applicationRouter;