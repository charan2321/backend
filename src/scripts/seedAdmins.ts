import { connectDb } from "../config/db.js";
import { User } from "../modules/users/user.model.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

const seedAdmins = async () => {
  try {
    await connectDb();
    
    const admins = [
      { name: "Charan", email: "ccharanr7@gmail.com" },
      { name: "Chethan", email: "gowdamchethan863@gmail.com" }
    ];

    const password = "Admin123#";
    const passwordHash = await bcrypt.hash(password, 12);

    for (const admin of admins) {
      const existing = await User.findOne({ email: admin.email });
      if (existing) {
        existing.role = "admin";
        existing.passwordHash = passwordHash;
        existing.isVerified = true;
        await existing.save();
        console.log(`✅ Admin ${admin.email} updated.`);
      } else {
        await User.create({
          name: admin.name,
          email: admin.email,
          passwordHash,
          role: "admin",
          isVerified: true
        });
        console.log(`✅ Admin ${admin.email} created.`);
      }
    }
  } catch (error) {
    console.error("Error seeding admins:", error);
  } finally {
    await mongoose.connection.close();
  }
};

seedAdmins();
