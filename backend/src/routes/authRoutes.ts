import { Router } from "express";
import { login, getMe, updateMe } from "../controllers/authController";
import { protect } from "../middlewares/authMiddleware";

const router = Router();

router.post("/login", login);
router.get("/me",  protect, getMe);
router.put("/me",  protect, updateMe);

export default router;
