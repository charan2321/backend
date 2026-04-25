import crypto from "crypto";
import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { validate } from "../../middleware/validate.js";
import { razorpay, verifyRazorpaySignature } from "../../services/razorpay.service.js";
import { sendError, sendSuccess } from "../../utils/response.js";
import { User } from "../users/user.model.js";
import { Payment } from "./payment.model.js";

const router = Router();

const createOrderSchema = z.object({
  body: z.object({
    type: z.enum(["individual_book", "subscription_30", "subscription_60"]),
    bookId: z.string().optional()
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional()
});

const verifySchema = z.object({
  body: z.object({
    razorpayOrderId: z.string(),
    razorpayPaymentId: z.string(),
    razorpaySignature: z.string()
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional()
});

const amountMap: Record<string, number> = {
  individual_book: 5900,
  subscription_30: 19900,
  subscription_60: 29900
};

router.post("/create-order", requireAuth, validate(createOrderSchema), async (req, res, next) => {
  try {
    const { type, bookId } = req.body as { type: keyof typeof amountMap; bookId?: string };
    const amount = amountMap[type];
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `ls_${Date.now()}`
    });

    await Payment.create({
      userId: req.user?.id,
      razorpayOrderId: order.id,
      type,
      bookId: bookId ?? null,
      amountPaise: amount
    });

    return sendSuccess(res, { orderId: order.id, amountPaise: amount, currency: "INR" }, 201);
  } catch (error) {
    next(error);
  }
});

router.post("/verify", requireAuth, validate(verifySchema), async (req, res, next) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body as {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    };

    const digest = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (digest !== razorpaySignature) {
      return sendError(res, "INVALID_REQUEST", "Invalid payment signature", 400);
    }

    const payment = await Payment.findOne({ razorpayOrderId, userId: req.user?.id });
    if (!payment) return sendError(res, "NOT_FOUND", "Payment not found", 404);

    payment.razorpayPaymentId = razorpayPaymentId;
    payment.status = "paid";
    await payment.save();

    const user = await User.findById(req.user?.id);
    if (!user) return sendError(res, "NOT_FOUND", "User not found", 404);

    if (payment.type === "individual_book" && payment.bookId) {
      if (!user.purchasedBooks.some((id) => String(id) === String(payment.bookId))) {
        user.purchasedBooks.push(payment.bookId);
      }
    } else {
      const now = new Date();
      const days = payment.type === "subscription_60" ? 60 : 30;
      const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      user.subscription = {
        plan: days === 60 ? "60day" : "30day",
        startDate: now,
        endDate: end,
        isActive: true
      };
    }

    await user.save();
    return sendSuccess(res, { verified: true });
  } catch (error) {
    next(error);
  }
});

router.post("/webhook", expressRawBody, async (req, res, next) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    if (typeof signature !== "string") return sendError(res, "UNAUTHORIZED", "Missing signature", 401);
    const body = (req as unknown as { rawBody?: string }).rawBody;
    if (!body) return sendError(res, "INVALID_REQUEST", "Missing payload", 400);
    if (!verifyRazorpaySignature(body, signature)) return sendError(res, "UNAUTHORIZED", "Invalid signature", 401);
    return sendSuccess(res, { received: true });
  } catch (error) {
    next(error);
  }
});

function expressRawBody(req: unknown, _res: unknown, next: () => void): void {
  next();
}

export { router as paymentRouter };
