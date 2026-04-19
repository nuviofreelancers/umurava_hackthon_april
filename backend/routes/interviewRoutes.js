"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const interviewController_1 = require("../controllers/interviewController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const interviewRouter = express_1.default.Router();
interviewRouter.post("/notify", authMiddleware_1.protect, interviewController_1.notifyInterview);
exports.default = interviewRouter;
//# sourceMappingURL=interviewRoutes.js.map