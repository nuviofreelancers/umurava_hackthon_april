import express from "express";
import { notifyInterview } from "../controllers/interviewController";
import { protect } from "../middlewares/authMiddleware";

const interviewRouter = express.Router();
interviewRouter.post("/notify", protect, notifyInterview);

export default interviewRouter;
