import { verifyAccessToken } from "../utils/jwt.js";
import { sendError } from "../utils/response.js";

export const requireAuth = (req: any, res: any, next: any): any => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return sendError(res, "UNAUTHORIZED", "Authentication required", 401);
  }

  const token = header.slice(7);
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, email: payload.email };
    next();
  } catch {
    return sendError(res, "TOKEN_INVALID", "Invalid or expired token", 401);
  }
};
