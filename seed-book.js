/* backend/seed-book.js */
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Book } from "./src/modules/books/book.model.js";
import { User } from "./src/modules/users/user.model.js";

dotenv.config();

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB...");

    const admin = await User.findOne({ role: "admin" });
    if (!admin) {
      console.error("No admin user found. Please run reset-admin.js first.");
      process.exit(1);
    }

    // Create a real book entry
    const realBook = {
      title: "Hindi Grammar Masterclass",
      language: "Hindi",
      level: "Intermediate",
      coverImageUrl: "https://images.unsplash.com/photo-1544923246-77307dd654ca?q=80&w=300",
      contentKey: "hindi_grammar_v1",
      pdfUrl: "uploads/books/demo.pdf", // placeholder
      priceIndividual: 5900, // 59 Rupees
      isPublished: true,
      uploadedBy: admin._id
    };

    // Remove existing if any with same title
    await Book.deleteOne({ title: realBook.title });
    
    const book = await Book.create(realBook);
    console.log("Real book seeded successfully with ID:", book._id);
    
    process.exit(0);
  } catch (error) {
    console.error("Seed error:", error);
    process.exit(1);
  }
}

seed();
