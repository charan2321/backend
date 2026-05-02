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
const allowedOrigins = env.CORS_ORIGINS
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS blocked by server"));
    },
    credentials: true
  })
);
app.use(cookieParser());
app.use(
  express.json({
    limit: "1mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString();
    }
  })
);
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
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

app.use("/api", globalLimiter);
app.use("/api/v1/auth", authLimiter);
app.use("/uploads", express.static("uploads"));
app.use("/api/v1", router);

// ── Root health check ──────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({
    status: "✅ LinguaStar API is running",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: {
        register:       "POST /api/v1/auth/register",
        login:          "POST /api/v1/auth/login",
        logout:         "POST /api/v1/auth/logout",
        refresh:        "POST /api/v1/auth/refresh",
        forgot_password:"POST /api/v1/auth/forgot-password",
        verify_otp:     "POST /api/v1/auth/otp/verify",
        send_otp:       "POST /api/v1/auth/otp/send",
        reset_password: "POST /api/v1/auth/reset-password",
      },
      users: {
        me:             "GET  /api/v1/users/me",
        update_me:      "PATCH /api/v1/users/me",
        activity:       "GET  /api/v1/users/me/activity",
        ping:           "POST /api/v1/users/me/activity/ping",
        stats:          "GET  /api/v1/users/me/stats",
        all_users:      "GET  /api/v1/users (admin only)",
      },
      books: {
        list:           "GET  /api/v1/books",
        get_one:        "GET  /api/v1/books/:id",
        create:         "POST /api/v1/books (admin only)",
        update:         "PUT  /api/v1/books/:id (admin only)",
        delete:         "DELETE /api/v1/books/:id (admin only)",
        read_pdf:       "GET  /api/v1/books/:id/read (auth required)",
      },
      payments: {
        create_order:   "POST /api/v1/payments/create-order",
        verify:         "POST /api/v1/payments/verify",
        history:        "GET  /api/v1/payments/history",
      },
    },
  });
});

app.use(errorHandler);
