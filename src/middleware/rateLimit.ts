import rateLimit from "express-rate-limit";
import { config } from "../config";
import { sendError } from "../lib/envelope";

export const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const retryAfterSeconds = Math.ceil(config.rateLimit.windowMs / 1000);
    res.setHeader("Retry-After", String(retryAfterSeconds));
    sendError(res, 429, "TOO_MANY_REQUESTS", "Rate limit exceeded. Try again later.");
  },
});