// HTTP load test with autocannon (pure Node, no extra binary).
// Usage: start the production server (npm run build && npm start -- -p 3100), then
//   LOAD_URL=http://localhost:3100 npm run load
// Writes docs/tests/load-results.json and prints a markdown table.
import autocannon from "autocannon";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.LOAD_URL ?? "http://localhost:3100";
const DURATION = Number(process.env.LOAD_SECONDS ?? 20);

// Search points across Sousse so the database does real geo work, not one cached query.
const POINTS = [
  [35.8287, 10.6375], [35.8245, 10.6325], [35.837, 10.6295], [35.837, 10.5935], [35.8535, 10.6075], [35.8898, 10.593],
];

function window(i: number) {
  const start = new Date(Date.now() + (1 + (i % 5)) * 86_400_000);
  start.setUTCHours(8 + (i % 8), 0, 0, 0);
  return { start: start.toISOString(), end: new Date(start.getTime() + 2 * 3_600_000).toISOString() };
}

const SORTS = ["recommended", "distance", "price", "rating"];
const SPOT_COUNT = 85; // demo data version 2

let n = 0;
function searchPath() {
  const [lat, lng] = POINTS[n % POINTS.length];
  const sort = SORTS[Math.floor(n / POINTS.length) % SORTS.length];
  const w = window(n++);
  return `/api/spots?lat=${lat}&lng=${lng}&radius=1800&start=${w.start}&end=${w.end}&sort=${sort}`;
}

async function login(role: "driver" | "host") {
  const r = await fetch(`${BASE}/api/auth/demo`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role }) });
  return r.headers.get("set-cookie")!.split(";")[0];
}

interface Row {
  scenario: string;
  connections: number;
  seconds: number;
  requests: number;
  rps: number;
  p50: number;
  p90: number;
  p99: number;
  errors: number;
  non2xx: number;
  statusCodes: Record<string, number>;
}

async function run(scenario: string, opts: autocannon.Options): Promise<Row> {
  const r = await autocannon({ duration: DURATION, ...opts });
  return {
    scenario,
    connections: opts.connections ?? 10,
    seconds: DURATION,
    requests: r.requests.total,
    rps: Math.round(r.requests.average),
    p50: r.latency.p50,
    p90: r.latency.p90,
    p99: r.latency.p99,
    errors: r.errors + r.timeouts,
    non2xx: r.non2xx,
    statusCodes: Object.fromEntries(Object.entries(r.statusCodeStats ?? {}).map(([k, v]) => [k, (v as { count: number }).count])),
  };
}

async function main() {
  const health = await fetch(`${BASE}/api/health`).then((r) => r.json());
  if (!health.ok) throw new Error(`server not healthy at ${BASE}`);
  const cookie = await login("driver");
  const hostCookie = await login("host");
  const rows: Row[] = [];

  rows.push(
    await run("Search spots (geo + availability + ranking)", {
      url: BASE,
      connections: 50,
      headers: { "x-plassa-nolog": "1" },
      requests: [{ method: "GET", setupRequest: (req) => ({ ...req, path: searchPath() }) }],
    }),
  );

  rows.push(
    await run("Spot detail + 36h schedule + reviews", {
      url: BASE,
      connections: 50,
      requests: [
        {
          method: "GET",
          setupRequest: (req) => {
            const id = `10000000-0000-4000-8000-${String(1 + (n++ % SPOT_COUNT)).padStart(12, "0")}`;
            const w = window(n);
            return { ...req, path: `/api/spots/${id}?start=${w.start}&end=${w.end}` };
          },
        },
      ],
    }),
  );

  rows.push(await run("Top spots + host leaderboard", { url: `${BASE}/api/spots/top`, connections: 50 }));
  rows.push(await run("Client dashboard (profile, points, badges)", { url: `${BASE}/api/me/dashboard`, connections: 50, headers: { cookie } }));
  rows.push(await run("Renter dashboard (earnings, rank, reviews)", { url: `${BASE}/api/host/dashboard`, connections: 50, headers: { cookie: hostCookie } }));

  // Booking burst: many drivers hitting a handful of spots. Most requests are
  // expected to be refused with 409 (slot taken) — that is the point: the
  // database must stay correct and fast under contention.
  let b = 0;
  // A fresh block of 360 slots per run (60 days x 6 hours): the first request for
  // each slot gets 201, every repeat must get 409 from the exclusion constraint.
  const dayBase = 30 + Math.floor(Math.random() * 3000);
  const booking = await run("Booking burst (360 slots, contended)", {
    url: BASE,
    connections: 20,
    headers: { cookie, "content-type": "application/json" },
    requests: [
      {
        method: "POST",
        path: "/api/bookings",
        setupRequest: (req) => {
          const i = b++;
          const start = new Date(Date.now() + (dayBase + (i % 60)) * 86_400_000);
          start.setUTCHours(9 + (Math.floor(i / 60) % 6), 0, 0, 0);
          const body = JSON.stringify({
            spotId: "10000000-0000-4000-8000-000000000014", // 24/7 spot
            start: start.toISOString(),
            end: new Date(start.getTime() + 3_600_000).toISOString(),
            paymentMethod: "cash",
          });
          return { ...req, body };
        },
      },
    ],
  });
  rows.push(booking);

  mkdirSync("docs/tests", { recursive: true });
  const out = { base: BASE, at: new Date().toISOString(), node: process.version, rows };
  writeFileSync("docs/tests/load-results.json", JSON.stringify(out, null, 2));

  console.log("\n| Scenario | Conns | Req/s | p50 ms | p90 ms | p99 ms | Errors | Status codes |");
  console.log("|---|---:|---:|---:|---:|---:|---:|---|");
  for (const r of rows) {
    const codes = Object.entries(r.statusCodes).map(([k, v]) => `${k}: ${v}`).join(", ");
    console.log(`| ${r.scenario} | ${r.connections} | ${r.rps} | ${r.p50} | ${r.p90} | ${r.p99} | ${r.errors} | ${codes} |`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
