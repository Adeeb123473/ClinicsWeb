import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate } from "../../middleware/authenticate.js";
import { validateBody } from "../../middleware/validate.js";
import { loginSchema, registerClinicSchema } from "./auth.schemas.js";
import * as authController from "./auth.controller.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, data: null, error: { message: "Too many login attempts, try again later." } },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, data: null, error: { message: "Too many registration attempts, try again later." } },
});

router.post("/login", loginLimiter, validateBody(loginSchema), authController.login);
router.post(
  "/register-clinic",
  registerLimiter,
  validateBody(registerClinicSchema),
  authController.register,
);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.get("/me", authenticate, authController.me);

export default router;
