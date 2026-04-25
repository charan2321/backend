import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { router } from "./router.js";

export const app = express();

app.get("/health", (_req, res) => {
  res.status(200).json({ success: true, data: { status: "ok" } });
});

app.get("/ready", (_req, res) => {
  const isReady = mongoose.connection.readyState === 1;
  res.status(isReady ? 200 : 503).json({
    success: isReady,
    data: { mongoReady: isReady }
  });
});

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGINS.split(",").map((item) => item.trim()),
    credentials: true
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "10kb" }));
app.use((req, _res, next) => {
  const sanitize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sanitize);
    if (value && typeof value === "object") {
      const input = value as Record<string, unknown>;
      const output: Record<string, unknown> = {};
      for (const [key, nestedValue] of Object.entries(input)) {
        const cleanKey = key.replace(/\$/g, "").replace(/\./g, "");
        output[cleanKey] = sanitize(nestedValue);
      }
      return output;
    }
    return value;
  };

  req.body = sanitize(req.body);
  req.params = sanitize(req.params) as typeof req.params;
  next();
});
if (env.NODE_ENV === "development") app.use(morgan("dev"));

const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

app.use("/api", globalLimiter);
app.use("/api/v1/auth", authLimiter);
app.use("/api/v1", router);
app.use(errorHandler);
