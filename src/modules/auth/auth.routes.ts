import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../../config/env.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { validate } from "../../middleware/validate.js";
import { User } from "../users/user.model.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/jwt.js";
import { sendError, sendSuccess } from "../../utils/response.js";

const router = Router();
const MAX_ATTEMPTS = 5;
const LOCK_WINDOW_MS = 15 * 60 * 1000;

const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(["user", "admin"]).optional()
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional()
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1)
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional()
});

const sendOtpSchema = z.object({
  body: z.object({
    email: z.string().email()
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional()
});

const verifyOtpSchema = z.object({
  body: z.object({
    email: z.string().email(),
    otp: z.string().length(6)
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional()
});

const refreshCookie = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000
};

router.post("/register", validate(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body as { name: string; email: string; password: string; role?: "user" | "admin" };
    const existing = await User.findOne({ email });
    if (existing) return sendError(res, "CONFLICT", "Email already in use", 409);

    const passwordHash = await bcrypt.hash(password, 12);
    const userRole = role || "user";
    const user = await User.create({ name, email, passwordHash, role: userRole });
    return sendSuccess(res, { id: user.id, email: user.email }, 201);
  } catch (error) {
    next(error);
  }
});

router.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const user = await User.findOne({ email });
    if (!user) return sendError(res, "UNAUTHORIZED", "Invalid credentials", 401);

    if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
      return sendError(res, "RATE_LIMIT_EXCEEDED", "Account temporarily locked", 429);
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      user.loginAttempts = (user.loginAttempts ?? 0) + 1;
      if (user.loginAttempts >= MAX_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_WINDOW_MS);
      }
      await user.save();
      return sendError(res, "UNAUTHORIZED", "Invalid credentials", 401);
    }

    user.loginAttempts = 0;
    user.lockUntil = undefined;
    const payload = { sub: user.id, role: user.role, email: user.email };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    user.refreshTokenHash = await bcrypt.hash(refreshToken, 12);
    await user.save();
    res.cookie("refreshToken", refreshToken, refreshCookie);
    return sendSuccess(res, { accessToken });
  } catch (error) {
    next(error);
  }
});

router.post("/refresh", async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken as string | undefined;
    if (!token) return sendError(res, "REFRESH_TOKEN_INVALID", "Missing refresh token", 401);

    const payload = verifyRefreshToken(token);
    const user = await User.findById(payload.sub);
    if (!user || !user.refreshTokenHash) {
      return sendError(res, "REFRESH_TOKEN_INVALID", "Invalid refresh token", 401);
    }

    const matches = await bcrypt.compare(token, user.refreshTokenHash);
    if (!matches) {
      user.refreshTokenHash = undefined;
      await user.save();
      return sendError(res, "REFRESH_TOKEN_INVALID", "Refresh token reuse detected", 401);
    }

    const nextPayload = { sub: user.id, role: user.role, email: user.email };
    const accessToken = signAccessToken(nextPayload);
    const newRefreshToken = signRefreshToken(nextPayload);
    user.refreshTokenHash = await bcrypt.hash(newRefreshToken, 12);
    await user.save();
    res.cookie("refreshToken", newRefreshToken, refreshCookie);
    return sendSuccess(res, { accessToken });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return sendError(res, "REFRESH_TOKEN_INVALID", "Invalid refresh token", 401);
    }
    next(error);
  }
});

router.post("/logout", requireAuth, async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user?.id, { $unset: { refreshTokenHash: "" } });
    res.clearCookie("refreshToken", refreshCookie);
    return sendSuccess(res, { loggedOut: true });
  } catch (error) {
    next(error);
  }
});

router.post("/otp/send", validate(sendOtpSchema), async (req, res, next) => {
  try {
    const { email } = req.body as { email: string };
    const user = await User.findOne({ email });
    if (!user) return sendError(res, "NOT_FOUND", "User not found", 404);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    
    user.otpHash = otpHash;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    console.log(`[MOCK EMAIL] OTP for ${email} is: ${otp}`);

    return sendSuccess(res, { message: "OTP sent successfully (check console for code)" });
  } catch (error) {
    next(error);
  }
});

router.post("/otp/verify", validate(verifyOtpSchema), async (req, res, next) => {
  try {
    const { email, otp } = req.body as { email: string; otp: string };
    const user = await User.findOne({ email });
    if (!user) return sendError(res, "UNAUTHORIZED", "Invalid credentials", 401);

    if (!user.otpHash || !user.otpExpiry || user.otpExpiry.getTime() < Date.now()) {
      return sendError(res, "UNAUTHORIZED", "OTP expired or not requested", 401);
    }

    const isValid = await bcrypt.compare(otp, user.otpHash);
    if (!isValid) {
      return sendError(res, "UNAUTHORIZED", "Invalid OTP", 401);
    }

    user.otpHash = undefined;
    user.otpExpiry = undefined;
    
    const payload = { sub: user.id, role: user.role, email: user.email };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    user.refreshTokenHash = await bcrypt.hash(refreshToken, 12);
    await user.save();
    
    res.cookie("refreshToken", refreshToken, refreshCookie);
    return sendSuccess(res, { accessToken });
  } catch (error) {
    next(error);
  }
});

export { router as authRouter };
