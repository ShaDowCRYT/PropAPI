import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { sendData } from "../lib/envelope";
import { parsePagination, parseSort, buildMeta } from "../lib/pagination";
import { parseIdParam } from "../lib/idParam";
import { notFound, badRequest } from "../lib/errors";

const router = Router();

const ALLOWED_SORT_FIELDS = ["createdAt", "priceMinorUnits", "title"];
const ALLOWED_PROPERTY_TYPES = ["HOUSE", "APARTMENT", "LAND", "COMMERCIAL"];
const ALLOWED_STATUSES = ["AVAILABLE", "UNDER_OFFER", "SOLD", "LET"];

router.get("/", async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query as Record<string, unknown>);
    const { field, order } = parseSort(req.query as Record<string, unknown>, ALLOWED_SORT_FIELDS, "createdAt");

    const where: Record<string, unknown> = {};

    if (req.query.propertyType !== undefined) {
      const propertyType = String(req.query.propertyType).toUpperCase();
      if (!ALLOWED_PROPERTY_TYPES.includes(propertyType)) {
        throw badRequest(`Query parameter 'propertyType' must be one of: ${ALLOWED_PROPERTY_TYPES.join(", ")}`);
      }
      where.propertyType = propertyType;
    }

    if (req.query.status !== undefined) {
      const status = String(req.query.status).toUpperCase();
      if (!ALLOWED_STATUSES.includes(status)) {
        throw badRequest(`Query parameter 'status' must be one of: ${ALLOWED_STATUSES.join(", ")}`);
      }
      where.status = status;
    }

    if (req.query.minPrice !== undefined) {
      const minPriceSchema = z.coerce.number().int().nonnegative();
      const result = minPriceSchema.safeParse(req.query.minPrice);
      if (!result.success) {
        throw badRequest("Query parameter 'minPrice' must be a non-negative integer");
      }
      where.priceMinorUnits = { ...(where.priceMinorUnits as object), gte: BigInt(result.data) };
    }

    if (req.query.maxPrice !== undefined) {
      const maxPriceSchema = z.coerce.number().int().nonnegative();
      const result = maxPriceSchema.safeParse(req.query.maxPrice);
      if (!result.success) {
        throw badRequest("Query parameter 'maxPrice' must be a non-negative integer");
      }
      where.priceMinorUnits = { ...(where.priceMinorUnits as object), lte: BigInt(result.data) };
    }

    const [total, listings] = await Promise.all([
      prisma.listing.count({ where }),
      prisma.listing.findMany({
        where,
        orderBy: { [field]: order },
        take: limit,
        skip: offset,
      }),
    ]);

    sendData(res, listings, buildMeta(total, limit, offset));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    const listing = await prisma.listing.findUnique({ where: { id } });
    if (!listing) {
      throw notFound("Listing not found");
    }
    sendData(res, listing);
  } catch (err) {
    next(err);
  }
});

router.get("/:id/viewings", async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    const listing = await prisma.listing.findUnique({ where: { id } });
    if (!listing) {
      throw notFound("Listing not found");
    }

    const { limit, offset } = parsePagination(req.query as Record<string, unknown>);
    const [total, viewings] = await Promise.all([
      prisma.viewing.count({ where: { listingId: id } }),
      prisma.viewing.findMany({
        where: { listingId: id },
        orderBy: { scheduledAt: "asc" },
        take: limit,
        skip: offset,
      }),
    ]);

    sendData(res, viewings, buildMeta(total, limit, offset));
  } catch (err) {
    next(err);
  }
});

export default router;