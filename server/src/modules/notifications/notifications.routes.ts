import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { tenantScope } from "../../middleware/tenantScope.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import { listForUser, markRead, markAllRead } from "./notifications.service.js";

const router = Router();
router.use(authenticate, tenantScope);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw ApiError.unauthorized();
    const rows = await listForUser(req.authUser.clinicId as string, req.authUser.sub);
    sendSuccess(
      res,
      rows.map((n) => ({
        notificationId: n.NotificationID,
        type: n.Type,
        title: n.Title,
        message: n.Message,
        isRead: n.IsRead,
        createdAt: n.CreatedAt,
      })),
    );
  }),
);

router.post(
  "/read-all",
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw ApiError.unauthorized();
    await markAllRead(req.authUser.clinicId as string, req.authUser.sub);
    sendSuccess(res, null);
  }),
);

router.post(
  "/:id/read",
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw ApiError.unauthorized();
    await markRead(req.authUser.clinicId as string, req.authUser.sub, req.params.id as string);
    sendSuccess(res, null);
  }),
);

export default router;
