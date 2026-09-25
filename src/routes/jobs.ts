import { Router } from "express";
import { prisma } from "../lib/prisma";
import { sendData } from "../lib/envelope";
import { parseIdParam } from "../lib/idParam";
import { notFound, badRequest } from "../lib/errors";

const router = Router();

router.get("/:id", async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) {
      throw notFound("Job not found");
    }
    sendData(res, job);
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined;
    const where = status ? { status: status.toUpperCase() as any } : {};
    const jobs = await prisma.job.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    sendData(res, jobs);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/retry", async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) {
      throw notFound("Job not found");
    }
    if (job.status !== "DEAD") {
      throw badRequest("Only DEAD jobs can be manually retried");
    }
    const updated = await prisma.job.update({
      where: { id },
      data: { status: "PENDING", attempts: 0, runAt: new Date(), lastError: null },
    });
    sendData(res, updated);
  } catch (err) {
    next(err);
  }
});

export default router;
