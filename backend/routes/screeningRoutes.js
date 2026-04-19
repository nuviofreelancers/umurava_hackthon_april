"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.screenRouter = void 0;
const express_1 = __importDefault(require("express"));
const screeningController_1 = require("../controllers/screeningController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const screeningRouter = express_1.default.Router();
// Results CRUD
screeningRouter.get("/", authMiddleware_1.protect, screeningController_1.getResults);
screeningRouter.delete("/by-job/:jobId", authMiddleware_1.protect, screeningController_1.deleteResultsByJob);
screeningRouter.delete("/by-applicant/:id", authMiddleware_1.protect, screeningController_1.deleteResultsByApplicant);
exports.default = screeningRouter;
exports.screenRouter = express_1.default.Router();
exports.screenRouter.post("/", authMiddleware_1.protect, screeningController_1.runScreening);
//# sourceMappingURL=screeningRoutes.js.map