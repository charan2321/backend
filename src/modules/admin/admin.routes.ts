import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/requireAuth.js";
import { roleGuard } from "../../middleware/roleGuard.js";
import { validate } from "../../middleware/validate.js";
import { sendError, sendSuccess } from "../../utils/response.js";
import { Book } from "../books/book.model.js";
import { Payment } from "../payments/payment.model.js";
import { User } from "../users/user.model.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = "uploads/books";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ 
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf" || file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and Images are allowed"));
    }
  }
});

const router = Router();

const createBookSchema = z.object({
  body: z.object({
    title: z.string().min(1),
    language: z.string().min(1),
    level: z.string().default("Beginner"),
    priceIndividual: z.string().or(z.number()).transform(v => Number(v)).default(5900)
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional()
});

const updateBookSchema = z.object({
  body: z
    .object({
      title: z.string().min(1).optional(),
      language: z.string().min(1).optional(),
      coverImageUrl: z.string().url().optional(),
      contentKey: z.string().min(1).optional(),
      priceIndividual: z.string().or(z.number()).transform(v => Number(v)).optional(),
      isPublished: z.string().transform(v => v === "true").or(z.boolean()).optional()
    })
    .refine((data) => Object.keys(data).length > 0),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().min(1) })
});

router.use(requireAuth, roleGuard("admin"));

router.get("/users", async (_req, res, next) => {
  try {
    const users = await User.find().select("-passwordHash -refreshTokenHash").sort({ createdAt: -1 });
    return sendSuccess(res, users);
  } catch (error) {
    next(error);
  }
});

router.get("/books", async (_req, res, next) => {
  try {
    const books = await Book.find().sort({ createdAt: -1 });
    return sendSuccess(res, books);
  } catch (error) {
    next(error);
  }
});

router.post("/books", upload.fields([{ name: "pdf", maxCount: 1 }, { name: "cover", maxCount: 1 }]), validate(createBookSchema), async (req, res, next) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const pdfUrl = files?.pdf ? `/uploads/books/${files.pdf[0].filename}` : undefined;
    const coverUrl = files?.cover ? `/uploads/books/${files.cover[0].filename}` : "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=220";

    const book = await Book.create({ 
      ...req.body, 
      coverImageUrl: coverUrl,
      pdfUrl: pdfUrl,
      contentKey: "pdf_content",
      uploadedBy: req.user?.id 
    });
    return sendSuccess(res, book, 201);
  } catch (error) {
    console.error("Error creating book:", error);
    next(error);
  }
});

router.patch("/books/:id", upload.fields([{ name: "pdf", maxCount: 1 }, { name: "cover", maxCount: 1 }]), validate(updateBookSchema), async (req, res, next) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const updates = { ...req.body };
    if (files?.pdf) updates.pdfUrl = `/uploads/books/${files.pdf[0].filename}`;
    if (files?.cover) updates.coverImageUrl = `/uploads/books/${files.cover[0].filename}`;

    const book = await Book.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!book) return sendError(res, "NOT_FOUND", "Book not found", 404);
    return sendSuccess(res, book);
  } catch (error) {
    next(error);
  }
});

router.delete("/books/:id", async (req, res, next) => {
  try {
    const book = await Book.findByIdAndUpdate(req.params.id, { isPublished: false }, { new: true });
    if (!book) return sendError(res, "NOT_FOUND", "Book not found", 404);
    return sendSuccess(res, { unpublished: true });
  } catch (error) {
    next(error);
  }
});

router.get("/payments", async (_req, res, next) => {
  try {
    const payments = await Payment.find().sort({ createdAt: -1 });
    return sendSuccess(res, payments);
  } catch (error) {
    next(error);
  }
});

router.get("/stats", async (_req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalBooks = await Book.countDocuments();
    const activeSubs = await User.countDocuments({ "subscription.isActive": true });

    const revenueAggregation = await Payment.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: null, total: { $sum: "$amountPaise" } } }
    ]);

    const totalRevenue = revenueAggregation.length > 0 ? revenueAggregation[0].total / 100 : 0;

    return sendSuccess(res, {
      totalUsers,
      totalBooks,
      activeSubs,
      totalRevenue
    });
  } catch (error) {
    next(error);
  }
});

export { router as adminRouter };
