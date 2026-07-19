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

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.clientOrigin,
      credentials: true,
    }),
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
  app.use("/api/v1/patients", patientsRoutes);
  app.use("/api/v1/consultations", consultationsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
