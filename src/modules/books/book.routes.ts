import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { sendError, sendSuccess } from "../../utils/response.js";
import { Book } from "./book.model.js";
import { User } from "../users/user.model.js";

const router = Router();

const hasBookAccess = (user: { purchasedBooks: string[]; subscription?: { isActive?: boolean; endDate?: Date } }, bookId: string): boolean => {
  const now = new Date();
  const subActive =
    Boolean(user.subscription?.isActive) &&
    Boolean(user.subscription?.endDate) &&
    new Date(user.subscription!.endDate!).getTime() > now.getTime();
  return subActive || user.purchasedBooks.some((id) => String(id) === bookId);
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
    const user = await User.findById(req.user?.id).select("purchasedBooks subscription");
    const book = await Book.findById(req.params.id).select("-contentKey");
    if (!book || !user) return sendError(res, "NOT_FOUND", "Resource not found", 404);
    if (!hasBookAccess(user as unknown as { purchasedBooks: string[]; subscription?: { isActive?: boolean; endDate?: Date } }, req.params.id)) {
      return sendError(res, "FORBIDDEN", "Purchase or subscription required", 403);
    }
    return sendSuccess(res, book);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/read", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user?.id).select("purchasedBooks subscription");
    const book = await Book.findById(req.params.id);
    if (!book || !user) return sendError(res, "NOT_FOUND", "Resource not found", 404);
    if (!hasBookAccess(user as unknown as { purchasedBooks: string[]; subscription?: { isActive?: boolean; endDate?: Date } }, req.params.id)) {
      return sendError(res, "FORBIDDEN", "Purchase or subscription required", 403);
    }
    return sendSuccess(res, { contentStreamKey: book.contentKey, message: "Serve protected reader content here" });
  } catch (error) {
    next(error);
  }
});

export { router as bookRouter };
