import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/requireAuth.js";
import { roleGuard } from "../../middleware/roleGuard.js";
import { validate } from "../../middleware/validate.js";
import { sendError, sendSuccess } from "../../utils/response.js";
import { Book } from "../books/book.model.js";
import { Payment } from "../payments/payment.model.js";
import { User } from "../users/user.model.js";

const router = Router();

const createBookSchema = z.object({
  body: z.object({
    title: z.string().min(1),
    language: z.string().min(1),
    coverImageUrl: z.string().url(),
    contentKey: z.string().min(1),
    priceIndividual: z.number().int().positive().default(5900)
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
      priceIndividual: z.number().int().positive().optional(),
      isPublished: z.boolean().optional()
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

router.post("/books", validate(createBookSchema), async (req, res, next) => {
  try {
    const book = await Book.create({ ...req.body, uploadedBy: req.user?.id });
    return sendSuccess(res, book, 201);
  } catch (error) {
    next(error);
  }
});

router.patch("/books/:id", validate(updateBookSchema), async (req, res, next) => {
  try {
    const book = await Book.findByIdAndUpdate(req.params.id, req.body, { new: true });
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

export { router as adminRouter };
