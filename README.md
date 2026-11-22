<p align="center">
  <img src="public/brand/plassa-logo-primary.svg" alt="Plassa" width="220">
</p>

<p align="center"><b>Votre place vous attend.</b><br>Rent an empty parking spot in Sousse by the hour, from the residents and shops who own it.</p>

<p align="center">
  <a href="https://github.com/ka7loun/plassa/actions/workflows/ci.yml"><img src="https://github.com/ka7loun/plassa/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
</p>

**Live demo:** _URL added after deploy_. Open it on a phone. The landing page has three one-click demo logins (no password):

| Button | You are | Try |
|---|---|---|
| Driver | Yassine, looking for parking | Find a spot near Bab Bhar, book it with cash or a simulated D17 / Flouci payment, get a 4-digit check-in code |
| Host | Salma, owner of a garage on Rue de Paris | See earnings and upcoming bookings, check a driver in with their code, list a new spot on the map |
| City | A municipal operator | Demand heatmap, zone pressure, and parking time saved |

The app is in French, Tunisian Arabic (right-to-left) and English. All people, phone numbers and bookings are fictional demo data. **Payments are simulated**; see [Payments](#payments-simulated-on-purpose).

## Why Sousse

In summer and on market days, drivers circle the Medina and Bab Bhar looking for a space. Meanwhile private garages, shop courtyards and office basements sit empty most of the day. Parking on the street means risking the fourrière (tow truck). Plassa connects the two: hosts earn from space they already have, and drivers book a guaranteed place before they arrive.

## What works

**Drivers**
- Map and list of spots within walking distance, filtered by arrival time and duration. A spot shows as free only if it is open and unbooked for the whole window.
- Transparent price per 30-minute slot, with peak hours and summer months priced higher.
- Booking with cash on arrival, or a simulated D17 / Flouci / card payment. Wallet bookings hold the slot for 15 minutes, then release it.
- Booking confirmation with a 4-digit check-in code, booking history, cancellation.
- A "no fourrière" badge on spots whose host attests the space is private.

**Hosts**
- Dashboard: earnings this month (after the 12% commission), bookings this month, active spots, upcoming bookings.
- Check a driver in with their code (from 30 minutes before the start).
- List a new spot by dropping a pin on the map, setting a price, an optional peak surcharge, opening days and hours.
- Pause or resume a spot.

**City view**
- Heatmap of where drivers searched, zone-by-zone supply against demand, and an estimate of time not spent circling.

**Everywhere**
- Mobile first: tested at phone width with no horizontal scroll, 44 px touch targets, installable web app manifest.
- French, Tunisian Arabic (full RTL layout) and English, remembered across visits.

| Driver confirmation | Host dashboard | City view | Arabic (RTL) |
|---|---|---|---|
| <img src="docs/tests/screens/driver-confirmation.png" width="200"> | <img src="docs/tests/screens/host-dashboard.png" width="200"> | <img src="docs/tests/screens/city-view.png" width="200"> | <img src="docs/tests/screens/landing-ar.png" width="200"> |

Screenshots are taken automatically by the end-to-end tests.

## Architecture

```mermaid
flowchart LR
  phone["Phone browser<br/>React 19, MapLibre"] -->|HTTPS, JSON| app
  subgraph app["Next.js 16 app (stateless, scales horizontally)"]
    pages["Pages<br/>driver, host, city"]
    api["Route handlers<br/>/api/*"]
    pay["PaymentProvider<br/>cash | simulated wallet"]
    api --> pay
  end
  api -->|pg pool| db[("PostgreSQL<br/>earthdistance + GiST<br/>exclusion constraint")]
  phone -->|map tiles| tiles["CARTO basemap<br/>OpenStreetMap data"]
```

- **One codebase, one deploy.** Pages and the JSON API live in the same Next.js app.
- **The database enforces the rules that matter.** An exclusion constraint makes two live bookings on the same spot and time impossible, whatever the app does. Geo search uses an index, not a table scan.
- **No server-side session state.** A signed cookie carries the session, so any instance can answer any request.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript | Front end and API in one repo and one deploy |
| Styling | Tailwind CSS v4 with Plassa brand tokens, DM Sans + Readex Pro (Arabic) | Same identity as the Challenge 01 brand |
| Map | MapLibre GL JS, CARTO Positron basemap, OpenStreetMap data | Open source, no per-request billing, good Sousse coverage |
| Database | PostgreSQL with `earthdistance`, `cube`, `btree_gist`, `pgcrypto` | Standard contrib extensions, so it runs on any host: Neon, Supabase, RDS or a laptop |
| Validation | Zod 4 | Every request body and query string is checked at the edge |
| Auth | Signed JWT cookie (`jose`, HS256) with demo role login | Stateless; real phone OTP is on the roadmap |
| Payments | `PaymentProvider` interface, `CashProvider` and `MockWalletProvider` | A real Flouci / D17 adapter slots in without touching booking logic |
| i18n | Own dictionaries for fr / ar / en, `dir="rtl"` for Arabic | Small, typed, no runtime dependency |
| Tests | Vitest (unit + API integration on real Postgres), Playwright (mobile e2e), autocannon (load) | See [Tests achieved](#tests-achieved) |
| CI | GitHub Actions with a Postgres service container | Lint, typecheck, tests, build and e2e on every push |

## Scalability

Full measurements and method: [docs/perf.md](docs/perf.md).

- **No double booking at any scale.** `exclude using gist (spot_id with =, tstzrange(start_at, end_at) with &&)` on live bookings. Adding app servers cannot break it.
- **Geo search stays fast.** At 10,000 spots the search query takes 0.9 ms (p50). At 100,000 spots, about 900 per search radius, it takes 29 ms.
- **The app tier is stateless.** Sessions are signed cookies, the database pool is small per instance and meant to sit behind a pooler, so it runs on serverless hosting.
- **New cities are data.** `cities` and `zones` tables. Monastir is already seeded next to Sousse.
- **New payment methods are one class.** The booking flow only talks to the `PaymentProvider` interface.

## Tests achieved

All numbers are from real runs. The local runs used a laptop (i7-13650HX, 16 GB) with a production build and PostgreSQL 18.

| Suite | What it checks | Result |
|---|---|---|
| Unit (Vitest) | Pricing and commission, peak rules, Tunis time and opening hours, check-in codes, payment providers, input validation, signed sessions, translations complete in all three languages | **36 / 36 pass** |
| API integration (Vitest, real Postgres) | Search by distance and radius, booking, overlap refusal, opening hours, wallet approve / decline / forged reference / 15-minute expiry, cancel, drivers cannot see each other's bookings, host check-in, hosts cannot edit other hosts' spots, paused spots, city stats per zone and per city | **22 / 22 pass** |
| Concurrency | 50 parallel requests for the same spot and hour | **1 confirmed, 49 refused** (`slot_taken`), about 150 ms |
| End-to-end (Playwright, Pixel 7 viewport) | Driver books with cash and cancels; wallet decline then approve; Arabic RTL persists; no horizontal scroll; host lists a spot and it becomes searchable; city view; API refuses bad and unauthenticated requests | **7 / 7 pass** |
| Coverage (`src/lib`, `src/server`, `src/i18n`) | v8 coverage from the Vitest run | 76% lines, 74% statements, 68% branches |
| Load: search | 50 connections, 20 s | **419 req/s**, p50 120 ms, p99 195 ms, 0 errors |
| Load: spot detail | 50 connections, 20 s | **401 req/s**, p50 123 ms, p99 205 ms, 0 errors |
| Load: booking burst | 20 connections fighting over 360 slots | **327 req/s**, p99 83 ms; exactly 360 created, 6,184 refused, **0 overlaps in the database** |
| Search at scale | `EXPLAIN ANALYZE`, 60 runs per size | 10k spots: 0.9 ms p50. 100k spots: 29 ms p50 |

Raw results: [`docs/tests/load-results.json`](docs/tests/load-results.json), [`docs/tests/search-scale.json`](docs/tests/search-scale.json).

## Run it locally

Needs Node 22+. No Docker: an embedded PostgreSQL is downloaded as an npm package.

```powershell
npm install
npm run db:local      # starts PostgreSQL on port 54329; leave this terminal open
```

In a second terminal:

```powershell
npm run db:setup      # create tables and load the Sousse demo data
npm run dev           # http://localhost:3000
```

Tests:

```powershell
npm test              # unit + API integration (uses the plassa_test database)
npm run test:e2e      # Playwright; starts the dev server if it is not running
npm run test:coverage
```

`npm run db:seed` resets the demo data at any time. To use another PostgreSQL, set `DATABASE_URL` (see below) and run `npm run db:setup`.

### Environment variables

Copy [`.env.example`](.env.example) to `.env.local`. Every variable has a working local default.

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgres://plassa:plassa@localhost:54329/plassa` | App database |
| `TEST_DATABASE_URL` | `postgres://plassa:plassa@localhost:54329/plassa_test` | Database reset by the integration tests |
| `SESSION_SECRET` | demo value | Signs the session cookie. **Set it in any deploy.** |
| `DB_POOL_MAX` | 20 local, 5 hosted | Connections per server instance |
| `DB_SSL` | on for non-local hosts | Set `false` to disable TLS |
| `BOOKING_RATE_PER_MIN` | 30 | Booking requests per user per minute |
| `NEXT_PUBLIC_MAP_STYLE` | CARTO Positron | `osm` for raster OpenStreetMap tiles, or any MapLibre style URL |

## Payments: simulated, on purpose

Merchant onboarding with Flouci or D17 cannot happen during a hackathon, so the prototype does not move real money. What exists is the integration seam:

- `src/lib/payments.ts` defines a `PaymentProvider` interface (`createIntent`, `confirm`, `refund`).
- `CashProvider` confirms at once; the driver pays the host on arrival.
- `MockWalletProvider` creates a pending payment and sends the driver to a simulated wallet page with **Approve** and **Decline**. Decline frees the slot. An abandoned payment expires after 15 minutes.

A real provider is a new class behind the same interface plus a webhook route.

## Project layout

```
src/app/            pages (find, spot, pay, bookings, host, city) and /api route handlers
src/server/         database access, booking rules, auth, HTTP helpers
src/lib/            pure logic: pricing, Tunis time, payments, validation
src/i18n/           fr, ar, en dictionaries
db/migrations/      SQL schema (exclusion constraint, geo index)
db/seed*.ts         deterministic Sousse + Monastir demo data
tests/unit, tests/api, tests/e2e
load/run.ts         HTTP load test
scripts/            local Postgres, migrations, search benchmark
docs/perf.md        performance method and results
```

## Roadmap

- Real Flouci and D17 payments with host payouts.
- Phone number login with OTP, host identity checks.
- SMS / WhatsApp booking confirmations and reminders.
- Ratings and dispute handling.
- Partnership with the municipality: share the demand map, list public car parks next to private spots.
- More cities: Monastir (already seeded), Tunis, Djerba for the summer season.

## License

MIT
