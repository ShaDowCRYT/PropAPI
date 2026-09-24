# PropAPI — Test Results

## 1. Project Setup

| Check | Result |
|---|---|
| `npm init -y` | PASS — package.json created |
| Dependencies installed (prisma, @prisma/client, @faker-js/faker, express, typescript, ts-node, @types/node, @types/express, zod, express-rate-limit) | PASS |
| `tsconfig.json` (CommonJS, ES2020, outDir `dist`, rootDir `src`) | PASS — `tsc --noEmit` clean |
| `.gitignore` / `.env` / `prisma/` / `src/index.ts` | PASS — created |
| First `npm install` | FAILED on first attempt (interrupted install corrupted esbuild binary, error `EFTYPE`); cleaned `node_modules` and reinstalled successfully |

## 2. Prisma Version Pinning

| Step | Result |
|---|---|
| Dist-tag discovery | `latest` pointed to `8.0.0-rc.15` (a release candidate, not stable) |
| Pin 1 — `prisma@7.10.0` (latest 7.x stable) | Installed, but `prisma validate` failed with P1012: datasource `url` no longer supported in schema files (Prisma 7 breaking change) |
| Pin 2 — `prisma@6.19.3` (final 6.x stable) | PASS — `prisma --version` reported 6.19.3 for both prisma and @prisma/client |
| `prisma validate` on 6.19.3 | FAILED only on missing `DATABASE_URL` in empty `.env` (schema itself parsed fine) |

## 3. Database & Migrations

| Command | Result |
|---|---|
| `npx prisma migrate dev --name init` | PASS — migration `20260924002750_init` created and applied; client generated |
| `.env` contents | `DATABASE_URL: postgresql://postgres:devpassword@localhost:5432/propapi` |
| List tables via Docker (`psql \dt`) | PASS — tables: `_prisma_migrations`, `agents`, `listings`, `reviews`, `viewings` |
| `npx prisma migrate dev --name fix_price_bigint` | PASS — BigInt migration `20260924004314_fix_price_bigint` applied |

## 4. Seeding

| Run | Result |
|---|---|
| Seed attempt 1 | FAILED — runtime error `Unable to fit integer value 13679033600 into INT4 (32-bit signed integer)`; `priceMinorUnits` Int overflow |
| Fix — schema `Int` → `BigInt`; seed returns `BigInt(naira) * 100n` | PASS — seeded 40 agents, 381 listings, 767 viewings, 108 reviews |

## 5. Type Checking

`npx tsc --noEmit` compiles clean after every change (lib/ → routes → app → rate limit).

## 6. API Endpoint Tests

### Listings — `/api/v1/listings`

| Test | Result |
|---|---|
| `GET /api/v1/listings` | PASS — `{data:[20],"meta":{"total":381,"limit":20,"offset":0,"hasMore":true}}` |
| `GET /api/v1/listings?limit=2` | PASS — 2 items, `meta.limit=2` |
| `GET /api/v1/listings/not-a-real-id` | PASS — 400 `BAD_REQUEST` "The id in the URL is not a valid identifier" |
| BigInt serialization | PASS — `priceMinorUnits` returned as string (e.g. `"2460141900"`) via `BigInt.prototype.toJSON` |

### Viewings — `/api/v1/viewings`

| Test | Result |
|---|---|
| POST valid viewing | PASS — 201 created, status `REQUESTED` |
| POST missing required fields | PASS — 422 `UNPROCESSABLE_ENTITY` with per-field details |
| POST listingId `11111111-...` (invalid UUID variant) | PASS — 422, caught by zod UUID validation |
| POST listingId `00000000-...` (valid format, nonexistent) | PASS — 422 "listingId does not refer to an existing listing" |
| PATCH status → CONFIRMED | PASS — 200, status updated |
| DELETE viewing | PASS — 204 No Content |
| Inline `-d "..."` payloads | FAILED — PowerShell strips double quotes on Windows argv, produced invalid JSON (500); resolved via `--data-binary @file` |

### Reviews — `/api/v1/reviews`

| Test | Result |
|---|---|
| POST review for REQUESTED viewing | PASS — 422 "A review can only be left for a completed viewing" |
| POST review for COMPLETED viewing (no prior review) | PASS — 201 created, rating 5 |
| POST duplicate review for same viewing | PASS — 422 "A review already exists for this viewing" |
| Seeded-review detection | PASS — verified via psql join; used a COMPLETED viewing without an existing review for the 201 test |

## 7. Rate Limiting — `express-rate-limit`

| Test | Result |
|---|---|
| 110 rapid requests (window reset) | PASS — exactly 100 × `200` then 10 × `429` |
| `curl -i` real 429 | PASS — headers `RateLimit-Limit: 100`, `RateLimit-Remaining: 0`, `RateLimit-Reset: 24`, `Retry-After: 60`; body `{"error":{"code":"TOO_MANY_REQUESTS","message":"Rate limit exceeded. Try again later."}}` |
| `-o $null` body suppression | FAILED on Windows — curl printed bodies; use `-o NUL` instead |

## 8. Environment / Platform Notes

- `docker exec -it` fails in non-interactive shells (`cannot attach stdin...`) — use `docker exec` without `-it`.
- psql double-quoted identifiers are stripped by Windows argv handling — pipe SQL via stdin (`docker exec -i ... psql ...`).
- `package.json#prisma` seed config emits a deprecation warning on 6.x but works.
- `curl` in PowerShell aliases to `Invoke-WebRequest` — always use `curl.exe`.

## Current State

Server running on `http://localhost:3000` (background process; log at `C:\Users\HomePC\AppData\Local\Temp\opencode\propapi-dev.log`). All routes under `/api/v1/` operational: listings, agents, viewings, reviews. Global rate limit active (100 requests/min).