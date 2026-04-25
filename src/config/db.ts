import mongoose from "mongoose";
import { env } from "./env.js";

export const connectDb = async (): Promise<void> => {
  await mongoose.connect(env.MONGODB_URI);
};
