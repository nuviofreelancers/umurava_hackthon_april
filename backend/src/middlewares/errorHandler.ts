import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";

export interface AppError extends Error {
  status?: number;
  statusCode?: number;
}

export function notFound(req: Request, res: Response): void {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const status = err.status ?? err.statusCode ?? 500;
  const message = err.message || "Internal server error";

  if (status >= 500) {
    logger.error(`[${status}] ${message}`, err.stack);
  } else {
    logger.warn(`[${status}] ${message}`);
  }

  res.status(status).json({ message });
}
