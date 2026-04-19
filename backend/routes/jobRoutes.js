"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const jobController_1 = require("../controllers/jobController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const jobRouter = express_1.default.Router();
jobRouter.get("/", authMiddleware_1.protect, jobController_1.getJobs);
jobRouter.post("/", authMiddleware_1.protect, jobController_1.createJob);
jobRouter.get("/:id", authMiddleware_1.protect, jobController_1.getJobById);
jobRouter.put("/:id", authMiddleware_1.protect, jobController_1.updateJob);
jobRouter.delete("/:id", authMiddleware_1.protect, jobController_1.deleteJob);
exports.default = jobRouter;
//# sourceMappingURL=jobRoutes.js.map