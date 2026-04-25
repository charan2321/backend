import { ZodError, ZodTypeAny } from "zod";
import { sendError } from "../utils/response.js";

export const validate =
  (schema: ZodTypeAny) =>
  (req: any, res: any, next: any): any => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const fields = error.flatten().fieldErrors;
        return sendError(res, "VALIDATION_ERROR", "Validation failed", 400, fields);
      }
      next(error);
    }
  };
