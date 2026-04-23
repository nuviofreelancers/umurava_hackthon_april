import { Router } from "express";
import rateLimit from "express-rate-limit";
import { parseUploadedCandidates, parseUploadedJobs } from "../controllers/applicantController";
import { protect } from "../middlewares/authMiddleware";
import { upload } from "../utils/upload";

// Stricter rate limit for AI upload endpoints (they cost money)
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.UPLOAD_RATE_LIMIT_MAX ?? "10", 10),
  message: { message: "AI service is busy — please wait before uploading again" },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

router.use(protect);

router.post(
  "/candidates",
  uploadLimiter,
  (req, res, next) => {
    // If body has cv_url, skip multer (JSON body)
    const body = req.body as Record<string, unknown>;
    if (body?.cv_url || req.headers["content-type"]?.includes("application/json")) {
      return next();
    }
    return upload.single("file")(req, res, next);
  },
  parseUploadedCandidates
);

router.post("/jobs", upload.single("file"), parseUploadedJobs);

export default router;
