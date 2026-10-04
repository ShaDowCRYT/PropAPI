# Task 2 — Background Jobs

> This task is built inside the same repository as Task 1 (PropAPI), rather than as a separate repo. Task 2's brief asks for background work tied to a real trigger event, and PropAPI's existing `Viewing` booking flow (`POST /api/v1/viewings`) is exactly that — a real write path where a slow, unreliable side effect (sending a confirmation email) naturally belongs in the background rather than blocking the request. See `README.md` for Task 1's documentation.

## What this does

When someone books a property viewing, instead of sending a confirmation email inline (which would make the request wait on a real SMTP server), the API saves a **job** and returns immediately (`201`, same as before — the job creation is a side effect of the viewing being created, not a separate endpoint). A separate **worker** process picks up pending jobs and sends the email through Ethereal, a real SMTP testing service.

## Job lifecycle

```
PENDING → PROCESSING → SUCCEEDED
PENDING → PROCESSING → FAILED → (backoff delay) → PENDING → ... → DEAD (after maxAttempts)
```

- **FAILED** means it will retry.
- **DEAD** means it has exhausted retries (default `maxAttempts: 5`) and needs a human to look at it, via the dead letter view.
- A job stuck in **PROCESSING** for longer than `stuckTimeoutMs` (60s) is assumed to belong to a crashed worker and is swept back to **PENDING** automatically.

## How to run it

```bash
npm run dev      # the API (unchanged from Task 1)
npm run worker   # the background worker — run this in a separate terminal
```

The worker polls for pending jobs once per second, claims up to 3 at a time (`config.jobs.concurrency`), and processes them concurrently.

## Design decisions

**Why the enqueue path doesn't return 202 from a dedicated endpoint.** The brief's default shape is "a request handler that only writes a job row and returns 202." In this project, the *viewing* is the primary resource being created, and the confirmation email is a side effect of that — so `POST /api/v1/viewings` correctly still returns `201` for the viewing itself. The job is created as a secondary effect inside the same handler, via a shared `enqueueJob()` helper, rather than being enqueued through its own endpoint.

**Idempotency at the database level, not just in code.** `enqueueJob()` checks for an existing job first, but the real guarantee is a `@unique` constraint on `idempotencyKey` in the schema. If two requests race past the initial check at the same time, only one `INSERT` can win — the loser gets a unique-constraint violation (Postgres error code `P2002`), which we catch and turn into "return the winner's row" rather than a crash. Application logic alone (check-then-insert) can never fully prevent this race; the database constraint is what actually closes it.

**Atomic claim via `FOR UPDATE SKIP LOCKED`.** Two workers polling at the same moment must never process the same job. `claimNextJob()` uses a single raw SQL statement — `UPDATE jobs SET status = 'PROCESSING' WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *` — so the "find a job" and "claim it" happen as one atomic database operation. `SKIP LOCKED` means a second worker hitting this at the same instant simply skips any row the first worker has already locked, rather than blocking or double-claiming it. This was verified directly (see evidence) by running two worker processes simultaneously against 20 jobs: each job was claimed exactly once.

**Exponential backoff with jitter.** Retry delay is `baseBackoffMs × 2^attempts`, plus a random amount up to `baseBackoffMs`. Without the random jitter, many jobs that failed at the same moment (e.g. because a downstream provider went down) would all retry at exactly the same moment and immediately hit the same failure again, in sync, indefinitely. The jitter spreads retries out over time.

**Not-await-ing `processJob()` in the worker loop.** The loop calls `processJob(job)` without `await`, on purpose, so multiple jobs can be in flight concurrently up to the configured cap — `activeCount` (incremented/decremented inside `processJob`) is what actually enforces the concurrency limit, not the loop's own sequencing.

## Evidence

All evidence is saved under `Evidence Task 2/` in this repository.

| Requirement | File |
|---|---|
| Jobs table showing every status | `jobs-all-statuses.png` |
| Backoff delays growing between attempts, ending in DEAD | `backoff-timestamps.png` |
| Concurrency cap holding under 50 jobs | `concurrency-cap-50-jobs.png` |
| Stuck-job recovery (before kill / after kill / after recovery) | `stuck-job-before.png`, `stuck-job-after-recovery.png` |
| Dead letter view with a job in it | `dead-letter-view.png` |
| Two workers running concurrently, no double-claim | `two-workers-no-collision.png` |
| Duplicate idempotency key rejected at the database | `duplicate-idempotency-key.png` |

### Summary of what each test proved

1. **100% failure rate** — a job that always throws was retried 5 times with growing delays (4068ms → 9139ms → 17400ms → 33451ms) before being marked `DEAD`.
2. **Concurrency cap** — 50 jobs inserted at once were processed in clean batches of exactly 3 concurrent claims throughout, never exceeding the configured cap.
3. **Stuck-job recovery** — a worker was killed mid-job; the job was confirmed stuck in `PROCESSING`; after the 60-second timeout, restarting the worker logged `swept 1 stuck job(s) back to PENDING` and immediately reprocessed it successfully.
4. **Two workers, no collision** — 20 jobs were split between two simultaneously-running worker processes with zero overlap; all 20 completed exactly once.
5. **Duplicate idempotency key** — inserting the same `idempotencyKey` twice resulted in exactly one row; the second insert was silently rejected by the database's unique constraint.

## Defence prep

**Two workers are running. Walk me through exactly how you guarantee they never process the same job.**
`claimNextJob()` runs one raw SQL statement: it selects a single pending, due job `FOR UPDATE SKIP LOCKED`, and in the same statement updates its status to `PROCESSING`. Postgres guarantees this select-and-lock happens atomically. If a second worker's query runs at the same instant, `SKIP LOCKED` tells it to ignore any row currently locked by the first worker's transaction and pick a different one instead — so it's structurally impossible for two workers to both receive the same row from this query.

**Your worker crashed after sending the email but before marking the job done. What happens when it restarts?**
The job is left in `PROCESSING` with no worker updating it. After `stuckTimeoutMs` (60s), the next worker's sweep resets it to `PENDING`, and it gets reclaimed and re-run. Because `handleSendViewingConfirmationEmail` checks for an existing `SUCCEEDED` job with the same `idempotencyKey` before sending, a second real send is prevented — though in the current implementation this check happens inside the handler itself rather than being enforced by the database, so it protects against this specific re-run scenario but is not as airtight as the enqueue-side unique constraint.

**Why jitter? Show me the line.**
`const jitter = Math.random() * config.jobs.baseBackoffMs;` in `backoffDelayMs()`. Without it, many jobs failing at the same moment would all compute the exact same retry delay and retry in lockstep, repeatedly hitting a struggling downstream service at the same instant.

**A job has been in `processing` for an hour. What does your system do about it and when?**
Every worker loop iteration (roughly once per second) calls `sweepStuckJobs()`, which resets any job in `PROCESSING` with a `startedAt` older than `stuckTimeoutMs` (60 seconds) back to `PENDING`. So within about a second of the next worker's poll cycle after the 60-second mark, it would be caught and requeued — it would not still be sitting in `PROCESSING` after an hour under normal operation.