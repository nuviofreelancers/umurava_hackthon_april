import express from "express";
import {
  createApplicant,
  bulkCreateApplicants,
  getApplicants,
  getApplicantById,
  updateApplicant,
  deleteApplicant,
  restoreApplicant,
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
// BUG FIX #6: restore endpoint for undo
applicantRouter.post("/:id/restore", protect, restoreApplicant);

export default applicantRouter;

// Upload routes are mounted separately at /api/upload in server.ts
export const uploadRouter = express.Router();

// BUG FIX #1: use upload.single() with error handling — multer is optional for
// URL-only requests (cv_url in body). If multer errors due to no file, we still
// allow the request through so the cv_url path can be used.
const optionalFileUpload = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  upload.single("file")(req, res, (err: any) => {
    if (err && err.code === "LIMIT_UNEXPECTED_FILE") {
      // Multer couldn't find the field — that's fine for URL-only requests
      return next();
    }
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
};

uploadRouter.post("/candidates", protect, optionalFileUpload, parseUploadedCandidates);
uploadRouter.post("/jobs", protect, upload.single("file"), parseUploadedJobs);
