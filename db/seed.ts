// Deterministic demo seed. Usage: npm run db:seed  (wipes and reseeds data tables)
import "dotenv/config";
import type { Pool } from "pg";
import { createPool, LOCAL_DATABASE_URL } from "../src/server/db";
import { quote } from "../src/lib/pricing";
import { fitsAvailability, fromTunisLocal, tunisDateString } from "../src/lib/time";
import { CITIES, DEMO_USERS, HOSTS, OTHER_DRIVERS, SPOTS, ZONES, ZONE_DEMAND } from "./seed-data";

/** Small seeded PRNG so every seed run produces the same data. */
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function spotId(i: number) {
  return `10000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`;
}

export interface SeedOptions {
  now?: Date;
  bookings?: boolean;
  searches?: boolean;
}

export async function seed(pool: Pool, opts: SeedOptions = {}) {
  const now = opts.now ?? new Date();
  const rand = mulberry32(2026_11_22);
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];

  await pool.query("truncate search_events, bookings, spots, zones, cities, users restart identity cascade");

  for (const c of CITIES) {
    await pool.query(
      "insert into cities(id,name_fr,name_ar,name_en,center_lat,center_lng,default_zoom) values ($1,$2,$3,$4,$5,$6,$7)",
      [c.id, c.fr, c.ar, c.en, c.lat, c.lng, c.zoom],
    );
  }
  for (const z of ZONES) {
    await pool.query(
      "insert into zones(id,city_id,name_fr,name_ar,name_en,center_lat,center_lng) values ($1,$2,$3,$4,$5,$6,$7)",
      [z.id, z.city, z.fr, z.ar, z.en, z.lat, z.lng],
    );
  }
  const users: [string, string, string, string | null][] = [
    [DEMO_USERS.driver.id, "driver", DEMO_USERS.driver.name, DEMO_USERS.driver.phone],
    [DEMO_USERS.admin.id, "admin", DEMO_USERS.admin.name, null],
    ...HOSTS.map((h) => [h.id, "host", h.name, h.phone] as [string, string, string, string]),
    ...OTHER_DRIVERS.map((d) => [d.id, "driver", d.name, null] as [string, string, string, null]),
  ];
  for (const u of users) {
    await pool.query("insert into users(id,role,name,phone) values ($1,$2,$3,$4)", u);
  }

  const spots = SPOTS.map((s, i) => {
    const zone = ZONES.find((z) => z.id === s.zone)!;
    return {
      id: spotId(i),
      seed: s,
      city: zone.city,
      rules: {
        price_millimes: s.price,
        peak_multiplier: s.peak?.[0] ?? 1,
        peak_start_hour: s.peak?.[1] ?? null,
        peak_end_hour: s.peak?.[2] ?? null,
        peak_months: s.peak?.[3] ?? [],
      },
      avail: {
        avail_days: s.days ?? [0, 1, 2, 3, 4, 5, 6],
        avail_start_min: s.open?.[0] ?? 0,
        avail_end_min: s.open?.[1] ?? 1440,
      },
    };
  });

  for (const sp of spots) {
    const s = sp.seed;
    await pool.query(
      `insert into spots(id,host_id,city_id,zone_id,title,description,address,lat,lng,spot_type,covered,private_attested,
        gardien_name,gardien_phone,price_millimes,peak_multiplier,peak_start_hour,peak_end_hour,peak_months,
        avail_days,avail_start_min,avail_end_min,created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
      [
        sp.id, HOSTS[s.host].id, sp.city, s.zone, s.title, s.desc, s.address, s.lat, s.lng, s.type, s.covered ?? false,
        s.gardien?.[0] ?? null, s.gardien?.[1] ?? null, s.price, sp.rules.peak_multiplier, sp.rules.peak_start_hour,
        sp.rules.peak_end_hour, sp.rules.peak_months, sp.avail.avail_days, sp.avail.avail_start_min, sp.avail.avail_end_min,
        new Date(now.getTime() - (40 - (spots.indexOf(sp) % 30)) * 86_400_000),
      ],
    );
  }

  let bookingCount = 0;
  if (opts.bookings !== false) {
    const drivers = [DEMO_USERS.driver.id, ...OTHER_DRIVERS.map((d) => d.id)];
    const taken = new Map<string, [number, number][]>();
    const free = (id: string, a: number, b: number) => !(taken.get(id) ?? []).some(([x, y]) => a < y && x < b);
    const sousseSpots = spots.filter((s) => s.city === "sousse");
    // weight Bab Bhar / Medina spots higher: that is where demand is
    const weighted = sousseSpots.flatMap((s) => Array(Math.max(1, Math.round((ZONE_DEMAND[s.seed.zone] ?? 5) / 6))).fill(s));
    const today = tunisDateString(now);

    const insertBooking = async (sp: (typeof spots)[number], start: Date, end: Date, driver: string, status: string) => {
      const q = quote(sp.rules, start, end);
      const method = pick(["cash", "cash", "d17", "flouci", "card"]);
      await pool.query(
        `insert into bookings(spot_id,driver_id,start_at,end_at,status,amount_millimes,commission_millimes,payment_method,payment_ref,checkin_code,plate,created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          sp.id, driver, start, end, status, q.totalMillimes, q.commissionMillimes, method,
          method === "cash" ? "cash_seed" : `sim_${method}_seed${bookingCount}`,
          String(Math.floor(rand() * 10000)).padStart(4, "0"),
          `${100 + Math.floor(rand() * 150)} TU ${1000 + Math.floor(rand() * 8999)}`,
          new Date(start.getTime() - (1 + rand() * 48) * 3_600_000),
        ],
      );
      taken.set(sp.id, [...(taken.get(sp.id) ?? []), [start.getTime(), end.getTime()]]);
      bookingCount++;
    };

    // ~4 weeks of history
    for (let d = 28; d >= 1; d--) {
      const day = tunisDateString(new Date(now.getTime() - d * 86_400_000));
      const n = 2 + Math.floor(rand() * 4);
      for (let k = 0; k < n; k++) {
        const sp = pick(weighted);
        const hour = 8 + Math.floor(rand() * 13);
        const start = fromTunisLocal(day, `${String(hour).padStart(2, "0")}:${rand() < 0.5 ? "00" : "30"}`);
        const end = new Date(start.getTime() + (1 + Math.floor(rand() * 4)) * 1_800_000);
        if (!fitsAvailability(sp.avail, start, end) || !free(sp.id, start.getTime(), end.getTime())) continue;
        await insertBooking(sp, start, end, pick(drivers), rand() < 0.1 ? "cancelled" : "checked_in");
      }
    }
    // upcoming bookings on the demo host's spots so the host dashboard is alive
    const hostSpots = spots.filter((s) => s.seed.host === 0 && s.city === "sousse");
    const upcoming: [number, string, number][] = [
      [0, "10:00", 2],
      [1, "12:00", 3],
      [0, "17:30", 2],
      [3, "19:00", 2],
    ];
    for (const [idx, time, slots] of upcoming) {
      const sp = hostSpots[idx % hostSpots.length];
      for (let addDay = 0; addDay < 3; addDay++) {
        const day = tunisDateString(new Date(fromTunisLocal(today, "12:00").getTime() + addDay * 86_400_000));
        const start = fromTunisLocal(day, time);
        const end = new Date(start.getTime() + slots * 1_800_000);
        if (start <= now) continue;
        if (!fitsAvailability(sp.avail, start, end) || !free(sp.id, start.getTime(), end.getTime())) continue;
        await insertBooking(sp, start, end, pick(OTHER_DRIVERS.map((x) => x.id)), "confirmed");
        break;
      }
    }
  }

  let searchCount = 0;
  if (opts.searches !== false) {
    const rows: unknown[][] = [];
    for (let d = 28; d >= 0; d--) {
      for (const z of ZONES) {
        const base = ZONE_DEMAND[z.id] ?? 3;
        const n = Math.round(base * (0.6 + rand() * 0.8));
        for (let k = 0; k < n; k++) {
          // evening-heavy distribution (souk, cafés, beach)
          const hour = rand() < 0.55 ? 16 + Math.floor(rand() * 7) : 8 + Math.floor(rand() * 8);
          const at = new Date(fromTunisLocal(tunisDateString(new Date(now.getTime() - d * 86_400_000)), `${String(hour).padStart(2, "0")}:00`).getTime() + Math.floor(rand() * 3_600_000));
          if (at > now) continue;
          const results = 2 + Math.floor(rand() * 6);
          rows.push([z.city, z.id, z.lat + (rand() - 0.5) * 0.006, z.lng + (rand() - 0.5) * 0.006, results, Math.max(0, results - Math.floor(rand() * 4)), at]);
        }
      }
    }
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const values = chunk.map((_, j) => `($${j * 7 + 1},$${j * 7 + 2},$${j * 7 + 3},$${j * 7 + 4},$${j * 7 + 5},$${j * 7 + 6},$${j * 7 + 7})`).join(",");
      await pool.query(`insert into search_events(city_id,zone_id,lat,lng,results,available,created_at) values ${values}`, chunk.flat());
    }
    searchCount = rows.length;
  }

  return { spots: spots.length, bookings: bookingCount, searches: searchCount };
}

if (process.argv[1] && process.argv[1].endsWith("seed.ts")) {
  const pool = createPool(process.env.DATABASE_URL ?? LOCAL_DATABASE_URL);
  seed(pool)
    .then((r) => console.log("seeded", r))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
