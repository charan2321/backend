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

export { router as userRouter };
