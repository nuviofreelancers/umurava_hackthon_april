import express from "express";
import {
  createJob,
  getJobs,
  getJobById,
  updateJob,
  deleteJob,
} from "../controllers/jobController";
import { protect } from "../middlewares/authMiddleware";

const jobRouter = express.Router();

jobRouter.post("/create-job", protect, createJob);
jobRouter.get("/get-all-jobs", getJobs);
jobRouter.get("/single-job/:id", getJobById);
jobRouter.put("/update-job/:id", protect, updateJob);
jobRouter.delete("/delete-job/:id", protect, deleteJob);

export default jobRouter;