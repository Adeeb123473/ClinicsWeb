import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError.js";

/**
 * Guards every tenant-scoped route. SUPER_ADMIN has ClinicID = NULL and must never reach
 * clinic-scoped data (see CLAUDE.md section 2 privacy boundary), so it is rejected here
 * rather than being allowed to pass a clinic id via params/body/query.
 * Must run after `authenticate`.
 */
export function tenantScope(req: Request, _res: Response, next: NextFunction): void {
  if (!req.authUser) {
    return next(ApiError.unauthorized());
  }
  if (!req.authUser.clinicId) {
    return next(ApiError.forbidden("This resource is scoped to a clinic"));
  }
  next();
}

/** Repository-layer guard: throws if a query is about to run without a tenant id bound in. */
export function assertClinicId(clinicId: string | null | undefined): asserts clinicId is string {
  if (!clinicId) {
    throw new Error("tenantScope violation: attempted a clinic-scoped query without a ClinicID");
  }
}
