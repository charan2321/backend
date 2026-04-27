/* backend/check-payments.js */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const fiveMinsAgo = new Date(Date.now() - 5 * 60000);
  const payments = await mongoose.connection.collection('payments').find({ 
    createdAt: { $gte: fiveMinsAgo } 
  }).toArray();
  console.log("Recent Payments:", JSON.stringify(payments, null, 2));
  process.exit(0);
}
check();
