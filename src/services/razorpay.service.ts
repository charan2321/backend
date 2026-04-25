import crypto from "crypto";
import Razorpay from "razorpay";
import { env } from "../config/env.js";
import { safeCompare } from "../utils/tokenCompare.js";

export const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET
});

export const verifyRazorpaySignature = (payload: string, signature: string): boolean => {
  const computed = crypto.createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET).update(payload).digest("hex");
  return safeCompare(computed, signature);
};
