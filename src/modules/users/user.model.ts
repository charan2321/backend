import { HydratedDocument, Schema, model, Types } from "mongoose";

export type UserRole = "user" | "admin";
export type SubscriptionPlan = "none" | "30day" | "60day";

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  subscription: {
    plan: SubscriptionPlan;
    startDate?: Date;
    endDate?: Date;
    isActive: boolean;
  };
  purchasedBooks: Types.ObjectId[];
  loginAttempts: number;
  lockUntil?: Date;
  dailyActivity: Array<{ date: Date; bookId: Types.ObjectId; pagesViewed: number }>;
  refreshTokenHash?: string;
  otpHash?: string;
  otpExpiry?: Date;
}

export type UserDocument = HydratedDocument<IUser>;

const activitySchema = new Schema(
  {
    date: { type: Date, required: true },
    bookId: { type: Types.ObjectId, required: true, ref: "Book" },
    pagesViewed: { type: Number, required: true, min: 1 }
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    subscription: {
      plan: { type: String, enum: ["none", "30day", "60day"], default: "none" },
      startDate: { type: Date },
      endDate: { type: Date },
      isActive: { type: Boolean, default: false }
    },
    purchasedBooks: [{ type: Types.ObjectId, ref: "Book" }],
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    dailyActivity: [activitySchema],
    refreshTokenHash: { type: String },
    otpHash: { type: String },
    otpExpiry: { type: Date }
  },
  { timestamps: true }
);

userSchema.index({ "subscription.endDate": 1 });

export const User = model<IUser>("User", userSchema);
