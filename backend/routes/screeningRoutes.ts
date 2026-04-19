import express from "express";
import { runScreening, getResults, deleteResultsByJob, deleteResultsByApplicant } from "../controllers/screeningController";
import { protect } from "../middlewares/authMiddleware";

const screeningRouter = express.Router();

// Results CRUD
screeningRouter.get("/", protect, getResults);
screeningRouter.delete("/by-job/:jobId", protect, deleteResultsByJob);
screeningRouter.delete("/by-applicant/:id", protect, deleteResultsByApplicant);

export default screeningRouter;

export const screenRouter = express.Router();
screenRouter.post("/", protect, runScreening);
