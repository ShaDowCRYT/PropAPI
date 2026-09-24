# PropAPI

A REST API serving realistic Lagos property listing data, built for Task 1 of the bootcamp's Five Engineering Tasks. Covers agents, listings, viewings (booked property viewings), and reviews.

**Live API URL:** `TODO — fill in after deployment`

## Tech stack

- Node.js + TypeScript
- Express
- Prisma (pinned to `6.19.3` — see "Design decisions" for why)
- PostgreSQL
- Zod for request validation
- Faker for seed data
- express-rate-limit for rate limiting

## Resources and relationships

| Resource | Description |
|---|---|
| **Agent** | A real-estate agent who owns listings |
| **Listing** | A property for sale/let, owned by one Agent |
| **Viewing** | A booked viewing of one Listing, made by a prospective buyer/renter |
| **Review** | A rating left for an Agent, tied to one completed Viewing |

**Relationships:**
- One Agent → many Listings
- One Listing → many Viewings
- One Agent → many Reviews (each Review is tied to exactly one completed Viewing)

### Field tables

**Agent**

| Field | Type | Required |
|---|---|---|
| id | UUID | yes |
| name | string | yes |
| email | string (unique) | yes |
| phone | string | no |
| agencyName | string | no |
| createdAt | datetime | yes |

**Listing**

| Field | Type | Required |
|---|---|---|
| id | UUID | yes |
| agentId | UUID (FK → Agent) | yes |
| title | string | yes |
| description | text | no |
| propertyType | enum: HOUSE / APARTMENT / LAND / COMMERCIAL | yes |
| priceMinorUnits | BigInt (kobo) | yes |
| currency | string | yes |
| location | string | yes |
| bedrooms | integer | no |
| bathrooms | integer | no |
| sizeSqm | integer | no |
| status | enum: AVAILABLE / UNDER_OFFER / SOLD / LET | yes |
| createdAt / updatedAt | datetime | yes |

**Viewing**

| Field | Type | Required |
|---|---|---|
| id | UUID | yes |
| listingId | UUID (FK → Listing) | yes |
| requesterName | string | yes |
| requesterEmail | string | yes |
| requesterPhone | string | no |
| scheduledAt | datetime | yes |
| status | enum: REQUESTED / CONFIRMED / COMPLETED / CANCELLED | yes |
| createdAt | datetime | yes |

**Review**

| Field | Type | Required |
|---|---|---|
| id | UUID | yes |
| agentId | UUID (FK → Agent) | yes |
| viewingId | UUID (FK → Viewing, unique) | yes |
| rating | integer 1–5 | yes |
| comment | text | no |
| createdAt | datetime | yes |

## Setup

```bash
npm install
```

Create a `.env` file:

```
DATABASE_URL="postgresql://postgres:devpassword@localhost:5432/propapi"
PORT=3000
```

Run the database migration:

```bash
npx prisma migrate dev
```

Seed the database (safe to run repeatedly — it wipes and reloads, never duplicates):

```bash
npx prisma db seed
```

Start the server:

```bash
npm run dev
```

The API is now running at `http://localhost:3000`.

## Endpoints

All endpoints are versioned under `/api/v1/`.

### List envelope

Every list endpoint returns:

```json
{
  "data": [ ... ],
  "meta": { "total": 340, "limit": 20, "offset": 0, "hasMore": true }
}
```

### Error envelope

Every error returns:

```json
{ "error": { "code": "NOT_FOUND", "message": "Listing not found" } }
```

---

### `GET /api/v1/listings`

List listings. Supports pagination, filtering, and sorting.

**Query parameters:**
| Param | Type | Default | Notes |
|---|---|---|---|
| limit | integer | 20 | max 100, clamped if exceeded |
| offset | integer | 0 | must be ≥ 0 |
| sort | string | createdAt | one of: createdAt, priceMinorUnits, title |
| order | string | asc | asc or desc |
| propertyType | string | — | HOUSE, APARTMENT, LAND, COMMERCIAL |
| status | string | — | AVAILABLE, UNDER_OFFER, SOLD, LET |
| minPrice | integer | — | in kobo |
| maxPrice | integer | — | in kobo |

```bash
curl "http://localhost:3000/api/v1/listings?propertyType=HOUSE&sort=priceMinorUnits&order=desc&limit=5"
```

```json
{
  "data": [
    { "id": "443ba14e-...", "title": "Cozy house in Magodo", "propertyType": "HOUSE", "priceMinorUnits": "2460141900", "status": "SOLD", "...": "..." }
  ],
  "meta": { "total": 96, "limit": 5, "offset": 0, "hasMore": true }
}
```

### `GET /api/v1/listings/:id`

Get one listing. Returns `404` if not found, `400` if `:id` isn't a valid UUID.

```bash
curl http://localhost:3000/api/v1/listings/443ba14e-d9d3-404a-9907-998da586e665
```

### `GET /api/v1/listings/:id/viewings`

Nested resource — all viewings booked for one listing. Paginated.

```bash
curl "http://localhost:3000/api/v1/listings/443ba14e-d9d3-404a-9907-998da586e665/viewings"
```

---

### `GET /api/v1/agents`

List agents. Supports `limit`, `offset`, `sort` (createdAt, name), `order`.

```bash
curl "http://localhost:3000/api/v1/agents?sort=name&order=asc"
```

### `GET /api/v1/agents/:id`

Get one agent. `404` if not found.

```bash
curl http://localhost:3000/api/v1/agents/ed8379aa-0000-0000-0000-000000000000
```

---

### `GET /api/v1/viewings`

List viewings. Supports `limit`, `offset`, `sort` (createdAt, scheduledAt), `order`, `status`, `listingId`.

```bash
curl "http://localhost:3000/api/v1/viewings?status=COMPLETED&limit=10"
```

### `GET /api/v1/viewings/:id`

Get one viewing. `404` if not found.

### `POST /api/v1/viewings`

Create a viewing request.

**Body:**
```json
{
  "listingId": "443ba14e-d9d3-404a-9907-998da586e665",
  "requesterName": "Test User",
  "requesterEmail": "test@example.com",
  "requesterPhone": "08012345678",
  "scheduledAt": "2026-10-01T10:00:00Z"
}
```

```bash
curl -X POST http://localhost:3000/api/v1/viewings \
  -H "Content-Type: application/json" \
  --data-binary @- <<'EOF'
{"listingId":"443ba14e-d9d3-404a-9907-998da586e665","requesterName":"Test User","requesterEmail":"test@example.com","scheduledAt":"2026-10-01T10:00:00Z"}
EOF
```

Returns `201` with the created viewing. Returns `422` if a required field is missing, or if `listingId` doesn't refer to a real listing.

### `PATCH /api/v1/viewings/:id`

Partially update a viewing's `status` and/or `scheduledAt`.

```bash
curl -X PATCH http://localhost:3000/api/v1/viewings/f596e7eb-cc6c-4762-8a86-a2e61e106594 \
  -H "Content-Type: application/json" \
  --data-binary '{"status":"CONFIRMED"}'
```

Returns `200` with the updated viewing, `404` if not found, `422` if the body has neither field.

### `DELETE /api/v1/viewings/:id`

Delete a viewing. Returns `204` with no body, or `404` if not found.

```bash
curl -X DELETE http://localhost:3000/api/v1/viewings/f596e7eb-cc6c-4762-8a86-a2e61e106594
```

---

### `GET /api/v1/reviews`

List reviews. Supports `limit`, `offset`, `agentId` filter.

```bash
curl "http://localhost:3000/api/v1/reviews?agentId=ed8379aa-0000-0000-0000-000000000000"
```

### `GET /api/v1/reviews/:id`

Get one review. `404` if not found.

### `POST /api/v1/reviews`

Leave a review for an agent, tied to one of their completed viewings.

**Body:**
```json
{ "viewingId": "d75700cb-ea6a-4264-bcd1-fba7b05d9862", "rating": 5, "comment": "Great agent!" }
```

```bash
curl -X POST http://localhost:3000/api/v1/reviews \
  -H "Content-Type: application/json" \
  --data-binary '{"viewingId":"d75700cb-ea6a-4264-bcd1-fba7b05d9862","rating":5,"comment":"Great agent!"}'
```

Returns `201` on success. Returns `422` if: the viewing doesn't exist, the viewing's status isn't `COMPLETED`, or a review already exists for that viewing (one review per viewing, enforced both at the API layer and by a unique database constraint).

---

## Rate limiting

All endpoints are rate limited to **100 requests per 60 seconds, per IP address**. Limits live in `src/config.ts`.

Exceeding the limit returns:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 60
```

```json
{ "error": { "code": "TOO_MANY_REQUESTS", "message": "Rate limit exceeded. Try again later." } }
```

To reproduce this yourself:

```bash
for ($i=1; $i -le 110; $i++) { curl.exe -s -o NUL -w "%{http_code}`n" http://localhost:3000/api/v1/listings }
```

The first ~100 requests return `200`; the rest return `429`.

## Reproducing the tests yourself

With the server running (`npm run dev`) and the database seeded, these commands exercise every endpoint and error case documented above:

```bash
# Pagination and filtering
curl "http://localhost:3000/api/v1/listings"
curl "http://localhost:3000/api/v1/listings?limit=2"

# Bad input handling
curl "http://localhost:3000/api/v1/listings/not-a-real-id"        # 400
curl "http://localhost:3000/api/v1/viewings/not-a-real-id"        # 400

# Write path
curl -X POST http://localhost:3000/api/v1/viewings -H "Content-Type: application/json" --data-binary '{"requesterName":"Test"}'   # 422, missing fields

# Business rules
curl "http://localhost:3000/api/v1/viewings?status=REQUESTED&limit=1"    # find a non-completed viewing, then:
curl -X POST http://localhost:3000/api/v1/reviews -H "Content-Type: application/json" --data-binary '{"viewingId":"<paste id>","rating":5}'   # 422, viewing not completed
```

## Design decisions

**Why these four resources.** Agents/Listings gives the required "3+ related resources with relationships" baseline. Viewings adds a real write path with a lifecycle (`REQUESTED → CONFIRMED → COMPLETED/CANCELLED`) worth validating. Reviews adds a resource with a genuine business rule (must reference a completed viewing, one-per-viewing) rather than being a plain CRUD resource.

**Why generated (UUID) identifiers.** Sequential integer IDs let anyone enumerate the entire dataset by counting (`/listings/1`, `/listings/2`, ...). UUIDs make that infeasible.

**Why offset pagination, not cursor.** Offset pagination (`limit`/`offset`) is simpler to implement and sufficient for a bounded, non-realtime dataset like this one. Its known weakness is that inserting/deleting rows while paging can shift results between pages. Cursor pagination (paging by "the last seen id/createdAt") avoids that and scales better on very large or frequently-changing tables, at the cost of not supporting "jump to page N." For this API's scale and use case, offset pagination's simplicity outweighs that tradeoff.

**Response/error envelope.** Every list response uses `{data, meta}` and every error uses `{error: {code, message}}`, applied identically across all four resources via shared helpers (`src/lib/envelope.ts`), so no endpoint has a one-off shape.

**Money as BigInt, in minor units.** Prices are stored as whole numbers in kobo (NGN minor units) rather than decimals, avoiding floating-point rounding errors. `Int` (32-bit) was tried first and overflowed on realistic high-end Lagos property prices once converted to kobo, so the field uses `BigInt`.

## Known environment quirks (Windows/PowerShell)

- `docker exec -it` fails in a non-interactive shell — use `docker exec` (no `-it`) or pipe SQL via stdin instead.
- PowerShell strips embedded double quotes from inline `curl -d "..."` payloads — use `--data-binary` with a here-string or a file instead.
- PowerShell aliases `curl` to `Invoke-WebRequest`, which behaves differently — use `curl.exe` explicitly.
