import express from "express";
import { createJob, getJobs, getJobById, updateJob, deleteJob } from "../controllers/jobController";
import { protect } from "../middlewares/authMiddleware";

const jobRouter = express.Router();

jobRouter.get("/",    protect, getJobs);
jobRouter.post("/",   protect, createJob);
jobRouter.get("/:id", protect, getJobById);
jobRouter.put("/:id", protect, updateJob);
jobRouter.delete("/:id", protect, deleteJob);

export default jobRouter;
