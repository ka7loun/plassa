// Scale benchmark for the geo search: loads N synthetic spots spread over
// Tunisia's coastal cities into a separate database, then measures the search
// query with EXPLAIN ANALYZE. Usage: npx tsx scripts/bench-search.ts 100000
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { Client } from "pg";
import { migrate } from "./migrate";
import { seed } from "../db/seed";
import { createPool } from "../src/server/db";

const ADMIN_URL = process.env.BENCH_ADMIN_URL ?? "postgres://plassa:plassa@localhost:54329/postgres";
const BENCH_URL = process.env.BENCH_DATABASE_URL ?? "postgres://plassa:plassa@localhost:54329/plassa_bench";
const SIZES = (process.argv[2] ?? "10000,100000").split(",").map(Number);

const CITIES = [
  [35.83, 10.63], [35.78, 10.82], [36.8, 10.18], [34.74, 10.76], [33.88, 10.86], [36.45, 10.73], [35.5, 11.06], [37.27, 9.87],
];

async function ensureDb() {
  const c = new Client({ connectionString: ADMIN_URL });
  await c.connect();
  const exists = await c.query("select 1 from pg_database where datname = 'plassa_bench'");
  if (!exists.rowCount) await c.query("create database plassa_bench");
  await c.end();
}

async function main() {
  await ensureDb();
  await migrate(BENCH_URL);
  const pool = createPool(BENCH_URL);
  await seed(pool, { searches: false });
  const host = "00000000-0000-4000-8000-000000000010";
  const results: { spots: number; p50ms: number; p95ms: number; maxms: number; plan: string }[] = [];

  let have = Number((await pool.query("select count(*) from spots")).rows[0].count);
  for (const target of SIZES) {
    const add = target - have;
    if (add > 0) {
      // generate_series keeps the insert inside Postgres: fast even at 100k+
      await pool.query(
        `insert into spots (host_id, city_id, zone_id, title, lat, lng, spot_type, price_millimes)
         select $1, 'sousse', 'sousse-babbhar', 'Synthetic ' || g,
                (array[${CITIES.map((c) => c[0]).join(",")}])[1 + g % ${CITIES.length}] + (random() - 0.5) * 0.12,
                (array[${CITIES.map((c) => c[1]).join(",")}])[1 + g % ${CITIES.length}] + (random() - 0.5) * 0.12,
                'garage', 1000 + (g % 20) * 100
           from generate_series($2::int, $3::int) g`,
        [host, have + 1, target],
      );
      await pool.query("analyze spots");
      have = target;
    }
    const start = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const end = new Date(Date.now() + 3 * 86_400_000 + 7_200_000).toISOString();
    const times: number[] = [];
    let plan = "";
    for (let i = 0; i < 60; i++) {
      const [lat, lng] = CITIES[i % CITIES.length];
      const { rows } = await pool.query(
        `explain (analyze, format json)
         select s.id, earth_distance(ll_to_earth($1,$2), ll_to_earth(s.lat,s.lng)) d,
                exists(select 1 from bookings b where b.spot_id=s.id and b.status in ('pending_payment','confirmed','checked_in')
                       and tstzrange(b.start_at,b.end_at,'[)') && tstzrange($4::timestamptz,$5::timestamptz,'[)')) busy
           from spots s
          where s.active and earth_box(ll_to_earth($1,$2), $3) @> ll_to_earth(s.lat,s.lng)
            and earth_distance(ll_to_earth($1,$2), ll_to_earth(s.lat,s.lng)) <= $3
          order by d limit 60`,
        [lat + 0.01, lng + 0.01, 1800, start, end],
      );
      const p = rows[0]["QUERY PLAN"][0];
      times.push(p["Execution Time"]);
      if (!plan) plan = JSON.stringify(p.Plan).match(/"Index Name":"([^"]+)"/g)?.join(", ") ?? "seq scan";
    }
    times.sort((a, b) => a - b);
    const r = { spots: have, p50ms: +times[30].toFixed(2), p95ms: +times[57].toFixed(2), maxms: +times[59].toFixed(2), plan };
    results.push(r);
    console.log(r);
  }
  await pool.end();
  mkdirSync("docs/tests", { recursive: true });
  writeFileSync("docs/tests/search-scale.json", JSON.stringify({ at: new Date().toISOString(), radiusM: 1800, runsPerSize: 60, results }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
