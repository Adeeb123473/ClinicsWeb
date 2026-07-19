import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError.js";
import type { Role } from "../types/auth.js";

/** Rejects the request unless the authenticated user's role is one of `roles`. Must run after `authenticate`. */
export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      return next(ApiError.unauthorized());
    }
    if (!roles.includes(req.authUser.role)) {
      return next(ApiError.forbidden("You do not have permission to perform this action"));
    }
    next();
  };
}
