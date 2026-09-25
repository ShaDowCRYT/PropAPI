import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { enqueueJob } from "../lib/jobs";
import { sendData } from "../lib/envelope";
import { parsePagination, parseSort, buildMeta } from "../lib/pagination";
import { parseIdParam } from "../lib/idParam";
import { notFound, unprocessable, badRequest } from "../lib/errors";

const router = Router();

const ALLOWED_SORT_FIELDS = ["createdAt", "scheduledAt"];
const ALLOWED_STATUSES = ["REQUESTED", "CONFIRMED", "COMPLETED", "CANCELLED"];

const createViewingSchema = z.object({
  listingId: z.string().uuid({ message: "listingId must be a valid identifier" }),
  requesterName: z.string().min(1, "requesterName is required"),
  requesterEmail: z.string().email("requesterEmail must be a valid email"),
  requesterPhone: z.string().optional(),
  scheduledAt: z.string().datetime({ message: "scheduledAt must be an ISO 8601 datetime" }),
});

const updateViewingSchema = z.object({
  status: z.enum(["REQUESTED", "CONFIRMED", "COMPLETED", "CANCELLED"]).optional(),
  scheduledAt: z.string().datetime().optional(),
}).refine((data) => data.status !== undefined || data.scheduledAt !== undefined, {
  message: "At least one of 'status' or 'scheduledAt' must be provided",
});

router.get("/", async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query as Record<string, unknown>);
    const { field, order } = parseSort(req.query as Record<string, unknown>, ALLOWED_SORT_FIELDS, "createdAt");

    const where: Record<string, unknown> = {};
    if (req.query.status !== undefined) {
      const status = String(req.query.status).toUpperCase();
      if (!ALLOWED_STATUSES.includes(status)) {
        throw badRequest(`Query parameter 'status' must be one of: ${ALLOWED_STATUSES.join(", ")}`);
      }
      where.status = status;
    }
    if (req.query.listingId !== undefined) {
      where.listingId = parseIdParam(String(req.query.listingId));
    }

    const [total, viewings] = await Promise.all([
      prisma.viewing.count({ where }),
      prisma.viewing.findMany({
        where,
        orderBy: { [field]: order },
        take: limit,
        skip: offset,
      }),
    ]);

    sendData(res, viewings, buildMeta(total, limit, offset));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    const viewing = await prisma.viewing.findUnique({ where: { id } });
    if (!viewing) {
      throw notFound("Viewing not found");
    }
    sendData(res, viewing);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const result = createViewingSchema.safeParse(req.body);
    if (!result.success) {
      throw unprocessable("Invalid viewing data", result.error.flatten().fieldErrors);
    }

    const listing = await prisma.listing.findUnique({ where: { id: result.data.listingId } });
    if (!listing) {
      throw unprocessable("listingId does not refer to an existing listing", { field: "listingId" });
    }

    const viewing = await prisma.viewing.create({
      data: {
        listingId: result.data.listingId,
        requesterName: result.data.requesterName,
        requesterEmail: result.data.requesterEmail,
        requesterPhone: result.data.requesterPhone,
        scheduledAt: new Date(result.data.scheduledAt),
      },
    });

    await enqueueJob(
      "send_viewing_confirmation_email",
      { viewingId: viewing.id },
      `viewing-confirmation-${viewing.id}`
    );

    sendData(res, viewing, undefined, 201);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);

    const result = updateViewingSchema.safeParse(req.body);
    if (!result.success) {
      throw unprocessable("Invalid update data", result.error.flatten().fieldErrors);
    }

    const existing = await prisma.viewing.findUnique({ where: { id } });
    if (!existing) {
      throw notFound("Viewing not found");
    }

    const data: Record<string, unknown> = {};
    if (result.data.status !== undefined) data.status = result.data.status;
    if (result.data.scheduledAt !== undefined) data.scheduledAt = new Date(result.data.scheduledAt);

    const updated = await prisma.viewing.update({ where: { id }, data });
    sendData(res, updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    const existing = await prisma.viewing.findUnique({ where: { id } });
    if (!existing) {
      throw notFound("Viewing not found");
    }
    await prisma.viewing.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;