import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { sendError, sendSuccess } from "../../utils/response.js";
import { Book } from "./book.model.js";
import { User } from "../users/user.model.js";
import path from "path";
import fs from "fs";

const router = Router();

const hasBookAccess = (user: any, bookId: string): boolean => {
  if (user.role === "admin") return true;
  const now = new Date();
  const subActive =
    Boolean(user.subscription?.isActive) &&
    Boolean(user.subscription?.endDate) &&
    new Date(user.subscription.endDate).getTime() > now.getTime();
  return subActive || (user.purchasedBooks && user.purchasedBooks.some((id: any) => String(id) === bookId));
};

router.get("/", async (_req, res, next) => {
  try {
    const books = await Book.find({ isPublished: true }).select("-contentKey");
    return sendSuccess(res, books);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user?.id).select("purchasedBooks subscription role");
    const book = await Book.findById(req.params.id).select("-contentKey");
    if (!book || !user) return sendError(res, "NOT_FOUND", "Resource not found", 404);
    if (!hasBookAccess(user, req.params.id)) {
      return sendError(res, "FORBIDDEN", "Purchase or subscription required", 403);
    }
    return sendSuccess(res, book);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/read", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user?.id).select("purchasedBooks subscription role");
    const book = await Book.findById(req.params.id);
    if (!book || !user) return sendError(res, "NOT_FOUND", "Resource not found", 404);
    if (!hasBookAccess(user, req.params.id)) {
      return sendError(res, "FORBIDDEN", "Purchase or subscription required", 403);
    }
    if (!book.pdfUrl) {
      return sendError(res, "NOT_FOUND", "PDF file not found for this book", 404);
    }

    const filePath = path.resolve(process.cwd(), book.pdfUrl.replace(/^\//, ""));
    if (!fs.existsSync(filePath)) {
       return sendError(res, "NOT_FOUND", "PDF file missing on server", 404);
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${book.title}.pdf"`);
    
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
});

export { router as bookRouter };
