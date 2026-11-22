import type { Db } from "./db";
import { AppError } from "./errors";
import { quote, type PriceRules, type Quote } from "@/lib/pricing";
import { fitsAvailability, type Availability } from "@/lib/time";
import type { SpotInput } from "@/lib/validation";

/** Bookings in these states hold the slot (pending ones only for 15 minutes). */
export const LIVE_STATUSES = ["pending_payment", "confirmed", "checked_in"] as const;
export const PENDING_TTL_MIN = 15;

export interface SpotRow {
  id: string;
  host_id: string;
  host_name?: string;
  city_id: string;
  zone_id: string | null;
  title: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  spot_type: string;
  covered: boolean;
  private_attested: boolean;
  gardien_name: string | null;
  gardien_phone: string | null;
  photo_url: string | null;
  price_millimes: number;
  peak_multiplier: string | number;
  peak_start_hour: number | null;
  peak_end_hour: number | null;
  peak_months: number[];
  avail_days: number[];
  avail_start_min: number;
  avail_end_min: number;
  active: boolean;
  distance_m?: number;
  busy?: boolean;
}

export interface SpotDTO {
  id: string;
  hostId: string;
  hostName?: string;
  cityId: string;
  zoneId: string | null;
  title: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  spotType: string;
  covered: boolean;
  privateAttested: boolean;
  gardienName: string | null;
  gardienPhone: string | null;
  photoUrl: string | null;
  priceMillimes: number;
  peakMultiplier: number;
  peakStartHour: number | null;
  peakEndHour: number | null;
  peakMonths: number[];
  availDays: number[];
  availStartMin: number;
  availEndMin: number;
  active: boolean;
  distanceM?: number;
  /** For a requested window: free and inside opening hours. */
  available?: boolean;
  unavailableReason?: "booked" | "closed";
  quote?: Quote;
}

export const rulesOf = (r: SpotRow): PriceRules => ({
  price_millimes: r.price_millimes,
  peak_multiplier: Number(r.peak_multiplier),
  peak_start_hour: r.peak_start_hour,
  peak_end_hour: r.peak_end_hour,
  peak_months: r.peak_months ?? [],
});

export const availOf = (r: SpotRow): Availability => ({
  avail_days: r.avail_days,
  avail_start_min: r.avail_start_min,
  avail_end_min: r.avail_end_min,
});

export function toDTO(r: SpotRow, window?: { start: Date; end: Date }): SpotDTO {
  const dto: SpotDTO = {
    id: r.id,
    hostId: r.host_id,
    hostName: r.host_name,
    cityId: r.city_id,
    zoneId: r.zone_id,
    title: r.title,
    description: r.description,
    address: r.address,
    lat: r.lat,
    lng: r.lng,
    spotType: r.spot_type,
    covered: r.covered,
    privateAttested: r.private_attested,
    gardienName: r.gardien_name,
    gardienPhone: r.gardien_phone,
    photoUrl: r.photo_url,
    priceMillimes: r.price_millimes,
    peakMultiplier: Number(r.peak_multiplier),
    peakStartHour: r.peak_start_hour,
    peakEndHour: r.peak_end_hour,
    peakMonths: r.peak_months ?? [],
    availDays: r.avail_days,
    availStartMin: r.avail_start_min,
    availEndMin: r.avail_end_min,
    active: r.active,
  };
  if (r.distance_m != null) dto.distanceM = Math.round(r.distance_m);
  if (window) {
    const open = fitsAvailability(availOf(r), window.start, window.end);
    dto.available = open && !r.busy;
    if (!dto.available) dto.unavailableReason = r.busy ? "booked" : "closed";
    dto.quote = quote(rulesOf(r), window.start, window.end);
  }
  return dto;
}

const busySql = (startParam: string, endParam: string) => `exists (
  select 1 from bookings b
  where b.spot_id = s.id
    and b.status in ('pending_payment','confirmed','checked_in')
    and not (b.status = 'pending_payment' and b.created_at < now() - interval '${PENDING_TTL_MIN} minutes')
    and tstzrange(b.start_at, b.end_at, '[)') && tstzrange(${startParam}::timestamptz, ${endParam}::timestamptz, '[)')
)`;

export interface SearchParams {
  lat: number;
  lng: number;
  radius: number;
  start: Date;
  end: Date;
  limit: number;
}

/**
 * Radius search. `earth_box(...) @> ll_to_earth(lat,lng)` is answered by the
 * GiST index on ll_to_earth(lat,lng); earth_distance then trims the box corners.
 */
export async function searchSpots(db: Db, p: SearchParams, opts: { log?: boolean } = {}) {
  const { rows } = await db.query<SpotRow>(
    `select s.*, earth_distance(ll_to_earth($1, $2), ll_to_earth(s.lat, s.lng)) as distance_m, ${busySql("$4", "$5")} as busy
       from spots s
      where s.active
        and earth_box(ll_to_earth($1, $2), $3) @> ll_to_earth(s.lat, s.lng)
        and earth_distance(ll_to_earth($1, $2), ll_to_earth(s.lat, s.lng)) <= $3
      order by distance_m
      limit $6`,
    [p.lat, p.lng, p.radius, p.start.toISOString(), p.end.toISOString(), p.limit],
  );
  const spots = rows.map((r) => toDTO(r, { start: p.start, end: p.end }));
  if (opts.log !== false) {
    // anonymous demand signal for the city view; never blocks the response
    void logSearch(db, p.lat, p.lng, spots.length, spots.filter((s) => s.available).length).catch(() => {});
  }
  return spots;
}

async function logSearch(db: Db, lat: number, lng: number, results: number, available: number) {
  await db.query(
    `insert into search_events (city_id, zone_id, lat, lng, results, available)
     select z.city_id, z.id, $1, $2, $3, $4 from zones z
      order by earth_distance(ll_to_earth($1, $2), ll_to_earth(z.center_lat, z.center_lng))
      limit 1`,
    [lat, lng, results, available],
  );
}

export async function getSpot(db: Db, id: string, window?: { start: Date; end: Date }) {
  const params: unknown[] = [id];
  let busy = "false";
  if (window) {
    params.push(window.start.toISOString(), window.end.toISOString());
    busy = busySql("$2", "$3");
  }
  const { rows } = await db.query<SpotRow>(
    `select s.*, u.name as host_name, ${busy} as busy
       from spots s join users u on u.id = s.host_id
      where s.id = $1`,
    params,
  );
  if (!rows[0]) throw new AppError("not_found", "spot not found");
  return toDTO(rows[0], window);
}

/** Booked intervals for a spot on a given range (for the day timeline). */
export async function spotSchedule(db: Db, id: string, from: Date, to: Date) {
  const { rows } = await db.query<{ start_at: Date; end_at: Date }>(
    `select start_at, end_at from bookings
      where spot_id = $1 and status in ('pending_payment','confirmed','checked_in')
        and not (status = 'pending_payment' and created_at < now() - interval '${PENDING_TTL_MIN} minutes')
        and tstzrange(start_at, end_at, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
      order by start_at`,
    [id, from.toISOString(), to.toISOString()],
  );
  return rows.map((r) => ({ start: r.start_at.toISOString(), end: r.end_at.toISOString() }));
}

function spotParams(input: SpotInput) {
  return [
    input.title,
    input.description ?? "",
    input.address ?? "",
    input.lat,
    input.lng,
    input.spotType,
    input.covered ?? false,
    input.gardienName || null,
    input.gardienPhone || null,
    input.photoUrl || null,
    input.priceMillimes,
    input.peakMultiplier ?? 1,
    input.peakStartHour,
    input.peakEndHour,
    input.peakMonths ?? [],
    input.availDays,
    input.availStartMin,
    input.availEndMin,
  ];
}

export async function createSpot(db: Db, hostId: string, input: SpotInput) {
  const { rows } = await db.query<SpotRow>(
    `with z as (
       select id, city_id from zones
        order by earth_distance(ll_to_earth($4, $5), ll_to_earth(center_lat, center_lng)) limit 1
     )
     insert into spots (host_id, city_id, zone_id, title, description, address, lat, lng, spot_type, covered,
                        private_attested, gardien_name, gardien_phone, photo_url, price_millimes, peak_multiplier,
                        peak_start_hour, peak_end_hour, peak_months, avail_days, avail_start_min, avail_end_min)
     select $19, z.city_id, z.id, $1, $2, $3, $4, $5, $6, $7, true, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
       from z
     returning *`,
    [...spotParams(input), hostId],
  );
  return toDTO(rows[0]);
}

export async function updateSpot(db: Db, hostId: string, spotId: string, input: SpotInput & { active?: boolean }) {
  const owner = await db.query<{ host_id: string }>("select host_id from spots where id = $1", [spotId]);
  if (!owner.rows[0]) throw new AppError("not_found", "spot not found");
  // Authorization lives in the data layer: a host can only edit their own spots.
  if (owner.rows[0].host_id !== hostId) throw new AppError("forbidden", "not your spot");
  const { rows } = await db.query<SpotRow>(
    `update spots set title=$1, description=$2, address=$3, lat=$4, lng=$5, spot_type=$6, covered=$7,
            gardien_name=$8, gardien_phone=$9, photo_url=$10, price_millimes=$11, peak_multiplier=$12,
            peak_start_hour=$13, peak_end_hour=$14, peak_months=$15, avail_days=$16, avail_start_min=$17,
            avail_end_min=$18, active=coalesce($21, active)
      where id=$19 and host_id=$20
      returning *`,
    [...spotParams(input), spotId, hostId, input.active ?? null],
  );
  return toDTO(rows[0]);
}

export async function setSpotActive(db: Db, hostId: string, spotId: string, active: boolean) {
  const { rows } = await db.query<SpotRow>("update spots set active=$3 where id=$1 and host_id=$2 returning *", [spotId, hostId, active]);
  if (!rows[0]) {
    const exists = await db.query("select 1 from spots where id=$1", [spotId]);
    throw new AppError(exists.rowCount ? "forbidden" : "not_found");
  }
  return toDTO(rows[0]);
}

export async function listHostSpots(db: Db, hostId: string) {
  const { rows } = await db.query<SpotRow>("select * from spots where host_id = $1 order by created_at desc", [hostId]);
  return rows.map((r) => toDTO(r));
}

export async function listCities(db: Db) {
  const cities = await db.query("select * from cities order by id desc");
  const zones = await db.query("select * from zones order by id");
  return { cities: cities.rows, zones: zones.rows };
}
