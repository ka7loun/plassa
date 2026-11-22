import type { Db } from "./db";

/**
 * Assumption used for the "circling time saved" estimate, shown in the UI next
 * to the number. Field surveys of urban cruising for parking commonly report
 * several to ~15 minutes per trip in dense centres; we use a conservative 10.
 */
export const ASSUMED_CIRCLING_MIN_PER_BOOKING = 10;

export async function cityStats(db: Db, cityId: string, now = new Date()) {
  const n = now.toISOString();
  const [totals, zones, hourly, daily, heat] = await Promise.all([
    db.query<{ spots: string; hosts: string; bookings: string; gmv: string | null; commission: string | null; booked_min: string | null; searches: string; unmet: string }>(
      `select
         (select count(*) from spots where city_id=$1 and active) as spots,
         (select count(distinct host_id) from spots where city_id=$1 and active) as hosts,
         (select count(*) from bookings b join spots s on s.id=b.spot_id where s.city_id=$1 and b.status in ('confirmed','checked_in') and b.start_at >= $2::timestamptz - interval '28 days' and b.start_at < $2::timestamptz) as bookings,
         (select sum(b.amount_millimes) from bookings b join spots s on s.id=b.spot_id where s.city_id=$1 and b.status in ('confirmed','checked_in') and b.start_at >= $2::timestamptz - interval '28 days' and b.start_at < $2::timestamptz) as gmv,
         (select sum(b.commission_millimes) from bookings b join spots s on s.id=b.spot_id where s.city_id=$1 and b.status in ('confirmed','checked_in') and b.start_at >= $2::timestamptz - interval '28 days' and b.start_at < $2::timestamptz) as commission,
         (select sum(extract(epoch from (b.end_at-b.start_at))/60) from bookings b join spots s on s.id=b.spot_id where s.city_id=$1 and b.status in ('confirmed','checked_in') and b.start_at >= $2::timestamptz - interval '28 days' and b.start_at < $2::timestamptz) as booked_min,
         (select count(*) from search_events where city_id=$1 and created_at >= $2::timestamptz - interval '28 days') as searches,
         (select count(*) from search_events where city_id=$1 and created_at >= $2::timestamptz - interval '28 days' and available = 0) as unmet`,
      [cityId, n],
    ),
    db.query<{ id: string; name_fr: string; name_ar: string; name_en: string; lat: number; lng: number; spots: string; searches: string; unmet: string; bookings: string }>(
      `select z.id, z.name_fr, z.name_ar, z.name_en, z.center_lat as lat, z.center_lng as lng,
              (select count(*) from spots s where s.zone_id=z.id and s.active) as spots,
              (select count(*) from search_events e where e.zone_id=z.id and e.created_at >= $2::timestamptz - interval '28 days') as searches,
              (select count(*) from search_events e where e.zone_id=z.id and e.created_at >= $2::timestamptz - interval '28 days' and e.available=0) as unmet,
              (select count(*) from bookings b join spots s on s.id=b.spot_id where s.zone_id=z.id and b.status in ('confirmed','checked_in') and b.start_at >= $2::timestamptz - interval '28 days' and b.start_at < $2::timestamptz) as bookings
         from zones z where z.city_id=$1 order by z.id`,
      [cityId, n],
    ),
    db.query<{ hour: number; searches: string }>(
      `select extract(hour from (created_at at time zone 'UTC') + interval '1 hour')::int as hour, count(*) as searches
         from search_events where city_id=$1 and created_at >= $2::timestamptz - interval '28 days'
        group by 1 order by 1`,
      [cityId, n],
    ),
    db.query<{ day: string; bookings: string; gmv: string }>(
      `select to_char(((b.start_at at time zone 'UTC') + interval '1 hour')::date, 'YYYY-MM-DD') as day, count(*) as bookings, sum(b.amount_millimes) as gmv
         from bookings b join spots s on s.id=b.spot_id
        where s.city_id=$1 and b.status in ('confirmed','checked_in') and b.start_at >= $2::timestamptz - interval '28 days' and b.start_at < $2::timestamptz
        group by 1 order by 1`,
      [cityId, n],
    ),
    db.query<{ lat: number; lng: number }>(
      `select lat, lng from search_events where city_id=$1 and created_at >= $2::timestamptz - interval '14 days' order by id desc limit 3000`,
      [cityId, n],
    ),
  ]);

  const t = totals.rows[0];
  const bookings = Number(t.bookings);
  const searches = Number(t.searches);
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, searches: 0 }));
  for (const r of hourly.rows) hours[r.hour].searches = Number(r.searches);

  return {
    cityId,
    windowDays: 28,
    totals: {
      activeSpots: Number(t.spots),
      hosts: Number(t.hosts),
      bookings,
      gmvMillimes: Number(t.gmv ?? 0),
      commissionMillimes: Number(t.commission ?? 0),
      bookedHours: Math.round(Number(t.booked_min ?? 0) / 60),
      searches,
      unmetSearchShare: searches ? Number(t.unmet) / searches : 0,
      circlingMinutesSaved: bookings * ASSUMED_CIRCLING_MIN_PER_BOOKING,
      assumedCirclingMinPerBooking: ASSUMED_CIRCLING_MIN_PER_BOOKING,
    },
    zones: zones.rows
      .map((z) => {
        const spots = Number(z.spots);
        const s = Number(z.searches);
        return {
          id: z.id,
          name: { fr: z.name_fr, ar: z.name_ar, en: z.name_en },
          lat: z.lat,
          lng: z.lng,
          spots,
          searches: s,
          bookings: Number(z.bookings),
          unmetShare: s ? Number(z.unmet) / s : 0,
          // searches per day per listed spot: where new hosts are needed most
          pressure: spots ? s / 28 / spots : s / 28,
        };
      })
      .sort((a, b) => b.pressure - a.pressure),
    hourly: hours,
    daily: daily.rows.map((d) => ({ day: d.day, bookings: Number(d.bookings), gmvMillimes: Number(d.gmv) })),
    heat: heat.rows.map((h) => [h.lng, h.lat] as [number, number]),
  };
}
