# Performance and scalability notes

All numbers on this page were measured, not estimated, on 22 November 2026 with demo data version 2 (85 spots in Sousse). Every run can be repeated with the commands below. The full QA report, including functional tests, is in [qa.md](qa.md).

**Where it ran:** one laptop (Intel i7-13650HX, 16 GB RAM, Windows 11, Node 22.18) with a production build (`next build && next start`) as a single Node process. PostgreSQL 18.7 ran locally on the same machine. Load generator and server shared the CPU, so these are conservative figures for one instance, not a cluster.

## 1. HTTP load test (autocannon)

`load/run.ts` runs 20 seconds per scenario against the production server. Raw output: [`docs/tests/load-results.json`](tests/load-results.json).

| Scenario | Connections | Requests | Req/s | p50 | p90 | p99 | Errors | Status codes |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Search spots (geo radius + availability + ranking, 4 sort orders) | 50 | 4,875 | 244 | 203 ms | 228 ms | 287 ms | 0 | 200: 4,875 |
| Spot detail + 36 h schedule + reviews | 50 | 6,287 | 314 | 155 ms | 177 ms | 201 ms | 0 | 200: 6,287 |
| Top spots + host leaderboard | 50 | 6,756 | 338 | 146 ms | 155 ms | 177 ms | 0 | 200: 6,756 |
| Client dashboard (profile, points, badges) | 50 | 4,741 | 237 | 210 ms | 222 ms | 243 ms | 0 | 200: 4,741 |
| Renter dashboard (earnings, rank, reviews) | 50 | 4,600 | 230 | 216 ms | 229 ms | 262 ms | 0 | 200: 4,600 |
| Booking burst (20 drivers fighting over 360 slots) | 20 | 5,716 | 286 | 69 ms | 75 ms | 85 ms | 0 | 201: 360, 409: 5,356 |

**Compared with the first measurement** (29 demo spots, before accounts, photos and ranking), search went from 419 to 244 req/s. Each search now returns about 3 times more spots (29 on average instead of 10; 44 around Bab Bhar, about 39 KB of JSON), each with photos, rating and accepted payment methods, then ranked. In spots delivered per second, the server does more than before: about 7,000 against 4,200.

How to read the booking burst: each of the 360 one-hour slots on the same spot was requested about 16 times. Exactly one request per slot got `201 Created`; every other request got `409 slot_taken`. After the run, a query for overlapping live bookings returned **0**. Correctness held under contention, and refusals stayed fast.

The search scenario rotates across six Sousse neighbourhoods and five time windows, and sends `x-plassa-nolog: 1` so the run does not pollute the demand heatmap. No caching layer sits in front: every request is a real database query.

## 2. Search query at city and country scale

`scripts/bench-search.ts` loads synthetic spots into a separate database (`plassa_bench`), spread over 8 Tunisian coastal cities. It then runs the production search query 60 times per size with `EXPLAIN ANALYZE`. Raw output: [`docs/tests/search-scale.json`](tests/search-scale.json).

| Spots in database | p50 | p95 | max | Indexes used |
|---:|---:|---:|---:|---|
| 10,000 | 0.92 ms | 1.27 ms | 1.69 ms | `spots_earth_gist`, `bookings_no_overlap` |
| 100,000 | 30.2 ms | 32.4 ms | 32.6 ms | `spots_earth_gist`, `bookings_no_overlap` |

At 100,000 spots the synthetic data puts about 12,500 spots in each city, roughly 900 inside a 1.8 km radius. That is far denser than any real parking market. Even then the query stays near 30 ms because the GiST index on `ll_to_earth(lat, lng)` narrows the search to a bounding box before any distance is computed. The availability check uses the same GiST index as the double-booking constraint. Sousse today would have hundreds of spots, not tens of thousands.

## 3. Concurrency (integration test)

`tests/api/concurrency-and-hosts.test.ts` fires 50 booking requests for the same spot and time at once:

- 1 confirmed, 49 refused with `slot_taken`, in 141 ms.
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
| No double booking at any scale | Exclusion constraint above, tested with 50 parallel requests and a 5,716-request burst. |
| Geo search stays fast as supply grows | `earth_box` and a GiST index: under 2 ms at 10k spots, about 30 ms at 100k on a laptop. |
| Serverless-friendly database use | Small pool per instance (`DB_POOL_MAX`, default 5 when hosted), meant to sit behind the provider's pooler (Neon / Supabase PgBouncer). |
| Multi-city rollout is data, not code | `cities` and `zones` tables. A new city is a seed row and a map centre. |
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
