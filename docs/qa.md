# QA report

What was tested, how, and what came out. Every number on this page comes from a real run on 22 November 2026, on the code that is live at [plassa.vercel.app](https://plassa.vercel.app). Nothing is estimated.

## Results at a glance

| Check | Result |
|---|---|
| Unit tests (Vitest) | **52 / 52 pass** |
| API integration tests (Vitest, real PostgreSQL) | **39 / 39 pass** |
| End-to-end tests (Playwright, Pixel 7 phone viewport) | **9 / 9 pass** |
| Code coverage of the logic (`src/lib`, `src/server`, `src/i18n`) | **83% lines**, 81% statements, 71% branches, 76% functions |
| Double booking under a 50-request race | **1 confirmed, 49 refused**, in 141 ms |
| Double booking under a 5,716-request booking burst | **0 overlapping bookings** in the database |
| HTTP load, 6 scenarios, 20 s each | **0 errors**, p99 under 290 ms in every scenario |
| Search with 100,000 spots in the database | **30 ms** (p50) |
| Lint and TypeScript strict typecheck | Clean |
| Continuous integration (GitHub Actions) | Green on every push: lint, typecheck, unit + API tests, build, end-to-end |

## Test environment

- **Machine:** one laptop, Intel i7-13650HX, 16 GB RAM, Windows 11, Node 22.18.
- **Database:** PostgreSQL 18.7 on the same machine (embedded, port 54329). The API tests reset a separate `plassa_test` database before each test file.
- **Server for load tests:** production build (`next build && next start`), one Node process. The load generator ran on the same CPU, so the load numbers are a conservative floor for a single instance.
- **Browser tests:** Microsoft Edge locally and Chromium in CI, emulating a Pixel 7 phone, French locale, Tunis time zone.
- **Demo data:** 85 spots in 6 Sousse neighbourhoods, 38 accounts, 317 bookings over 4 weeks, 172 reviews, 3,014 searches. Generated from a fixed seed, so every run starts from the same data.

## 1. Unit tests: 52

Pure logic, no database. Files: `tests/unit/*.test.ts`.

| Area | What is checked |
|---|---|
| Pricing | Price per 30-minute slot, peak-hour and summer surcharges, the 12% commission, money kept in whole millimes |
| Time | Tunis time (UTC+1, no daylight saving), the day boundary, opening days and hours, a 24 h spot bookable until midnight but not across it |
| Bookings | 4-digit check-in codes, payment providers (cash confirms at once, wallet waits for approval) |
| Input validation | Spot form, booking request, coordinates, Tunisian phone numbers for gardiens |
| Sessions | Signed cookie round-trip; tampered, missing or garbage tokens are rejected |
| Phone numbers | `22 123 456`, `+216 22 123 456`, `0021622123456` and `216-22-123-456` all become `+21622123456`; 7 digits, 9 digits or a French number are refused |
| Passwords | scrypt hash with a random salt (the same password gives two different hashes); right password accepted, wrong password, empty or corrupt hash refused |
| Ranking | One 5-star review does not beat fifty 4.8s; a spot with no reviews sits at the 4.0 starting point; free spots come first under every sort |
| Gamification | Points add up from both the driver side and the host side; level thresholds and progress bar; badges unlock only at their goal; Super hôte needs 5+ reviews, not just a high average |
| Translations | French, Arabic and English dictionaries have exactly the same keys |
| Database URL | The connection string is found under any hosting provider's variable name, and the error message never prints a secret |

## 2. API integration tests: 39

Each test talks to a real PostgreSQL database with the full schema and demo data. Files: `tests/api/*.test.ts`.

**Booking and payment**
- A cash booking is confirmed at once, with a check-in code and the right price.
- An overlapping booking of the same spot is refused (`slot_taken`). Back-to-back bookings are allowed.
- Bookings outside opening hours or in the past are refused.
- Wallet payment: the slot is held while pending, confirmed on approval, released on decline. A forged payment reference is refused. An abandoned payment expires after 15 minutes.
- A driver can cancel a future booking, which frees the slot. Another driver cannot read or cancel it.
- Check-in works only for the spot's own host and only around the booking time.

**Accounts**
- Sign-up with a phone number, then login with the same number written differently.
- A second account on the same phone number is refused (`phone_taken`).
- An unknown phone and a wrong password get the same error (`bad_credentials`), so the login form does not reveal which phone numbers have accounts.
- One account can list a spot and book other spots, but cannot book its own spot (`own_spot`).

**Payment methods chosen by the host**
- A booking with a method the host did not tick is refused (`method_not_accepted`).
- The host can change the methods; the database itself refuses an empty list.
- Another account cannot change them (`forbidden`).

**Reviews and ranking**
- A stay can be rated only after it ends (`not_reviewable`), only once (`already_reviewed`), and only by the driver who booked it (`forbidden`).
- The spot's rating totals always match the reviews table, and the ranking score matches the formula.
- Top spots come out in ranking order; the host leaderboard comes out in order of stays hosted.

**Dashboards**
- A new account starts at 0 points, level Débutant, no badges, no host rank.
- The demo driver has stays, points and stays waiting for a rating; the demo host has earnings, ratings and a rank among hosts.

**Photo uploads**
- A real JPEG is stored and served back byte for byte.
- A file that is not an image (for example HTML with a script, renamed to `.jpg`) is refused: the server reads the first bytes of the file instead of trusting its name or declared type.
- Photos over 1.5 MB are refused (`too_large`).
- A spot can only point to photos the app produced (`/spots/...` or `/api/photos/...`), at most 6. Outside links and `javascript:` URLs are refused.

**Search, hosts and city view**
- Free spots come first, then by distance; booked spots are marked unavailable; the radius is respected.
- A new listing is attached to the nearest neighbourhood and shows up in search. Paused spots disappear from search.
- A host cannot edit or pause another host's spot.
- The city view aggregates bookings, supply and demand per neighbourhood.

**Concurrency**
- 50 drivers race for the same spot and hour: exactly 1 booking confirmed, 49 refused, in 141 ms.
- 24 bookings of different slots on one spot, sent in parallel: all 24 succeed.

## 3. End-to-end tests: 9

A real browser drives the app at phone size, the way a user would. File: `tests/e2e/*.spec.ts`. Screenshots in `docs/tests/screens/` are taken during these runs.

| # | Scenario | What it proves |
|---|---|---|
| 1 | Demo driver finds a free spot near Bab Bhar, books with cash, gets a check-in code, cancels | The core booking flow, end to end |
| 2 | Pays with simulated Flouci: declines (slot released), then approves (confirmed) | The test opens spots until it finds one whose host accepts Flouci, so it also proves only accepted methods are shown |
| 3 | Switches to Arabic | Right-to-left layout, and the choice survives a page reload |
| 4 | A visitor opens a spot, is asked to sign in, signs up, lands back on the spot and can book; the same phone cannot sign up twice; login works | Sign-up, login and the return to the spot |
| 5 | Demo driver opens the profile, sees level and earned badges, rates a stay with 5 stars | Gamification and reviews from the client dashboard; the Top page lists 10 spots |
| 6 | No horizontal scrolling on the home, search, Top and login pages | Phone layout |
| 7 | Demo host sees earnings chart and rank, switches a payment method off and on, lists a new spot with a real photo and only cash and D17, then finds it through the public search API with its photo and those 2 methods | Renter dashboard, payment choice, photo upload (resized in the browser) and listing |
| 8 | City operator sees the indicators and the demand heatmap | City view |
| 9 | API refuses unauthenticated writes and malformed searches | Access control and validation at the edge |

## 4. Load tests

`load/run.ts` (autocannon) runs each scenario for 20 seconds against the production build. Raw output: [`docs/tests/load-results.json`](tests/load-results.json).

| Scenario | Connections | Requests | Req/s | p50 | p90 | p99 | Errors | Responses |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Search: geo radius + availability + ranking, all 4 sort orders | 50 | 4,875 | 244 | 203 ms | 228 ms | 287 ms | 0 | 200: 4,875 |
| Spot page: details + 36 h schedule + reviews | 50 | 6,287 | 314 | 155 ms | 177 ms | 201 ms | 0 | 200: 6,287 |
| Top spots + host leaderboard | 50 | 6,756 | 338 | 146 ms | 155 ms | 177 ms | 0 | 200: 6,756 |
| Client dashboard (profile, points, badges, spending) | 50 | 4,741 | 237 | 210 ms | 222 ms | 243 ms | 0 | 200: 4,741 |
| Renter dashboard (earnings, rank, reviews, payment mix) | 50 | 4,600 | 230 | 216 ms | 229 ms | 262 ms | 0 | 200: 4,600 |
| Booking burst: 20 drivers fighting over 360 slots | 20 | 5,716 | 286 | 69 ms | 75 ms | 85 ms | 0 | 201: 360, 409: 5,356 |

**Booking burst:** every one of the 360 one-hour slots was requested about 16 times. Exactly 360 requests got `201 Created`, one per slot, and every other request got `409 slot_taken`. A query for overlapping live bookings afterwards returned **0**.

**Why search went from 419 to 244 req/s since the first measurement.** The first run (before accounts, photos and ranking) had 29 demo spots, so a search returned 10 spots on average. Sousse now has 85 demo spots, and a search returns 29 on average (44 around Bab Bhar, about 39 KB of JSON), each with photos, rating and accepted payment methods, then sorted. The server now returns about **7,000 spots per second**, against 4,200 before. Each request does more work, and overall the server delivers more.

The search scenario sends `x-plassa-nolog: 1` so the test does not distort the city demand map. No cache sits in front: every request is a database query.

## 5. Search at city and country scale

`scripts/bench-search.ts` fills a separate database with synthetic spots spread over 8 Tunisian coastal cities, then times the search query 60 times per size with `EXPLAIN ANALYZE`. Raw output: [`docs/tests/search-scale.json`](tests/search-scale.json).

| Spots in database | p50 | p95 | max | Indexes used |
|---:|---:|---:|---:|---|
| 10,000 | 0.92 ms | 1.27 ms | 1.69 ms | `spots_earth_gist`, `bookings_no_overlap` |
| 100,000 | 30.2 ms | 32.4 ms | 32.6 ms | `spots_earth_gist`, `bookings_no_overlap` |

At 100,000 spots, about 900 fall inside one search radius, far denser than any real parking market. The geo index keeps the query near 30 ms.

## 6. Security and data checks

| Risk | How it is handled | Tested by |
|---|---|---|
| Two people booking the same place at the same time | PostgreSQL exclusion constraint on spot + time range | API race test, load burst |
| Password theft from the database | scrypt with a random salt per password, constant-time comparison | Unit: passwords |
| Finding out which phones have accounts | Same error for unknown phone and wrong password | API: accounts |
| Password guessing | Login limited to 10 tries per minute per phone and 30 per IP | Code review (`src/app/api/auth/login/route.ts`) |
| Forged session cookie | HS256 signature checked on every request | Unit: sessions |
| Uploading a script disguised as a photo | First bytes must be JPEG, PNG or WebP; served with the detected type | API: photo uploads |
| Linking a spot to an outside image or script | Photo paths must match the app's own patterns | API: photo uploads |
| Editing someone else's spot or booking | Every write checks ownership | API: hosts, bookings, payment methods |
| Malformed input | Zod validation on every request body and query string | Unit: validation; e2e test 9 |
| Secrets in logs | The deploy script prints variable names, never values | Unit: database URL |

## 7. Checks by hand

- **Live deploy:** after the last push, every page of plassa.vercel.app answered 200; the Top page and the demo logins returned the expected data; Sousse is the only city.
- **Phone layout:** the profile, renter dashboard and Arabic home page were reviewed in phone-size screenshots.
- **Arabic:** right-to-left layout on all new pages (sign-in, profile, Top, dashboards).

## 8. Not covered yet (known limits)

- **Real payments:** D17, Flouci and card are simulated. A real provider needs a merchant account and its own tests.
- **SMS verification:** a phone number is not confirmed by SMS yet, so anyone can sign up with any number.
- **Rate limits are per server instance** (in memory). With several instances they need a shared store.
- **Load tests ran on one laptop.** A run against a hosted staging copy is the next measurement.
- **Browsers:** automated tests use Chromium-based browsers. Safari on iPhone was not tested automatically.

## Reproduce

```powershell
npm run db:local          # embedded PostgreSQL; keep this terminal open
npm run db:setup          # tables + demo data
npm test                  # unit + API integration
npm run test:coverage
npm run test:e2e          # Playwright; starts the dev server if needed
```

Load test and benchmark (stop the dev server first):

```powershell
npm run build
$env:BOOKING_RATE_PER_MIN = "1000000"; npx next start -p 3100   # second terminal
$env:LOAD_URL = "http://localhost:3100"; npm run load
npx tsx scripts/bench-search.ts 10000,100000
```
