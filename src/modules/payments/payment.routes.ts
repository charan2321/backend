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
import { Book } from "../books/book.model.js";

const router = Router();

const createOrderSchema = z.object({
  body: z.object({
    type: z.enum(["individual_book", "subscription_30", "subscription_60"]),
    bookId: z.string().nullable().optional()
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
    const { type, bookId } = req.body as { type: keyof typeof amountMap; bookId?: string | null };
    console.log(`[Razorpay] Creating order for type: ${type}, bookId: ${bookId}`);
    
    let amount = amountMap[type];
    
    if (type === "individual_book" && bookId) {
      const book = await Book.findById(bookId);
      if (!book) {
        console.error(`[Order Creation] Book not found: ${bookId}`);
        return sendError(res, "NOT_FOUND", "Book not found", 404);
      }
      amount = book.priceIndividual;
    }

    try {
      const order = await razorpay.orders.create({
        amount: Math.round(amount),
        currency: "INR",
        receipt: `ls_${Date.now()}`
      });

      console.log(`[Razorpay] Success: ${order.id}`);

      await Payment.create({
        userId: req.user?.id,
        razorpayOrderId: order.id,
        type,
        bookId: bookId || null,
        amountPaise: amount
      });

      return sendSuccess(res, { 
        orderId: order.id, 
        amount: order.amount, 
        currency: order.currency, 
        keyId: env.RAZORPAY_KEY_ID 
      }, 201);
    } catch (rzpError: any) {
      console.error(`[Razorpay] API Failure:`, rzpError);
      return sendError(res, "PAYMENT_ERROR", rzpError.description || "Razorpay order creation failed", 500);
    }
  } catch (error) {
    console.error(`[Order Creation] General Error:`, error);
    next(error);
  }
});

async function fulfillPurchase(payment: any) {
  if (payment.status === "paid") return; // already fulfilled

  payment.status = "paid";
  await payment.save();

  const user = await User.findById(payment.userId);
  if (!user) throw new Error("User not found");

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
}

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
    await fulfillPurchase(payment);

    return sendSuccess(res, { verified: true });
  } catch (error) {
    next(error);
  }
});

router.post("/webhook", async (req: any, res, next) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    if (typeof signature !== "string") return sendError(res, "UNAUTHORIZED", "Missing signature", 401);

    const body = req.rawBody;
    if (!body) return sendError(res, "INVALID_REQUEST", "Missing payload", 400);

    if (!verifyRazorpaySignature(body, signature)) {
      return sendError(res, "UNAUTHORIZED", "Invalid signature", 401);
    }

    const event = JSON.parse(body);
    console.log(`Webhook received: ${event.event}`);

    if (event.event === "order.paid") {
      const { id: razorpayOrderId } = event.payload.order.entity;
      const payment = await Payment.findOne({ razorpayOrderId });
      if (payment && payment.status !== "paid") {
        payment.razorpayPaymentId = event.payload.payment.entity.id;
        await fulfillPurchase(payment);
        console.log(`Fulfillment completed via webhook for order: ${razorpayOrderId}`);
      }
    }

    return sendSuccess(res, { received: true });
  } catch (error) {
    next(error);
  }
});

export { router as paymentRouter };
