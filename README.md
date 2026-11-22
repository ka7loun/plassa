<p align="center">
  <img src="public/brand/plassa-logo-primary.svg" alt="Plassa" width="220">
</p>

<p align="center"><b>Votre place vous attend.</b><br>Rent an empty parking spot in Sousse by the hour, from the residents and shops who own it.</p>

<p align="center">
  <a href="https://github.com/ka7loun/plassa/actions/workflows/ci.yml"><img src="https://github.com/ka7loun/plassa/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
</p>

**Live demo: [plassa.vercel.app](https://plassa.vercel.app)** Open it on a phone. Anyone can browse spots without an account. To book or rent out a spot, create an account with a Tunisian phone number and a password, or use one of the one-click demo accounts on the landing page:

| Demo account | Phone / password | Try |
|---|---|---|
| Yassine | `00 000 101` / `plassa2026` | Find a spot near Bab Bhar, book it with one of the payment methods the host accepts, rate past stays, see points and badges on the profile. He also rents out his own driveway in Khezama. |
| Salma | `00 000 102` / `plassa2026` | The top-ranked host: earnings over 8 weeks, rating, rank among hosts, which payment methods drivers see, check-in with a driver's code, list a new spot with photos |
| City operator | `00 000 100` / `plassa2026` | Demand heatmap, zone pressure, and parking time saved |

The app is in French, Tunisian Arabic (right-to-left) and English. All people, phone numbers and bookings are fictional demo data. **Payments are simulated**; see [Payments](#payments-simulated-on-purpose).

## Why Sousse

In summer and on market days, drivers circle the Medina and Bab Bhar looking for a space. Meanwhile private garages, shop courtyards and office basements sit empty most of the day. Parking on the street means risking the fourrière (tow truck). Plassa connects the two: hosts earn from space they already have, and drivers book a guaranteed place before they arrive.

## What works

**One account, both sides**
- Sign up with a Tunisian phone number (`22 123 456`, `+216 22 123 456` and `0021622123456` are all accepted) and a password, hashed with scrypt. One phone number, one account.
- The same account books spots as a driver and rents out its own spots as a host. It cannot book its own spot.
- Guests can browse the map, spots, photos and reviews; booking asks them to sign in and brings them back to the spot.

**Drivers (client dashboard: Profile)**
- Map and list of spots within walking distance, filtered by arrival time and duration. A spot shows as free only if it is open and unbooked for the whole window.
- Sort by recommended, nearest, cheapest or best rated. Free spots always come first.
- Photos of each spot, its rating and the latest reviews.
- Transparent price per 30-minute slot, with peak hours and summer months priced higher.
- Payment with the methods the host accepts: cash on arrival, or a simulated D17 / Flouci / card payment. Wallet bookings hold the slot for 15 minutes, then release it.
- Booking confirmation with a 4-digit check-in code, booking history, cancellation.
- After a stay, rate it from 1 to 5 stars with an optional comment.
- Profile: level and points, badges, stays, hours parked, money spent per month, favourite spots, stays waiting for a rating.

**Hosts (renter dashboard: My spots)**
- Earnings over the last 8 weeks (after the 12% commission), booked hours, average rating, rank among hosts, how drivers paid, latest reviews.
- Per spot: photos, rating, bookings in the last 30 days, pause or resume, and which payment methods drivers see (at least one).
- Check a driver in with their code (from 30 minutes before the start).
- List a new spot: pin on the map, up to 6 photos (resized on the phone before upload), price, optional peak surcharge, opening days and hours, accepted payment methods.

**Ranking and gamification**
- Spots are ranked by a Bayesian average: each spot starts with 5 imaginary 4-star reviews, so one lucky 5-star review cannot beat fifty 4.8s. The Top page lists the best spots and the most active hosts.
- Points: +10 per stay, +5 per review, +15 per guest hosted, +20 per spot listed. Four levels from Débutant to Légende de Sousse, and 11 badges (Enfant de la médina, Lève-tôt, Super hôte, Club 100 DT...).

**City view**
- Heatmap of where drivers searched, zone-by-zone supply against demand, and an estimate of time not spent circling.

**Everywhere**
- Mobile first: tested at phone width with no horizontal scroll, 44 px touch targets, installable web app manifest.
- French, Tunisian Arabic (full RTL layout) and English, remembered across visits.

| Driver profile | Host dashboard | Booking confirmation | City view | Arabic (RTL) |
|---|---|---|---|---|
| <img src="docs/tests/screens/profile-driver.png" width="160"> | <img src="docs/tests/screens/host-dashboard.png" width="160"> | <img src="docs/tests/screens/driver-confirmation.png" width="160"> | <img src="docs/tests/screens/city-view.png" width="160"> | <img src="docs/tests/screens/landing-ar.png" width="160"> |

Screenshots are taken automatically by the end-to-end tests. Spot photos are free stock photos from Unsplash, credited in [docs/photo-credits.md](docs/photo-credits.md).

## Architecture

```mermaid
flowchart LR
  phone["Phone browser<br/>React 19, MapLibre"] -->|HTTPS, JSON| app
  subgraph app["Next.js 16 app (stateless, scales horizontally)"]
    pages["Pages<br/>find, spot, profile, my spots, top, city"]
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
| Auth | Phone number + password (scrypt), signed JWT cookie (`jose`, HS256), one-click demo accounts | Stateless; SMS verification of the phone number is on the roadmap |
| Payments | `PaymentProvider` interface, `CashProvider` and `MockWalletProvider` | A real Flouci / D17 adapter slots in without touching booking logic |
| i18n | Own dictionaries for fr / ar / en, `dir="rtl"` for Arabic | Small, typed, no runtime dependency |
| Tests | Vitest (unit + API integration on real Postgres), Playwright (mobile e2e), autocannon (load) | See [Tests achieved](#tests-achieved) |
| CI | GitHub Actions with a Postgres service container | Lint, typecheck, tests, build and e2e on every push |

## Scalability

Full measurements and method: [docs/perf.md](docs/perf.md).

- **No double booking at any scale.** `exclude using gist (spot_id with =, tstzrange(start_at, end_at) with &&)` on live bookings. Adding app servers cannot break it.
- **Geo search stays fast.** At 10,000 spots the search query takes 0.9 ms (p50). At 100,000 spots, about 900 per search radius, it takes 30 ms.
- **The app tier is stateless.** Sessions are signed cookies, the database pool is small per instance and meant to sit behind a pooler, so it runs on serverless hosting.
- **New cities are data.** `cities` and `zones` tables: a new city is a seed row and a map centre.
- **Photos live next to the data.** Uploads are resized on the phone (1200 px JPEG), checked by their first bytes, capped at 1.5 MB and served with a one-year immutable cache header, so a CDN absorbs repeat views.
- **New payment methods are one class.** The booking flow only talks to the `PaymentProvider` interface.

## Tests achieved

All numbers are from real runs on 22 November 2026, on the code that is live. The local runs used a laptop (i7-13650HX, 16 GB) with a production build and PostgreSQL 18. **Full QA report: [docs/qa.md](docs/qa.md)** (every test, the security checks, what is not covered yet).

| Suite | What it checks | Result |
|---|---|---|
| Unit (Vitest) | Pricing and commission, peak rules, Tunis time and opening hours, check-in codes, payment providers, input validation, signed sessions, phone number formats, password hashing, Bayesian ranking and sorting, points, levels and badges, translations complete in all three languages | **52 / 52 pass** |
| API integration (Vitest, real Postgres) | Search, booking, overlap refusal, opening hours, wallet approve / decline / forged reference / 15-minute expiry, cancel, privacy between drivers, host check-in, hosts cannot edit other hosts' spots, paused spots, city stats; sign-up and login (duplicate phone, same error for unknown phone and wrong password), booking your own spot, payment methods the host did not accept, reviews only after the stay and only once, rating totals, dashboards and rankings; photo uploads (real JPEG round-trip, disguised scripts and files over 1.5 MB refused, outside photo links refused) | **39 / 39 pass** |
| Concurrency | 50 parallel requests for the same spot and hour | **1 confirmed, 49 refused** (`slot_taken`), 141 ms |
| End-to-end (Playwright, Pixel 7 viewport) | Driver books with cash and cancels; wallet decline then approve on a spot that accepts Flouci; Arabic RTL persists; a visitor signs up from a spot and comes back to book it, duplicate phone refused, login works; demo driver rates a stay from the profile; Top page; no horizontal scroll; host toggles a payment method, uploads a real photo, lists a spot with chosen methods and it becomes searchable; city view; API refuses bad and unauthenticated requests | **9 / 9 pass** |
| Coverage (`src/lib`, `src/server`, `src/i18n`) | v8 coverage from the Vitest run | 83% lines, 81% statements, 71% branches |
| Load: search (geo + availability + ranking) | 50 connections, 20 s | **244 req/s**, p50 203 ms, p99 287 ms, 0 errors. Each search returns 29 spots on average, with photos and ratings ([why it changed](docs/qa.md#4-load-tests)) |
| Load: spot page with reviews | 50 connections, 20 s | **314 req/s**, p50 155 ms, p99 201 ms, 0 errors |
| Load: Top page | 50 connections, 20 s | **338 req/s**, p50 146 ms, p99 177 ms, 0 errors |
| Load: client and renter dashboards | 50 connections, 20 s each | **237 and 230 req/s**, p99 243 and 262 ms, 0 errors |
| Load: booking burst | 20 connections fighting over 360 slots | **286 req/s**, p99 85 ms; exactly 360 created, 5,356 refused, **0 overlaps in the database** |
| Search at scale | `EXPLAIN ANALYZE`, 60 runs per size | 10k spots: 0.9 ms p50. 100k spots: 30 ms p50 |

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
src/app/            pages (find, spot, pay, bookings, me, host, top, city, login, signup) and /api route handlers
src/server/         database access, booking rules, auth, HTTP helpers
src/lib/            pure logic: pricing, Tunis time, payments, validation, ranking, gamification, phone numbers
src/i18n/           fr, ar, en dictionaries
db/migrations/      SQL schema (exclusion constraint, geo index)
db/seed*.ts         deterministic Sousse demo data: 85 spots, 4 weeks of bookings and reviews
public/spots/       stock photos of the demo spots (see docs/photo-credits.md)
tests/unit, tests/api, tests/e2e
load/run.ts         HTTP load test
scripts/            local Postgres, migrations, search benchmark
docs/qa.md          QA report: every test, results, security checks, known gaps
docs/perf.md        performance method and results
```

## Roadmap

- Real Flouci and D17 payments with host payouts.
- SMS verification of the phone number, host identity checks.
- SMS / WhatsApp booking confirmations and reminders.
- Dispute handling, host replies to reviews.
- Partnership with the municipality: share the demand map, list public car parks next to private spots.
- More cities: Monastir, Tunis, Djerba for the summer season.

## License

MIT
