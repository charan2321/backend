/* backend/test-razorpay.js */
import Razorpay from "razorpay";
import dotenv from "dotenv";
dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

async function test() {
  console.log("Testing Razorpay with Key:", process.env.RAZORPAY_KEY_ID);
  try {
    const order = await razorpay.orders.create({
      amount: 5900, // ₹59
      currency: "INR",
      receipt: "test_receipt_123"
    });
    console.log("SUCCESS! Order ID:", order.id);
  } catch (error) {
    console.error("RAZORPAY ERROR:", JSON.stringify(error, null, 2));
  }
  process.exit(0);
}
test();
