import { Schema, model, Types } from "mongoose";

export interface IPayment {
  userId: Types.ObjectId;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  type: "individual_book" | "subscription_30" | "subscription_60";
  bookId?: Types.ObjectId;
  amountPaise: number;
  status: "created" | "paid" | "failed";
}

const paymentSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true },
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String },
    type: { type: String, enum: ["individual_book", "subscription_30", "subscription_60"], required: true },
    bookId: { type: Types.ObjectId, ref: "Book" },
    amountPaise: { type: Number, required: true },
    status: { type: String, enum: ["created", "paid", "failed"], default: "created" }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

paymentSchema.index({ userId: 1, createdAt: -1 });

export const Payment = model<IPayment>("Payment", paymentSchema);
