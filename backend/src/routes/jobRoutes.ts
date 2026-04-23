import { Router } from "express";
import { listJobs, getJob, createJob, updateJob, deleteJob } from "../controllers/jobController";
import { protect } from "../middlewares/authMiddleware";

const router = Router();

router.use(protect);

router.get("/",      listJobs);
router.get("/:id",   getJob);
router.post("/",     createJob);
router.put("/:id",   updateJob);
router.delete("/:id",deleteJob);

export default router;
