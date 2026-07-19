import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { ApiError } from "../utils/ApiError.js";

export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues.map((i) => i.message).join("; ");
      return next(ApiError.badRequest(message, "VALIDATION_ERROR"));
    }
    req.body = result.data;
    next();
  };
}

/**
 * Validates `req.query` and stashes the parsed/coerced result on `req.validatedQuery`
 * (Express 5 makes `req.query` a read-only getter, so we cannot reassign it in place).
 */
export function validateQuery(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const message = result.error.issues.map((i) => i.message).join("; ");
      return next(ApiError.badRequest(message, "VALIDATION_ERROR"));
    }
    req.validatedQuery = result.data;
    next();
  };
}
