"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const db_1 = require("./config/db");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const jobRoutes_1 = __importDefault(require("./routes/jobRoutes"));
const applicantRoutes_1 = __importDefault(require("./routes/applicantRoutes"));
const applicantRoutes_2 = require("./routes/applicantRoutes");
const screeningRoutes_1 = __importDefault(require("./routes/screeningRoutes"));
const screeningRoutes_2 = require("./routes/screeningRoutes");
const interviewRoutes_1 = __importDefault(require("./routes/interviewRoutes"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
// ── Middleware ───────────────────────────────────────────────────────────────
app.use((0, cors_1.default)({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express_1.default.json({ limit: "10mb" }));
// ── Routes ───────────────────────────────────────────────────────────────────
app.get("/", (_req, res) => res.send("Backend running 🚀"));
app.use("/api/auth", authRoutes_1.default);
app.use("/api/jobs", jobRoutes_1.default);
app.use("/api/applicants", applicantRoutes_1.default);
app.use("/api/upload", applicantRoutes_2.uploadRouter);
app.use("/api/results", screeningRoutes_1.default);
app.use("/api/screen", screeningRoutes_2.screenRouter);
app.use("/api/interviews", interviewRoutes_1.default);
// ── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ message: "Internal server error" });
});
// ── Start Server ONLY After DB Connects ──────────────────────────────────────
const startServer = async () => {
    try {
        await (0, db_1.connectDB)(); // ← WAIT for DB to connect first
        app.listen(PORT, () => {
            console.log(`✅ Server running on http://localhost:${PORT}`);
        });
    }
    catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1); // Exit if DB connection fails
    }
};
startServer();
//# sourceMappingURL=server.js.map