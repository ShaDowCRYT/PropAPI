import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const jobs = Array.from({ length: 50 }).map((_, i) => ({
    type: "slow_job",
    payload: {},
    idempotencyKey: `slow-job-test-${Date.now()}-${i}`,
  }));
  await prisma.job.createMany({ data: jobs });
  console.log("Inserted 50 slow_job rows.");
}

main().finally(() => prisma.$disconnect());
