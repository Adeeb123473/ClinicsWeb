import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError.js";
import { sendError } from "../utils/apiResponse.js";

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    sendError(res, err.statusCode, err.message, err.code);
    return;
  }

  // Never leak stack traces or raw SQL/driver errors to the client.
  console.error(err);
  sendError(res, 500, "Internal server error");
}
