# Task 2 — Background Jobs

> This task is built inside the same repository as Task 1 (PropAPI), rather than as a separate repo. The reason: Task 2's brief asks for background work tied to a real trigger event, and PropAPI's existing `Viewing` booking flow (`POST /api/v1/viewings`) is exactly that — a real write path where a slow, unreliable side effect (sending a confirmation email) naturally belongs in the background rather than blocking the request. Building it here means the job system operates on a real resource with real data, not a synthetic example. See `README.md` for Task 1's documentation.

## What this does

When someone books a property viewing, instead of sending a confirmation email inline (which would make the request wait on a real SMTP server), the API saves a **job** and returns immediately. A separate **worker** process picks up pending jobs and sends the email through Ethereal (a real SMTP testing service).

## Job lifecycle

`PENDING` → `PROCESSING` → `SUCCEEDED`
`PENDING` → `PROCESSING` → `FAILED` → (retries with backoff) → `PENDING` → ... → `DEAD` (after max attempts)

- **FAILED** means it will retry.
- **DEAD** means it has exhausted retries and needs a human to look at it.

## TODO as we build

- [ ] Job table (done — see migration `add_jobs_table`)
- [ ] Enqueue path (create job on viewing booking, return 202)
- [ ] Worker process (atomic claim, concurrency cap)
- [ ] Failure handling (exponential backoff with jitter)
- [ ] Idempotent email sending
- [ ] Stuck job recovery (sweep)
- [ ] Dead letter view
- [ ] Status endpoint
- [ ] Break-it-on-purpose tests + evidence
