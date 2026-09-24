import { Response } from "express";

export function sendData(res: Response, data: unknown, meta?: Record<string, unknown>, status = 200) {
  res.status(status).json(meta ? { data, meta } : { data });
}

export function sendError(res: Response, status: number, code: string, message: string, details?: unknown) {
  res.status(status).json({ error: details ? { code, message, details } : { code, message } });
}