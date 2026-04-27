import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/requireAuth.js";
import { validate } from "../../middleware/validate.js";
import { sendSuccess } from "../../utils/response.js";
import { User } from "./user.model.js";

const router = Router();

const updateMeSchema = z.object({
  body: z
    .object({
      name: z.string().min(2).optional(),
      password: z.string().min(8).optional()
    })
    .refine((data) => data.name || data.password, { message: "No updates provided" }),
  query: z.object({}).optional(),
  params: z.object({}).optional()
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user?.id).select("-passwordHash -refreshTokenHash");
    return sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
});

router.patch("/me", requireAuth, validate(updateMeSchema), async (req, res, next) => {
  try {
    const updates: { name?: string; passwordHash?: string } = {};
    if (req.body.name) updates.name = req.body.name;
    if (req.body.password) updates.passwordHash = await bcrypt.hash(req.body.password, 12);
    const user = await User.findByIdAndUpdate(req.user?.id, updates, { new: true }).select(
      "-passwordHash -refreshTokenHash"
    );
    return sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
});

router.get("/me/activity", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user?.id).select("dailyActivity");
    return sendSuccess(res, user?.dailyActivity ?? []);
  } catch (error) {
    next(error);
  }
});

// POST /me/activity/ping — called every 5 min while user is reading
router.post("/me/activity/ping", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user?.id).select("dailyActivity");
    if (!user) return sendSuccess(res, { pinged: false });

    const todayStr = new Date().toDateString();
    const existing = user.dailyActivity.find(
      (a) => new Date(a.date).toDateString() === todayStr
    );

    if (existing) {
      existing.pagesViewed += 1; // each ping = 5 min = ~1 page unit
    } else {
      user.dailyActivity.push({
        date: new Date(),
        bookId: req.body.bookId || undefined,
        pagesViewed: 1
      });
    }

    // Keep only last 90 days to save space
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    user.dailyActivity = user.dailyActivity.filter(
      (a) => new Date(a.date) >= cutoff
    ) as typeof user.dailyActivity;

    await user.save();
    return sendSuccess(res, { pinged: true });
  } catch (error) {
    next(error);
  }
});

// GET /me/stats — returns streak, totalHoursRead, booksRead
router.get("/me/stats", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user?.id).select("dailyActivity purchasedBooks");
    if (!user) return sendSuccess(res, { streak: 0, hoursRead: 0, booksRead: 0 });

    const activity = user.dailyActivity;

    // Each pagesViewed unit = 5 minutes; convert to hours
    const totalMinutes = activity.reduce((sum, a) => sum + (a.pagesViewed * 5), 0);
    const hoursRead = Math.round(totalMinutes / 60 * 10) / 10; // 1 decimal

    // Streak: count consecutive days ending today
    const activeDays = new Set(activity.map((a) => new Date(a.date).toDateString()));
    let streak = 0;
    const cursor = new Date();
    while (activeDays.has(cursor.toDateString())) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    return sendSuccess(res, {
      streak,
      hoursRead,
      booksRead: user.purchasedBooks.length
    });
  } catch (error) {
    next(error);
  }
});

export { router as userRouter };
