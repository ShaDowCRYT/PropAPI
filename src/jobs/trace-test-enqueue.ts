import { prisma } from "../lib/prisma";
import { enqueueJob } from "../lib/jobs";

async function main() {
  const freshKey = `trace-enqueue-normal-${Date.now()}`;
  const job1 = await enqueueJob("slow_job", {}, freshKey);
  console.log("Trace 1 (normal):", job1.id, job1.idempotencyKey);

  const job2 = await enqueueJob("slow_job", {}, freshKey);
  console.log("Trace 2 (edge, same key):", job2.id, job2.idempotencyKey, "same id as trace 1?", job2.id === job1.id);

  try {
    await enqueueJob(null as any, {}, `trace-enqueue-invalid-${Date.now()}`);
    console.log("Trace 3 (invalid): did NOT throw -- unexpected");
  } catch (err: any) {
    console.log("Trace 3 (invalid): threw as expected ->", err.message);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });