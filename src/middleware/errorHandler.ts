import fs from "fs";
import { NextFunction, Request, Response } from "express";
import { sendError } from "../utils/response.js";

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response => {
  if (process.env.NODE_ENV !== "production") {
    console.error("API error:", err);
    try {
      fs.appendFileSync("error.log", new Date().toISOString() + "\\n" + (err.stack || err.message) + "\\n\\n");
    } catch(e) {}
  }

  let statusCode = err.statusCode ?? 500;
  let code = err.code ?? (typeof err.code === 'string' ? err.code : "INTERNAL_ERROR");
  let message = statusCode === 500 ? "Internal server error" : err.message;
  let fields = err.fields;

  // Handle Mongoose CastError (Invalid ObjectId)
  if (err.name === "CastError") {
    statusCode = 400;
    code = "INVALID_ID";
    message = `Invalid format for ${err.path}`;
  }

  // Handle Mongoose ValidationError
  if (err.name === "ValidationError") {
    statusCode = 400;
    code = "VALIDATION_ERROR";
    message = "Database validation failed";
    fields = {};
    for (const field in err.errors) {
      fields[field] = [err.errors[field].message];
    }
  }

  // Handle MongoDB Duplicate Key Error
  if (err.code === 11000) {
    statusCode = 409;
    code = "DUPLICATE_ENTRY";
    message = "Duplicate value entered for a unique field";
  }

  return sendError(res, code, message, statusCode, fields);
};
