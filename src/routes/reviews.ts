import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { sendData } from "../lib/envelope";
import { parsePagination, buildMeta } from "../lib/pagination";
import { parseIdParam } from "../lib/idParam";
import { notFound, unprocessable } from "../lib/errors";

const router = Router();

const createReviewSchema = z.object({
  viewingId: z.string().uuid({ message: "viewingId must be a valid identifier" }),
  rating: z.number().int().min(1).max(5, "rating must be between 1 and 5"),
  comment: z.string().optional(),
});

router.get("/", async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query as Record<string, unknown>);

    const where: Record<string, unknown> = {};
    if (req.query.agentId !== undefined) {
      where.agentId = parseIdParam(String(req.query.agentId));
    }

    const [total, reviews] = await Promise.all([
      prisma.review.count({ where }),
      prisma.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
    ]);

    sendData(res, reviews, buildMeta(total, limit, offset));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) {
      throw notFound("Review not found");
    }
    sendData(res, review);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const result = createReviewSchema.safeParse(req.body);
    if (!result.success) {
      throw unprocessable("Invalid review data", result.error.flatten().fieldErrors);
    }

    const viewing = await prisma.viewing.findUnique({ where: { id: result.data.viewingId } });
    if (!viewing) {
      throw unprocessable("viewingId does not refer to an existing viewing", { field: "viewingId" });
    }
    if (viewing.status !== "COMPLETED") {
      throw unprocessable("A review can only be left for a completed viewing", { field: "viewingId" });
    }

    const existingReview = await prisma.review.findUnique({ where: { viewingId: result.data.viewingId } });
    if (existingReview) {
      throw unprocessable("A review already exists for this viewing", { field: "viewingId" });
    }

    // Look up the listing's agent through the viewing, since a review belongs to the agent, not the listing directly.
    const listing = await prisma.listing.findUnique({ where: { id: viewing.listingId } });
    if (!listing) {
      throw unprocessable("The listing for this viewing no longer exists", { field: "viewingId" });
    }

    const review = await prisma.review.create({
      data: {
        agentId: listing.agentId,
        viewingId: result.data.viewingId,
        rating: result.data.rating,
        comment: result.data.comment,
      },
    });

    sendData(res, review, undefined, 201);
  } catch (err) {
    next(err);
  }
});

export default router;