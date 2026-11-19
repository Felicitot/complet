import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import guidanceRouter from "./routes/guidance.js";
import authRouter from "./routes/auth.js";
import adminRouter from "./routes/admin.js";
import { adminConfigured } from "./services/auth.js";
import { getStatus } from "./services/guidanceGenerator.js";
import { VERSION } from "./config.js";
import { HttpError, ah } from "./utils/http.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  // Derrière nginx / un reverse proxy : TRUST_PROXY=1 pour voir la vraie IP.
  if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);

  const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173").split(",").map((o) => o.trim());
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: allowedOrigins, exposedHeaders: ["X-Image-Source", "Content-Disposition", "Retry-After"] }));
  if (process.env.NODE_ENV !== "test") app.use(morgan("tiny", { skip: (req, res) => res.statusCode === 304 }));
  app.use(express.json({ limit: "100kb" }));

  app.get("/api/health", ah(async (req, res) => {
    const { epoch } = await getStatus();
    res.json({
      status: "ok",
      service: "rivotra-backend",
      version: VERSION,
      uptimeSeconds: Math.round(process.uptime()),
      epoch,
      scheduler: process.env.DISABLE_SCHEDULER !== "1",
      adminConfigured: adminConfigured(),
    });
  }));

  app.use("/api/guidance", guidanceRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/admin", adminRouter);

  app.use((req, res) => res.status(404).json({ status: "error", message: "Route inconnue." }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ status: "error", message: err.message, ...err.extra });
    }
    if (err?.type === "entity.parse.failed") {
      return res.status(400).json({ status: "error", message: "Corps JSON invalide." });
    }
    console.error("[erreur]", err);
    res.status(500).json({ status: "error", message: "Erreur interne du serveur." });
  });

  return app;
}
