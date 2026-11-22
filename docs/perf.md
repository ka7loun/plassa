# Performance and scalability notes

All numbers on this page were measured, not estimated. Every run can be repeated with the commands below.

**Where it ran:** one laptop (Intel i7-13650HX, 16 GB RAM, Windows 11, Node 22.18) with a production build (`next build && next start`) as a single Node process. PostgreSQL 18.7 ran locally on the same machine. Load generator and server shared the CPU, so these are conservative figures for one instance, not a cluster.

## 1. HTTP load test (autocannon)

`load/run.ts` runs 20 seconds per scenario against the production server. Raw output: [`docs/tests/load-results.json`](tests/load-results.json).

| Scenario | Connections | Requests | Req/s | p50 | p90 | p99 | Errors | Status codes |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Search spots (geo radius + availability for a time window) | 50 | 8,384 | 419 | 120 ms | 137 ms | 195 ms | 0 | 200: 8,384 |
| Spot detail + 36 h schedule | 50 | 8,019 | 401 | 123 ms | 144 ms | 205 ms | 0 | 200: 8,019 |
| Booking burst (20 drivers fighting over 360 slots) | 20 | 6,544 | 327 | 60 ms | 68 ms | 83 ms | 0 | 201: 360, 409: 6,184 |

How to read the booking burst: each of the 360 one-hour slots on the same spot was requested about 18 times. Exactly one request per slot got `201 Created`; every other request got `409 slot_taken`. After the run, a query for overlapping live bookings returned **0**. Correctness held under contention, and refusals stayed fast.

The search scenario rotates across six Sousse neighbourhoods and five time windows, and sends `x-plassa-nolog: 1` so the run does not pollute the demand heatmap. No caching layer sits in front: every request is a real database query.

## 2. Search query at city and country scale

`scripts/bench-search.ts` loads synthetic spots into a separate database (`plassa_bench`), spread over 8 Tunisian coastal cities. It then runs the production search query 60 times per size with `EXPLAIN ANALYZE`. Raw output: [`docs/tests/search-scale.json`](tests/search-scale.json).

| Spots in database | p50 | p95 | max | Indexes used |
|---:|---:|---:|---:|---|
| 10,000 | 0.91 ms | 1.32 ms | 1.69 ms | `spots_earth_gist`, `bookings_no_overlap` |
| 100,000 | 29.2 ms | 31.4 ms | 31.8 ms | `spots_earth_gist`, `bookings_no_overlap` |

At 100,000 spots the synthetic data puts about 12,500 spots in each city, roughly 900 inside a 1.8 km radius. That is far denser than any real parking market. Even then the query stays near 30 ms because the GiST index on `ll_to_earth(lat, lng)` narrows the search to a bounding box before any distance is computed. The availability check uses the same GiST index as the double-booking constraint. Sousse today would have hundreds of spots, not tens of thousands.

## 3. Concurrency (integration test)

`tests/api/concurrency-and-hosts.test.ts` fires 50 booking requests for the same spot and time at once:

- 1 confirmed, 49 refused with `slot_taken`, in about 150 ms.
- The guarantee comes from a PostgreSQL exclusion constraint, not from application code:

```sql
exclude using gist (spot_id with =, tstzrange(start_at, end_at, '[)') with &&)
  where (status in ('pending_payment', 'confirmed', 'checked_in'))
```

Two app servers, ten app servers, or a retry storm cannot create a double booking, because the database rejects the second row (`23P01`). The app maps that error to HTTP 409.

## 4. Why this design scales

| Claim | What backs it in the code |
|---|---|
| The app tier scales horizontally | No in-memory state. Sessions are signed JWT cookies (`src/server/auth.ts`). Any instance can serve any request. |
| No double booking at any scale | Exclusion constraint above, tested with 50 parallel requests and a 6,544-request burst. |
| Geo search stays fast as supply grows | `earth_box` and a GiST index: under 2 ms at 10k spots, about 30 ms at 100k on a laptop. |
| Serverless-friendly database use | Small pool per instance (`DB_POOL_MAX`, default 5 when hosted), meant to sit behind the provider's pooler (Neon / Supabase PgBouncer). |
| Multi-city rollout is data, not code | `cities` and `zones` tables. Monastir is already seeded beside Sousse. A new city is a seed row and a map centre. |
| Payments can change without a rewrite | `PaymentProvider` interface (`src/lib/payments.ts`). Cash and a simulated wallet today; Flouci or D17 become a third class. |
| Abandoned wallet payments do not block spots | Pending bookings hold the slot for 15 minutes, then expire automatically. |

## 5. Known limits (honest list)

- Rate limiting is per instance, in memory. With several instances it needs a shared store (Redis or a Postgres table).
- The load test ran on one laptop. A hosted run against a staging deploy is the next measurement.
- Demand logging writes one row per search. At high volume it should be batched or sampled.
- Map tiles come from CARTO's public basemap (OpenStreetMap data). Production traffic needs a tile plan or self-hosted tiles.

## Reproduce

```powershell
npm run db:local        # embedded PostgreSQL on port 54329 (keep it running)
npm run db:setup        # migrate + seed
npm run build
$env:BOOKING_RATE_PER_MIN = "1000000"; npx next start -p 3100   # in a second terminal
$env:LOAD_URL = "http://localhost:3100"; npm run load
npx tsx scripts/bench-search.ts 10000,100000
```

The booking rate limit is lifted only for the load run. Its default is 30 bookings per minute per user.
