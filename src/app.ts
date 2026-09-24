import express from "express";
import "./lib/json";
import listingsRouter from "./routes/listings";
import agentsRouter from "./routes/agents";
import viewingsRouter from "./routes/viewings";
import reviewsRouter from "./routes/reviews";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { rateLimiter } from "./middleware/rateLimit";

export function createApp() {
  const app = express();

  app.use(express.json());

  app.use(rateLimiter);

  app.use("/api/v1/listings", listingsRouter);
  app.use("/api/v1/agents", agentsRouter);
  app.use("/api/v1/viewings", viewingsRouter);
  app.use("/api/v1/reviews", reviewsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}