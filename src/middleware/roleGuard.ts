import { sendError } from "../utils/response.js";

export const roleGuard =
  (...roles: Array<"user" | "admin">) =>
  (req: any, res: any, next: any): any => {
    if (!req.user || !roles.includes(req.user.role)) {
      return sendError(res, "FORBIDDEN", "Insufficient permissions", 403);
    }
    next();
  };
