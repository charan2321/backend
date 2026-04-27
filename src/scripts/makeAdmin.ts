import { connectDb } from "../config/db.js";
import { User } from "../modules/users/user.model.js";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const makeAdmin = async (email: string) => {
  try {
    await connectDb();
    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { role: "admin" },
      { new: true }
    );

    if (user) {
      console.log(`✅ User ${email} is now an ADMIN.`);
    } else {
      console.log(`❌ User with email ${email} not found. Please sign up on the website first.`);
    }
  } catch (error) {
    console.error("Error updating user role:", error);
  } finally {
    await mongoose.connection.close();
  }
};

const email = process.argv[2] || "ccharanr7@gmail.com";
makeAdmin(email);
