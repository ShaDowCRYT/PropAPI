import { prisma } from "../lib/prisma";
import { config } from "../config";
import { getHandler } from "./handlers";

let activeCount = 0;
let shuttingDown = false;

async function claimNextJob() {
  const rows = await prisma.$queryRaw<any[]>`
    UPDATE jobs
    SET status = 'PROCESSING', "startedAt" = now()
    WHERE id = (
      SELECT id FROM jobs
      WHERE status = 'PENDING' AND "runAt" <= now()
      ORDER BY "runAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *;
  `;
  return rows[0] ?? null;
}

function backoffDelayMs(attempts: number) {
  const exponential = config.jobs.baseBackoffMs * Math.pow(2, attempts);
  const jitter = Math.random() * config.jobs.baseBackoffMs;
  return exponential + jitter;
}

async function processJob(job: any) {
  activeCount++;
  console.log(`[worker] claimed job ${job.id} (${job.type}), attempt ${job.attempts + 1}`);
  try {
    const handler = getHandler(job.type);
    if (!handler) {
      throw new Error(`No handler registered for job type "${job.type}"`);
    }

    await handler(job.payload as Record<string, unknown>);

    await prisma.job.update({
      where: { id: job.id },
      data: { status: "SUCCEEDED", finishedAt: new Date() },
    });
    console.log(`[worker] job ${job.id} SUCCEEDED`);
  } catch (err: any) {
    const attempts = job.attempts + 1;
    const errorMessage = err?.message ?? String(err);

    if (attempts >= job.maxAttempts) {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: "DEAD",
          attempts,
          lastError: errorMessage,
          finishedAt: new Date(),
        },
      });
      console.log(`[worker] job ${job.id} DEAD after ${attempts} attempts: ${errorMessage}`);
    } else {
      const delay = backoffDelayMs(attempts);
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: "PENDING",
          attempts,
          lastError: errorMessage,
          runAt: new Date(Date.now() + delay),
        },
      });
      console.log(`[worker] job ${job.id} FAILED (attempt ${attempts}), retrying in ${Math.round(delay)}ms: ${errorMessage}`);
    }
  } finally {
    activeCount--;
  }
}

async function sweepStuckJobs() {
  const cutoff = new Date(Date.now() - config.jobs.stuckTimeoutMs);
  const result = await prisma.job.updateMany({
    where: { status: "PROCESSING", startedAt: { lt: cutoff } },
    data: { status: "PENDING" },
  });
  if (result.count > 0) {
    console.log(`[worker] swept ${result.count} stuck job(s) back to PENDING`);
  }
}

async function loop() {
  console.log(`[worker] started, concurrency=${config.jobs.concurrency}`);
  while (!shuttingDown) {
    await sweepStuckJobs();

    while (activeCount < config.jobs.concurrency) {
      const job = await claimNextJob();
      if (!job) break;
      processJob(job); // intentionally not awaited, so multiple jobs run concurrently
    }

    await new Promise((r) => setTimeout(r, config.jobs.pollIntervalMs));
  }
}

process.on("SIGINT", () => {
  console.log("[worker] shutting down...");
  shuttingDown = true;
});

loop();
