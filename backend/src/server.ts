import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import connectDB from "./config/db";
import logger from "./utils/logger";

import authRoutes       from "./routes/authRoutes";
import jobRoutes        from "./routes/jobRoutes";
import applicantRoutes  from "./routes/applicantRoutes";
import uploadRoutes     from "./routes/uploadRoutes";
import { screenRouter, resultsRouter } from "./routes/screeningRoutes";
import { notFound, errorHandler } from "./middlewares/errorHandler";
import interviewNotifyRouter from "./routes/interviewNotify.route";

// ─── Validate required environment variables ──────────────────────────────────
const REQUIRED_ENV = ["MONGODB_URI", "JWT_SECRET", "GEMINI_API_KEY"] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    logger.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const app = express();
const PORT = parseInt(process.env.PORT ?? "5000", 10);

// ─── Security middleware ───────────────────────────────────────────────────────
app.use(helmet());

app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
      // Allow requests with no origin (e.g. mobile apps, curl)
      if (!origin || origin === allowed) return callback(null, true);
      logger.warn(`CORS blocked request from: ${origin}`);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cache-Control"],
    exposedHeaders: ["X-Total-Count", "X-Page", "X-Limit"],
  })
);

// Global rate limiter
app.use(
  rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "900000", 10),
    max:      parseInt(process.env.RATE_LIMIT_MAX ?? "200", 10),
    message:  { message: "Too many requests — please slow down" },
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ─── Body parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── Health check (no auth required) ─────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth",       authRoutes);
app.use("/api/jobs",       jobRoutes);
app.use("/api/applicants", applicantRoutes);
app.use("/api/upload",     uploadRoutes);
app.use("/api/screen",     screenRouter);
app.use("/api/results",    resultsRouter);
app.use("/api/interviews", interviewNotifyRouter);
// ─── Error handling ───────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function bootstrap(): Promise<void> {
  await connectDB();
  app.listen(PORT, () => {
    logger.info(`🚀 TalentScreen API running on port ${PORT}`);
    logger.info(`   Environment : ${process.env.NODE_ENV ?? "development"}`);
    logger.info(`   CORS origin : ${process.env.CLIENT_ORIGIN}`);
    logger.info(`   Health check: http://localhost:${PORT}/health`);
  });
}

bootstrap().catch((err) => {
  logger.error("Failed to start server:", err);
  process.exit(1);
});

export default app;
