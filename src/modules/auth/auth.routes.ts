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
import { sendOtpEmail } from "../../services/email.service.js";

const router = Router();
const MAX_ADMINS = 3;

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

const forgotPasswordSchema = z.object({
  body: z.object({ email: z.string().email() }),
  query: z.object({}).optional(),
  params: z.object({}).optional()
});

const verifyResetOtpSchema = z.object({
  body: z.object({
    email: z.string().email(),
    otp: z.string().length(6)
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional()
});

const resetPasswordSchema = z.object({
  body: z.object({
    resetToken: z.string().min(10),
    newPassword: z.string().min(8)
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional()
});

const refreshCookie = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: env.NODE_ENV === "production" ? ("none" as const) : ("lax" as const),
  maxAge: 7 * 24 * 60 * 60 * 1000
};

router.post("/register", validate(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body as { name: string; email: string; password: string; role?: "user" | "admin" };
    const existing = await User.findOne({ email });
    if (existing) return sendError(res, "CONFLICT", "Email already in use", 409);

    if (role === "admin") {
      if (password !== "14021") {
        return sendError(res, "BAD_REQUEST", "Admin password must be 14021", 400);
      }
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount >= MAX_ADMINS) {
        return sendError(res, "FORBIDDEN", "Maximum number of admins reached", 403);
      }
    }

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

    if (!user.isVerified) {
      return sendError(res, "UNAUTHORIZED", "Email not verified. Please verify with OTP.", 401);
    }

    let isValid = false;
    if (user.role === "admin") {
      if (password !== "14021") {
        return sendError(res, "UNAUTHORIZED", "Invalid admin credentials", 401);
      }
      isValid = true;
    } else {
      isValid = await bcrypt.compare(password, user.passwordHash);
    }
    
    if (!isValid) {
      return sendError(res, "UNAUTHORIZED", "Invalid credentials", 401);
    }

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

    await sendOtpEmail(email, otp);

    return sendSuccess(res, { message: "OTP sent successfully" });
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
    user.isVerified = true;
    
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

// POST /forgot-password — send OTP to user email
router.post("/forgot-password", validate(forgotPasswordSchema), async (req, res, next) => {
  try {
    const { email } = req.body as { email: string };
    const user = await User.findOne({ email });
    // Don't reveal if email exists for security
    if (!user) return sendSuccess(res, { message: "If this email exists, a reset code has been sent." });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    user.otpHash = otpHash;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendOtpEmail(email, otp);
    return sendSuccess(res, { message: "If this email exists, a reset code has been sent." });
  } catch (error) {
    next(error);
  }
});

// POST /verify-reset-otp — validate OTP and return a short-lived reset token
router.post("/verify-reset-otp", validate(verifyResetOtpSchema), async (req, res, next) => {
  try {
    const { email, otp } = req.body as { email: string; otp: string };
    const user = await User.findOne({ email });
    if (!user) return sendError(res, "UNAUTHORIZED", "Invalid OTP", 401);

    if (!user.otpHash || !user.otpExpiry || user.otpExpiry.getTime() < Date.now()) {
      return sendError(res, "UNAUTHORIZED", "OTP expired or not requested", 401);
    }

    const isValid = await bcrypt.compare(otp, user.otpHash);
    if (!isValid) return sendError(res, "UNAUTHORIZED", "Invalid OTP", 401);

    // OTP valid — clear it and issue a short-lived reset JWT (5 min)
    user.otpHash = undefined;
    user.otpExpiry = undefined;
    await user.save();

    const resetToken = jwt.sign(
      { sub: user.id, purpose: "password_reset" },
      env.JWT_ACCESS_SECRET,
      { expiresIn: "5m" }
    );
    return sendSuccess(res, { resetToken });
  } catch (error) {
    next(error);
  }
});

// POST /reset-password — use resetToken to set a new password
router.post("/reset-password", validate(resetPasswordSchema), async (req, res, next) => {
  try {
    const { resetToken, newPassword } = req.body as { resetToken: string; newPassword: string };

    let payload: any;
    try {
      payload = jwt.verify(resetToken, env.JWT_ACCESS_SECRET);
    } catch {
      return sendError(res, "UNAUTHORIZED", "Reset token expired or invalid. Please start over.", 401);
    }

    if (payload.purpose !== "password_reset") {
      return sendError(res, "UNAUTHORIZED", "Invalid reset token", 401);
    }

    const user = await User.findById(payload.sub);
    if (!user) return sendError(res, "NOT_FOUND", "User not found", 404);

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    return sendSuccess(res, { message: "Password updated successfully" });
  } catch (error) {
    next(error);
  }
});

export { router as authRouter };
