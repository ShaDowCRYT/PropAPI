import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";

export async function enqueueJob(type: string, payload: Record<string, unknown>, idempotencyKey: string) {
  const existing = await prisma.job.findUnique({ where: { idempotencyKey } });
  if (existing) {
    return existing;
  }

  try {
    return await prisma.job.create({
      data: {
        type,
        payload: payload as Prisma.InputJsonValue,
        idempotencyKey,
      },
    });
  } catch (err) {
    // Two requests racing to create the same job can both pass the findUnique
    // check before either commits. The unique constraint on idempotencyKey is
    // the real guard; if we lose the race, fetch and return the winner's row.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const winner = await prisma.job.findUnique({ where: { idempotencyKey } });
      if (winner) return winner;
    }
    throw err;
  }
}