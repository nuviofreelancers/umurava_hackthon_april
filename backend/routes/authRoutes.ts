import express from "express";
import { login, register, getMe, updateMe } from "../controllers/authController";
import { protect } from "../middlewares/authMiddleware";

const authRouter = express.Router();

/* authRouter.post("/register", register); */
authRouter.post("/login", login);
authRouter.get("/me", protect, getMe);
authRouter.put("/me", protect, updateMe);

export default authRouter;
