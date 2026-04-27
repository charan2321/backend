import { ZodError, ZodTypeAny } from "zod";
import { sendError } from "../utils/response.js";

export const validate =
  (schema: ZodTypeAny) =>
  (req: any, res: any, next: any): any => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params
      }) as any;
      
      // Update req.body (usually mutable)
      if (parsed.body) req.body = parsed.body;
      
      // Update query and params if they are objects (best effort)
      if (parsed.query && typeof req.query === 'object') {
        try { Object.assign(req.query, parsed.query); } catch (e) { /* ignore if read-only */ }
      }
      if (parsed.params && typeof req.params === 'object') {
        try { Object.assign(req.params, parsed.params); } catch (e) { /* ignore if read-only */ }
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const fields = error.flatten().fieldErrors;
        return sendError(res, "VALIDATION_ERROR", "Validation failed", 400, fields);
      }
      next(error);
    }
  };
