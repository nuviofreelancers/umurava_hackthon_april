import { Router } from "express";
import {
  listApplicants,
  getApplicant,
  createApplicant,
  bulkCreateApplicants,
  updateApplicant,
  deleteApplicant,
  restoreApplicant,
} from "../controllers/applicantController";
import { scheduleInterview, cancelInterview } from "../controllers/interviewController";
import { protect } from "../middlewares/authMiddleware";

const router = Router();

router.use(protect);

router.get("/",            listApplicants);
router.post("/",           createApplicant);
router.post("/bulk",       bulkCreateApplicants);

router.get("/:id",         getApplicant);
router.put("/:id",         updateApplicant);
router.delete("/:id",      deleteApplicant);
router.post("/:id/restore",restoreApplicant);

// Interview sub-routes
router.put("/:id/interview",        scheduleInterview);
router.put("/:id/interview/cancel", cancelInterview);

export default router;
