import { Router } from "express";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { bookRouter } from "./modules/books/book.routes.js";
import { paymentRouter } from "./modules/payments/payment.routes.js";
import { userRouter } from "./modules/users/user.routes.js";

export const router = Router();

router.use("/auth", authRouter);
router.use("/users", userRouter);
router.use("/books", bookRouter);
router.use("/payments", paymentRouter);
router.use("/admin", adminRouter);
