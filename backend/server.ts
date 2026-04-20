import 'dotenv/config';

import express from "express";
import cors from "cors";
import { connectDB } from "./config/db";

import authRouter from "./routes/authRoutes";
import jobRouter from "./routes/jobRoutes";
import applicantRouter from "./routes/applicantRoutes";
import { uploadRouter } from "./routes/applicantRoutes";
import screeningRouter from "./routes/screeningRoutes";
import { screenRouter } from "./routes/screeningRoutes";
import interviewRouter from "./routes/interviewRoutes";

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";


// ── Middleware ───────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_ORIGIN,
  "http://localhost:5173",
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (mobile apps, curl, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));

// ── Routes ───────────────────────────────────────────────────────────────────
app.get("/", (_req, res) => res.send("Backend running 🚀"));

app.use("/api/auth", authRouter);
app.use("/api/jobs", jobRouter);
app.use("/api/applicants", applicantRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/results", screeningRouter);
app.use("/api/screen", screenRouter);
app.use("/api/interviews", interviewRouter);

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

// ── Start Server ONLY After DB Connects ──────────────────────────────────────
const startServer = async () => {
  try {
    await connectDB(); // ← WAIT for DB to connect first
    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1); // Exit if DB connection fails
  }
};

startServer();