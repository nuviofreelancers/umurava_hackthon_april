import express from "express";
import {
  createApplicant,
  bulkCreateApplicants,
  getApplicants,
  getApplicantById,
  updateApplicant,
  deleteApplicant,
  parseUploadedCandidates,
  parseUploadedJobs
} from "../controllers/applicantController";
import { upload } from "../utils/upload";
import { protect } from "../middlewares/authMiddleware";

const applicantRouter = express.Router();

applicantRouter.get("/", protect, getApplicants);
applicantRouter.post("/", protect, createApplicant);
applicantRouter.post("/bulk", protect, bulkCreateApplicants);
applicantRouter.get("/:id", protect, getApplicantById);
applicantRouter.put("/:id", protect, updateApplicant);
applicantRouter.delete("/:id", protect, deleteApplicant);

export default applicantRouter;

// Upload routes are mounted separately at /api/upload in server.ts
export const uploadRouter = express.Router();
uploadRouter.post("/candidates", protect, upload.single("file"), parseUploadedCandidates);
uploadRouter.post("/jobs", protect, upload.single("file"), parseUploadedJobs);
