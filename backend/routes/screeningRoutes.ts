import express from "express";
import { runScreening } from "../controllers/screeningController";
import { protect } from "../middlewares/authMiddleware";

const screeningRouter = express.Router();

screeningRouter.post("/:jobId", protect, runScreening);

export default screeningRouter;