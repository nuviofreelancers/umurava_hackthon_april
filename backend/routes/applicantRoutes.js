"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadRouter = void 0;
const express_1 = __importDefault(require("express"));
const applicantController_1 = require("../controllers/applicantController");
const upload_1 = require("../utils/upload");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const applicantRouter = express_1.default.Router();
applicantRouter.get("/", authMiddleware_1.protect, applicantController_1.getApplicants);
applicantRouter.post("/", authMiddleware_1.protect, applicantController_1.createApplicant);
applicantRouter.post("/bulk", authMiddleware_1.protect, applicantController_1.bulkCreateApplicants);
applicantRouter.get("/:id", authMiddleware_1.protect, applicantController_1.getApplicantById);
applicantRouter.put("/:id", authMiddleware_1.protect, applicantController_1.updateApplicant);
applicantRouter.delete("/:id", authMiddleware_1.protect, applicantController_1.deleteApplicant);
exports.default = applicantRouter;
// Upload routes are mounted separately at /api/upload in server.ts
exports.uploadRouter = express_1.default.Router();
exports.uploadRouter.post("/candidates", authMiddleware_1.protect, upload_1.upload.single("file"), applicantController_1.parseUploadedCandidates);
exports.uploadRouter.post("/jobs", authMiddleware_1.protect, upload_1.upload.single("file"), applicantController_1.parseUploadedJobs);
//# sourceMappingURL=applicantRoutes.js.map