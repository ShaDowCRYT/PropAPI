import { prisma } from "../lib/prisma";

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

claimNextJob().then((result) => {
  console.log("Result:", result);
  process.exit(0);
});
