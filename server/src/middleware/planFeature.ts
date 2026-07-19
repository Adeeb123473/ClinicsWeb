import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError.js";
import { getClinicPlanFeatures } from "../modules/clinics/clinics.repository.js";

/**
 * Gates a route group behind a subscription-plan feature flag (SubscriptionPlans.Features,
 * e.g. "appointments" | "billing" | "reports" | "lab"). A clinic with no plan assigned, or
 * whose plan doesn't list the feature, is rejected with 403 — fails closed, never open.
 * Must run after `authenticate` + `tenantScope` (needs a resolved clinicId).
 */
export function requireFeature(feature: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.authUser?.clinicId) {
      next(ApiError.forbidden("This resource is scoped to a clinic"));
      return;
    }
    try {
      const features = await getClinicPlanFeatures(req.authUser.clinicId);
      if (!features.includes(feature)) {
        next(
          ApiError.forbidden(
            `Your clinic's current subscription plan does not include this feature ("${feature}"). Ask your Clinic Admin to upgrade the plan.`,
            "PLAN_FEATURE_NOT_INCLUDED",
          ),
        );
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
