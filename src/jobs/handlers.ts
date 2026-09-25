import { prisma } from "../lib/prisma";
import { sendEmail } from "../lib/mailer";

export async function handleSendViewingConfirmationEmail(payload: Record<string, unknown>) {
  const viewingId = payload.viewingId as string;

  const viewing = await prisma.viewing.findUnique({
    where: { id: viewingId },
    include: { listing: true },
  });

  if (!viewing) {
    // The viewing is gone (deleted). Nothing sensible to do — treat as done,
    // not a failure, since retrying can never succeed.
    return;
  }

  // Idempotency: if we already have proof this exact email went out, don't
  // send it again, even if this job is being re-run after a crash.
  const alreadySent = await prisma.job.findFirst({
    where: {
      idempotencyKey: `viewing-confirmation-${viewingId}`,
      status: "SUCCEEDED",
    },
  });
  if (alreadySent) {
    return;
  }

  const { previewUrl } = await sendEmail(
    viewing.requesterEmail,
    `Viewing confirmed: ${viewing.listing.title}`,
    `Hi ${viewing.requesterName},\n\nYour viewing for "${viewing.listing.title}" at ${viewing.listing.location} is scheduled for ${viewing.scheduledAt.toISOString()}.\n\nSee you then!`
  );

  console.log(`Email sent for viewing ${viewingId}. Preview: ${previewUrl}`);
}

export async function handleAlwaysFail(payload: Record<string, unknown>) {
  throw new Error("This job always fails, on purpose, for testing.");
}

export async function handleSlowJob(payload: Record<string, unknown>) {
  await new Promise((resolve) => setTimeout(resolve, 3000));
}

const handlers: Record<string, (payload: Record<string, unknown>) => Promise<void>> = {
  send_viewing_confirmation_email: handleSendViewingConfirmationEmail,
  always_fail: handleAlwaysFail,
  slow_job: handleSlowJob,
};

export function getHandler(type: string) {
  return handlers[type];
}
