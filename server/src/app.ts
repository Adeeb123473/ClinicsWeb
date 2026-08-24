import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import authRoutes from "./modules/auth/auth.routes.js";
import patientsRoutes from "./modules/patients/patients.routes.js";
import consultationsRoutes from "./modules/consultations/consultations.routes.js";
import plansRoutes from "./modules/plans/plans.routes.js";
import clinicsRoutes from "./modules/clinics/clinics.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import staffRoutes from "./modules/staff/staff.routes.js";
import settingsRoutes from "./modules/clinicSettings/settings.routes.js";
import reportsRoutes from "./modules/reports/reports.routes.js";
import doctorsRoutes from "./modules/doctors/doctors.routes.js";
import appointmentsRoutes from "./modules/appointments/appointments.routes.js";
import billingRoutes from "./modules/billing/billing.routes.js";
import vitalsRoutes from "./modules/vitals/vitals.routes.js";
import prescriptionsRoutes from "./modules/prescriptions/prescriptions.routes.js";
import medicinesRoutes from "./modules/medicines/medicines.module.js";
import historyRoutes from "./modules/history/history.routes.js";
import labRoutes from "./modules/lab/lab.routes.js";
import letterheadRoutes from "./modules/letterheads/letterheads.routes.js";
import platformAdminRoutes from "./modules/platform/platform.routes.js";

export function createApp() {
  const app = express();

  // Render (and most PaaS hosts) put the app behind a reverse proxy; without this,
  // express-rate-limit misreads every request as coming from the proxy's IP, and
  // req.ip (used for login lockout / audit logs) would be wrong too.
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        // No Origin header (server-to-server, curl, health checks) — allow. An
        // unrecognised Origin just doesn't get the CORS headers (browsers then refuse to
        // read the response) — no need to error the request itself.
        callback(null, !origin || env.clientOrigins.includes(origin));
      },
      credentials: true,
    }),
  );
  // Letterhead images are megabytes, not kilobytes. This must be registered BEFORE the global
  // parser: express.json() rejects an oversized body where it is mounted, so a later
  // route-specific limit would never be reached. Everything else keeps the 100kb default.
  const LETTERHEAD_IMAGE_PATH = /^\/api\/v1\/doctors\/[^/]+\/letterhead\/image$/;
  const letterheadImageParser = express.json({ limit: "12mb" });
  app.use((req, res, next) =>
    LETTERHEAD_IMAGE_PATH.test(req.path) ? letterheadImageParser(req, res, next) : next(),
  );
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.get("/health", (_req, res) => {
    res.json({ success: true, data: { status: "ok" }, error: null, meta: null });
  });

  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/admin/plans", plansRoutes);
  app.use("/api/v1/admin/clinics", clinicsRoutes);
  app.use("/api/v1/admin/platform", platformAdminRoutes);
  app.use("/api/v1/admin", adminRoutes);
  app.use("/api/v1/users", staffRoutes);
  app.use("/api/v1/clinic-settings", settingsRoutes);
  app.use("/api/v1/reports", reportsRoutes);
  app.use("/api/v1/patients", historyRoutes);
  app.use("/api/v1/patients", patientsRoutes);
  app.use("/api/v1/doctors", letterheadRoutes);
  app.use("/api/v1/doctors", doctorsRoutes);
  app.use("/api/v1/appointments", appointmentsRoutes);
  app.use("/api/v1/billing", billingRoutes);
  app.use("/api/v1/vitals", vitalsRoutes);
  app.use("/api/v1/consultations", consultationsRoutes);
  app.use("/api/v1/prescriptions", prescriptionsRoutes);
  app.use("/api/v1/medicines", medicinesRoutes);
  app.use("/api/v1/lab", labRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
