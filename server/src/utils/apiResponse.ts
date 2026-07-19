import type { Response } from "express";

interface Meta {
  page?: number;
  limit?: number;
  total?: number;
  [key: string]: unknown;
}

export function sendSuccess<T>(res: Response, data: T, statusCode = 200, meta?: Meta): void {
  res.status(statusCode).json({ success: true, data, error: null, meta: meta ?? null });
}

export function sendError(res: Response, statusCode: number, message: string, code?: string): void {
  res.status(statusCode).json({ success: false, data: null, error: { message, code }, meta: null });
}
