import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/errors";
import { sendError } from "../lib/envelope";

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof AppError) {
    return sendError(res, err.status, err.code, err.message, err.details);
  }

  console.error(err);
  return sendError(res, 500, "INTERNAL_ERROR", "Something went wrong");
}

export function notFoundHandler(req: Request, res: Response) {
  return sendError(res, 404, "NOT_FOUND", `No route for ${req.method} ${req.path}`);
}