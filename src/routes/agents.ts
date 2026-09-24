import { Router } from "express";
import { prisma } from "../lib/prisma";
import { sendData } from "../lib/envelope";
import { parsePagination, parseSort, buildMeta } from "../lib/pagination";
import { parseIdParam } from "../lib/idParam";
import { notFound } from "../lib/errors";

const router = Router();

const ALLOWED_SORT_FIELDS = ["createdAt", "name"];

router.get("/", async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query as Record<string, unknown>);
    const { field, order } = parseSort(req.query as Record<string, unknown>, ALLOWED_SORT_FIELDS, "createdAt");

    const [total, agents] = await Promise.all([
      prisma.agent.count(),
      prisma.agent.findMany({
        orderBy: { [field]: order },
        take: limit,
        skip: offset,
      }),
    ]);

    sendData(res, agents, buildMeta(total, limit, offset));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent) {
      throw notFound("Agent not found");
    }
    sendData(res, agent);
  } catch (err) {
    next(err);
  }
});

export default router;