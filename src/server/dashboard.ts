import type { Db } from "./db";
import { ASSUMED_CIRCLING_MIN_PER_BOOKING } from "./admin";
import { EMPTY_ACTIVITY, profile, type Activity } from "@/lib/gamification";
import { ratingAvg } from "@/lib/ranking";

// Tunis is UTC+1 all year (no DST), same convention as the city view.
const LOCAL_HOUR = "extract(hour from (b.start_at at time zone 'UTC') + interval '1 hour')";
const STAYED = "(b.status = 'checked_in' or (b.status = 'confirmed' and b.end_at <= $2::timestamptz))";
const CENTRE_ZONES = "('sousse-babbhar','sousse-medina')";

/** Everything one account did, as a driver and as a host. */
export async function activity(db: Db, userId: string, now = new Date()): Promise<Activity> {
  const { rows } = await db.query<Record<string, string | null>>(
    `select
       (select count(*) from bookings b where b.driver_id=$1 and ${STAYED}) as stays,
       (select count(*) from reviews where driver_id=$1) as reviews,
       (select count(*) from bookings b join spots s on s.id=b.spot_id where b.driver_id=$1 and ${STAYED} and s.zone_id in ${CENTRE_ZONES}) as centre,
       (select count(*) from bookings b where b.driver_id=$1 and ${STAYED} and ${LOCAL_HOUR} < 9) as early,
       (select count(*) from bookings b where b.driver_id=$1 and ${STAYED} and ${LOCAL_HOUR} >= 21) as late,
       (select count(*) from bookings b join spots s on s.id=b.spot_id where s.host_id=$1 and ${STAYED}) as hosted,
       (select sum(b.amount_millimes - b.commission_millimes) from bookings b join spots s on s.id=b.spot_id
         where s.host_id=$1 and b.status in ('confirmed','checked_in') and b.start_at < $2::timestamptz) as earned,
       (select count(*) from spots where host_id=$1) as spots,
       (select count(*) from spots where host_id=$1 and avail_start_min=0 and avail_end_min=1440 and cardinality(avail_days)=7) as allday,
       (select sum(rating_sum) from spots where host_id=$1) as rsum,
       (select sum(rating_count) from spots where host_id=$1) as rcount`,
    [userId, now.toISOString()],
  );
  const r = rows[0];
  const n = (k: string) => Number(r[k] ?? 0);
  return {
    ...EMPTY_ACTIVITY,
    stays: n("stays"),
    reviewsWritten: n("reviews"),
    centreStays: n("centre"),
    earlyStays: n("early"),
    lateStays: n("late"),
    hostedStays: n("hosted"),
    hostEarnedMillimes: n("earned"),
    spots: n("spots"),
    allDaySpots: n("allday"),
    ratingAvg: ratingAvg(n("rsum"), n("rcount")),
    ratingCount: n("rcount"),
  };
}

/** The driver ("client") side: what Plassa did for me. */
export async function driverDashboard(db: Db, userId: string, now = new Date()) {
  const n = now.toISOString();
  const [act, totals, months, favourites, toReview] = await Promise.all([
    activity(db, userId, now),
    db.query<{ spent: string | null; minutes: string | null; upcoming: string }>(
      `select
         (select sum(b.amount_millimes) from bookings b where b.driver_id=$1 and ${STAYED}) as spent,
         (select sum(extract(epoch from (b.end_at-b.start_at))/60) from bookings b where b.driver_id=$1 and ${STAYED}) as minutes,
         (select count(*) from bookings b where b.driver_id=$1 and b.status in ('confirmed','pending_payment') and b.end_at > $2::timestamptz) as upcoming`,
      [userId, n],
    ),
    db.query<{ month: string; spent: string; stays: string }>(
      `select to_char(date_trunc('month', (b.start_at at time zone 'UTC') + interval '1 hour'), 'YYYY-MM') as month,
              sum(b.amount_millimes) as spent, count(*) as stays
         from bookings b where b.driver_id=$1 and ${STAYED} and b.start_at >= $2::timestamptz - interval '6 months'
        group by 1 order by 1`,
      [userId, n],
    ),
    db.query<{ id: string; title: string; photo: string | null; stays: string }>(
      `select s.id, s.title, s.photos[1] as photo, count(*) as stays
         from bookings b join spots s on s.id=b.spot_id
        where b.driver_id=$1 and ${STAYED}
        group by s.id order by count(*) desc, max(b.start_at) desc limit 3`,
      [userId, n],
    ),
    db.query<{ id: string; spot_id: string; title: string; photo: string | null; start_at: Date; end_at: Date }>(
      `select b.id, b.spot_id, s.title, s.photos[1] as photo, b.start_at, b.end_at
         from bookings b join spots s on s.id=b.spot_id
         left join reviews r on r.booking_id=b.id
        where b.driver_id=$1 and ${STAYED} and r.id is null
        order by b.end_at desc limit 3`,
      [userId, n],
    ),
  ]);
  const t = totals.rows[0];
  return {
    stays: act.stays,
    upcoming: Number(t.upcoming),
    spentMillimes: Number(t.spent ?? 0),
    hoursParked: Math.round(Number(t.minutes ?? 0) / 60),
    minutesSaved: act.stays * ASSUMED_CIRCLING_MIN_PER_BOOKING,
    reviewsWritten: act.reviewsWritten,
    hostSpots: act.spots,
    hostedStays: act.hostedStays,
    months: months.rows.map((m) => ({ month: m.month, spentMillimes: Number(m.spent), stays: Number(m.stays) })),
    favourites: favourites.rows.map((f) => ({ id: f.id, title: f.title, photo: f.photo, stays: Number(f.stays) })),
    toReview: toReview.rows.map((r) => ({ bookingId: r.id, spotId: r.spot_id, title: r.title, photo: r.photo, start: r.start_at.toISOString(), end: r.end_at.toISOString() })),
    ...profile(act),
  };
}

/** The host ("renter") side: earnings, occupancy, ratings, ranking among hosts. */
export async function hostDashboard(db: Db, userId: string, now = new Date()) {
  const n = now.toISOString();
  const [act, weeks, occ, reviews, rank, methods] = await Promise.all([
    activity(db, userId, now),
    db.query<{ week: number; earned: string | null; bookings: string }>(
      `select w.i as week, sum(b.amount_millimes - b.commission_millimes) as earned, count(b.id) as bookings
         from generate_series(0, 7) as w(i)
         left join (bookings b join spots s on s.id=b.spot_id and s.host_id=$1)
           on b.status in ('confirmed','checked_in')
          and b.start_at >= $2::timestamptz - ((w.i + 1) * interval '7 days')
          and b.start_at <  $2::timestamptz - (w.i * interval '7 days')
        group by w.i order by w.i desc`,
      [userId, n],
    ),
    // occupancy over 30 days: booked minutes / open minutes of active spots
    db.query<{ booked: string | null; open: string | null }>(
      `select
         (select sum(extract(epoch from (b.end_at-b.start_at))/60) from bookings b join spots s on s.id=b.spot_id
           where s.host_id=$1 and b.status in ('confirmed','checked_in') and b.start_at >= $2::timestamptz - interval '30 days' and b.start_at < $2::timestamptz) as booked,
         (select sum((avail_end_min - avail_start_min) * cardinality(avail_days) * 30.0 / 7) from spots where host_id=$1 and active) as open`,
      [userId, n],
    ),
    db.query<{ id: string; rating: number; comment: string; driver: string; spot: string; created_at: Date }>(
      `select r.id, r.rating, r.comment, u.name as driver, s.title as spot, r.created_at
         from reviews r join spots s on s.id=r.spot_id join users u on u.id=r.driver_id
        where s.host_id=$1 order by r.created_at desc limit 4`,
      [userId],
    ),
    // rank among hosts by stays hosted over the last 30 days
    db.query<{ rank: string | null; hosts: string }>(
      `with h as (
         select s.host_id, count(b.id) as n from spots s
           left join bookings b on b.spot_id=s.id and b.status in ('confirmed','checked_in')
                 and b.start_at >= $2::timestamptz - interval '30 days' and b.start_at < $2::timestamptz
          group by s.host_id)
       select (select 1 + count(*) from h where n > (select coalesce(max(n), -1) from h where host_id=$1)) as rank,
              (select count(*) from h) as hosts,
              exists(select 1 from h where host_id=$1) as is_host`,
      [userId, n],
    ),
    db.query<{ method: string; n: string }>(
      `select b.payment_method as method, count(*) as n from bookings b join spots s on s.id=b.spot_id
        where s.host_id=$1 and b.status in ('confirmed','checked_in') and b.start_at >= $2::timestamptz - interval '30 days'
        group by 1 order by 2 desc`,
      [userId, n],
    ),
  ]);
  const o = occ.rows[0];
  const open = Number(o.open ?? 0);
  return {
    weeks: weeks.rows.map((w) => ({ weeksAgo: Number(w.week), earnedMillimes: Number(w.earned ?? 0), bookings: Number(w.bookings) })),
    occupancy: open > 0 ? Math.min(1, Number(o.booked ?? 0) / open) : 0,
    bookedHours30d: Math.round(Number(o.booked ?? 0) / 60),
    rating: { avg: act.ratingAvg, count: act.ratingCount },
    hostedStays: act.hostedStays,
    earnedMillimes: act.hostEarnedMillimes,
    reviews: reviews.rows.map((r) => ({ id: r.id, rating: r.rating, comment: r.comment, driverName: r.driver, spotTitle: r.spot, createdAt: r.created_at.toISOString() })),
    rank: act.spots > 0 ? { position: Number(rank.rows[0].rank), of: Number(rank.rows[0].hosts) } : null,
    paymentMix: methods.rows.map((m) => ({ method: m.method, bookings: Number(m.n) })),
    ...profile(act),
  };
}

/** Hosts ranked by stays hosted in the last 30 days, then by rating. */
export async function hostLeaderboard(db: Db, limit = 5, now = new Date()) {
  const { rows } = await db.query<{ id: string; name: string; stays: string; rsum: string | null; rcount: string | null; spots: string }>(
    `with sp as (
       select host_id, sum(rating_sum) as rsum, sum(rating_count) as rcount, count(*) as spots from spots where active group by host_id),
     st as (
       select s.host_id, count(*) as stays from bookings b join spots s on s.id=b.spot_id
        where b.status in ('confirmed','checked_in') and b.start_at >= $2::timestamptz - interval '30 days' and b.start_at < $2::timestamptz
        group by s.host_id)
     select u.id, u.name, coalesce(st.stays, 0) as stays, sp.rsum, sp.rcount, sp.spots
       from sp join users u on u.id=sp.host_id left join st on st.host_id=sp.host_id
      order by coalesce(st.stays, 0) desc, u.name limit $1`,
    [limit, now.toISOString()],
  );
  return rows.map((r) => ({ id: r.id, name: r.name, stays: Number(r.stays), spots: Number(r.spots), ratingAvg: ratingAvg(Number(r.rsum ?? 0), Number(r.rcount ?? 0)) }));
}
