import { Router } from "express";
import {
  runScreening,
  listResults,
  deleteResultsByJob,
  deleteResultsByApplicant,
} from "../controllers/screeningController";
import { protect } from "../middlewares/authMiddleware";

const screenRouter = Router();
const resultsRouter = Router();

screenRouter.use(protect);
resultsRouter.use(protect);

// POST /api/screen
screenRouter.post("/", runScreening);

// GET  /api/results
// GET  /api/results?job_id=...
// GET  /api/results?applicant_id=...
resultsRouter.get("/", listResults);
resultsRouter.delete("/by-job/:jobId",           deleteResultsByJob);
resultsRouter.delete("/by-applicant/:applicantId", deleteResultsByApplicant);

export { screenRouter, resultsRouter };
