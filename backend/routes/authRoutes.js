"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authController_1 = require("../controllers/authController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const authRouter = express_1.default.Router();
/* authRouter.post("/register", register); */
authRouter.post("/login", authController_1.login);
authRouter.get("/me", authMiddleware_1.protect, authController_1.getMe);
authRouter.put("/me", authMiddleware_1.protect, authController_1.updateMe);
exports.default = authRouter;
//# sourceMappingURL=authRoutes.js.map