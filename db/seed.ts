// Deterministic demo seed. Usage: npm run db:seed  (wipes and reseeds data tables)
import "dotenv/config";
import type { Pool } from "pg";
import { createPool, LOCAL_DATABASE_URL } from "../src/server/db";
import { databaseUrl } from "../src/server/db-url";
import { hashPassword } from "../src/server/password";
import { quote } from "../src/lib/pricing";
import { fitsAvailability, fromTunisLocal, tunisDateString } from "../src/lib/time";
import type { PaymentMethod } from "../src/lib/payments";
import { ALL_SPOTS, CITIES, DEMO_PASSWORD, DEMO_USERS, HOSTS, OTHER_DRIVERS, photosFor, SEED_VERSION, ZONES, ZONE_DEMAND } from "./seed-data";

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

const ALL_METHODS: PaymentMethod[] = ["cash", "d17", "flouci", "card"];

// Short reviews, French and Tunisian Derja, by rating.
const COMMENTS: Record<number, string[]> = {
  5: ["Parfait, à 2 minutes du souk.", "Hôte très sympa, place propre.", "Mrigla barcha, nraja3 ken nesta7ak.", "Facile à trouver, code accepté tout de suite.", "Top pour aller à la plage sans stress.", ""],
  4: ["Bien placé, un peu étroit pour un SUV.", "Bonne place, gardien gentil.", "Behi, juste el portail chwaya ti9il.", ""],
  3: ["Correct mais difficile à trouver la première fois.", "Ça dépanne, rien de plus.", ""],
  2: ["L'hôte a mis du temps à ouvrir.", "Place plus petite que prévu."],
  1: ["Personne pour ouvrir à l'heure."],
};

export async function seed(pool: Pool, opts: SeedOptions = {}) {
  const now = opts.now ?? new Date();
  const rand = mulberry32(2026_11_22);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)];

  await pool.query("truncate reviews, photos, search_events, bookings, spots, zones, cities, users restart identity cascade");

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

  // Everyone is a plain account except the city operator. The three demo
  // accounts can also sign in on the login form with DEMO_PASSWORD.
  const demoHash = await hashPassword(DEMO_PASSWORD);
  const users: [string, string, string, string | null, string | null, Date][] = [
    [DEMO_USERS.driver.id, "user", DEMO_USERS.driver.name, DEMO_USERS.driver.phone, demoHash, new Date(now.getTime() - 200 * 86_400_000)],
    [DEMO_USERS.admin.id, "admin", DEMO_USERS.admin.name, DEMO_USERS.admin.phone, demoHash, new Date(now.getTime() - 300 * 86_400_000)],
    ...HOSTS.map((h, i) => [h.id, "user", h.name, h.phone, h.id === DEMO_USERS.host.id ? demoHash : null, new Date(now.getTime() - (250 - i) * 86_400_000)] as [string, string, string, string, string | null, Date]),
    ...OTHER_DRIVERS.map((d, i) => [d.id, "user", d.name, null, null, new Date(now.getTime() - (120 - i) * 86_400_000)] as [string, string, string, null, null, Date]),
  ];
  for (const u of users) {
    await pool.query("insert into users(id,role,name,phone,password_hash,created_at) values ($1,$2,$3,$4,$5,$6)", u);
  }

  const ownerOf = (host: number) => (host === -1 ? DEMO_USERS.driver.id : HOSTS[host].id);
  const spots = ALL_SPOTS.map((s, i) => {
    const zone = ZONES.find((z) => z.id === s.zone)!;
    return {
      id: spotId(i),
      seed: s,
      owner: ownerOf(s.host),
      city: zone.city,
      methods: s.methods ?? ALL_METHODS,
      // spots differ a little in quality, so ratings and the ranking are not uniform
      quality: rand() * 1.1 - 0.7,
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

  for (const [i, sp] of spots.entries()) {
    const s = sp.seed;
    await pool.query(
      `insert into spots(id,host_id,city_id,zone_id,title,description,address,lat,lng,spot_type,covered,private_attested,
        gardien_name,gardien_phone,photos,payment_methods,price_millimes,peak_multiplier,peak_start_hour,peak_end_hour,peak_months,
        avail_days,avail_start_min,avail_end_min,created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
      [
        sp.id, sp.owner, sp.city, s.zone, s.title, s.desc, s.address, s.lat, s.lng, s.type, s.covered ?? false,
        s.gardien?.[0] ?? null, s.gardien?.[1] ?? null, photosFor(s.type, i), sp.methods, s.price, sp.rules.peak_multiplier,
        sp.rules.peak_start_hour, sp.rules.peak_end_hour, sp.rules.peak_months, sp.avail.avail_days, sp.avail.avail_start_min,
        sp.avail.avail_end_min, new Date(now.getTime() - (90 - (i % 80)) * 86_400_000),
      ],
    );
  }

  let bookingCount = 0;
  let reviewCount = 0;
  if (opts.bookings !== false) {
    const others = OTHER_DRIVERS.map((d) => d.id);
    // The demo driver is a regular; the demo host also parks elsewhere sometimes.
    const pickDriver = () => {
      const x = rand();
      return x < 0.07 ? DEMO_USERS.driver.id : x < 0.1 ? DEMO_USERS.host.id : pick(others);
    };
    const taken = new Map<string, [number, number][]>();
    const free = (id: string, a: number, b: number) => !(taken.get(id) ?? []).some(([x, y]) => a < y && x < b);
    // weight Bab Bhar / Medina spots higher: that is where demand is
    const demoOwned = (s: (typeof spots)[number]) => s.owner === DEMO_USERS.host.id || s.owner === DEMO_USERS.driver.id;
    const weighted = spots.flatMap((s) => Array(Math.max(1, Math.round((ZONE_DEMAND[s.seed.zone] ?? 5) / 8)) * (demoOwned(s) ? 4 : 1)).fill(s));
    const today = tunisDateString(now);
    const reviewRows: unknown[][] = [];

    const insertBooking = async (sp: (typeof spots)[number], start: Date, end: Date, driver: string, status: string) => {
      const q = quote(sp.rules, start, end);
      const method = pick(sp.methods.includes("cash") ? ["cash", "cash", ...sp.methods] : sp.methods);
      const { rows } = await pool.query<{ id: string }>(
        `insert into bookings(spot_id,driver_id,start_at,end_at,status,amount_millimes,commission_millimes,payment_method,payment_ref,checkin_code,plate,created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
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
      return rows[0].id;
    };

    // ~4 weeks of history
    for (let d = 28; d >= 1; d--) {
      const day = tunisDateString(new Date(now.getTime() - d * 86_400_000));
      const n = 12 + Math.floor(rand() * 9);
      for (let k = 0; k < n; k++) {
        const sp = pick(weighted);
        const driver = pickDriver();
        if (driver === sp.owner) continue;
        const hour = 7 + Math.floor(rand() * 16);
        const start = fromTunisLocal(day, `${String(hour).padStart(2, "0")}:${rand() < 0.5 ? "00" : "30"}`);
        const end = new Date(start.getTime() + (1 + Math.floor(rand() * 5)) * 1_800_000);
        if (!fitsAvailability(sp.avail, start, end) || !free(sp.id, start.getTime(), end.getTime())) continue;
        const cancelled = rand() < 0.08;
        const id = await insertBooking(sp, start, end, driver, cancelled ? "cancelled" : "checked_in");
        // about 60% of stays get a review; the demo driver leaves the last week unrated
        const demoRecent = driver === DEMO_USERS.driver.id && d <= 7;
        if (!cancelled && !demoRecent && rand() < 0.6) {
          const x = rand() + sp.quality * 0.4 + 0.12;
          const rating = x > 0.55 ? 5 : x > 0.2 ? 4 : x > 0.08 ? 3 : x > 0.02 ? 2 : 1;
          reviewRows.push([id, sp.id, driver, rating, pick(COMMENTS[rating]), new Date(end.getTime() + (1 + rand() * 20) * 3_600_000)]);
        }
      }
    }

    // upcoming bookings on the demo host's spots so the host dashboard is alive
    const hostSpots = spots.filter((s) => s.owner === DEMO_USERS.host.id);
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
        await insertBooking(sp, start, end, pick(others), "confirmed");
        break;
      }
    }

    for (const r of reviewRows) {
      await pool.query("insert into reviews(booking_id,spot_id,driver_id,rating,comment,created_at) values ($1,$2,$3,$4,$5,$6)", r);
    }
    reviewCount = reviewRows.length;
    await pool.query(
      `update spots s set rating_sum = r.sum, rating_count = r.n
         from (select spot_id, sum(rating) as sum, count(*) as n from reviews group by spot_id) r
        where r.spot_id = s.id`,
    );
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
          const results = 3 + Math.floor(rand() * 9);
          rows.push([z.city, z.id, z.lat + (rand() - 0.5) * 0.006, z.lng + (rand() - 0.5) * 0.006, results, Math.max(0, results - Math.floor(rand() * 5)), at]);
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

  await pool.query(
    "insert into app_meta(key, value) values ('seed_version', $1) on conflict (key) do update set value = excluded.value",
    [SEED_VERSION],
  );
  return { spots: spots.length, bookings: bookingCount, reviews: reviewCount, searches: searchCount };
}

if (process.argv[1] && process.argv[1].endsWith("seed.ts")) {
  const pool = createPool(databaseUrl() ?? LOCAL_DATABASE_URL);
  seed(pool)
    .then((r) => console.log("seeded", r))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
