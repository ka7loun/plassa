import type { Pool, PoolClient } from "pg";
import { EXCLUSION_VIOLATION, pgCode, UNIQUE_VIOLATION, withTx, type Db } from "./db";
import { AppError } from "./errors";
import { availOf, PENDING_TTL_MIN, rulesOf, type SpotRow } from "./spots";
import { generateCheckinCode } from "@/lib/checkin";
import { providerFor, type PaymentMethod } from "@/lib/payments";
import { quote } from "@/lib/pricing";
import { fitsAvailability } from "@/lib/time";

export interface BookingRow {
  id: string;
  spot_id: string;
  driver_id: string;
  start_at: Date;
  end_at: Date;
  status: "pending_payment" | "confirmed" | "checked_in" | "cancelled" | "expired";
  amount_millimes: number;
  commission_millimes: number;
  payment_method: PaymentMethod;
  payment_ref: string | null;
  checkin_code: string;
  plate: string | null;
  created_at: Date;
  cancelled_at: Date | null;
  // joined
  spot_title?: string;
  spot_address?: string;
  spot_lat?: number;
  spot_lng?: number;
  gardien_name?: string | null;
  gardien_phone?: string | null;
  host_name?: string;
  driver_name?: string;
  spot_photo?: string | null;
  my_rating?: number | null;
}

export interface BookingDTO {
  id: string;
  spotId: string;
  driverId: string;
  start: string;
  end: string;
  status: BookingRow["status"];
  amountMillimes: number;
  commissionMillimes: number;
  hostMillimes: number;
  paymentMethod: PaymentMethod;
  paymentRef: string | null;
  checkinCode?: string;
  plate: string | null;
  createdAt: string;
  spot?: { title: string; address: string; lat: number; lng: number; gardienName: string | null; gardienPhone: string | null; hostName?: string; photo?: string | null };
  driverName?: string;
  /** The driver's rating of this stay, null when not rated yet. */
  myRating?: number | null;
}

export function bookingDTO(r: BookingRow, opts: { withCode?: boolean } = {}): BookingDTO {
  return {
    id: r.id,
    spotId: r.spot_id,
    driverId: r.driver_id,
    start: new Date(r.start_at).toISOString(),
    end: new Date(r.end_at).toISOString(),
    status: r.status,
    amountMillimes: r.amount_millimes,
    commissionMillimes: r.commission_millimes,
    hostMillimes: r.amount_millimes - r.commission_millimes,
    paymentMethod: r.payment_method,
    paymentRef: r.payment_ref,
    checkinCode: opts.withCode ? r.checkin_code : undefined,
    plate: r.plate,
    createdAt: new Date(r.created_at).toISOString(),
    spot:
      r.spot_title != null
        ? {
            title: r.spot_title,
            address: r.spot_address ?? "",
            lat: r.spot_lat!,
            lng: r.spot_lng!,
            gardienName: r.gardien_name ?? null,
            gardienPhone: r.gardien_phone ?? null,
            hostName: r.host_name,
            photo: r.spot_photo ?? null,
          }
        : undefined,
    driverName: r.driver_name,
    myRating: r.my_rating ?? null,
  };
}

const JOINED = `select b.*, s.title as spot_title, s.address as spot_address, s.lat as spot_lat, s.lng as spot_lng,
                       s.gardien_name, s.gardien_phone, h.name as host_name, d.name as driver_name,
                       s.photos[1] as spot_photo, rv.rating as my_rating
                  from bookings b
                  left join reviews rv on rv.booking_id = b.id
                  join spots s on s.id = b.spot_id
                  join users h on h.id = s.host_id
                  join users d on d.id = b.driver_id`;

export interface CreateBookingInput {
  spotId: string;
  start: Date;
  end: Date;
  paymentMethod: PaymentMethod;
  plate?: string;
}

/** Allow a few minutes of clock skew / "I'm arriving now" bookings. */
const PAST_GRACE_MS = 10 * 60_000;

export async function createBooking(pool: Pool, driverId: string, input: CreateBookingInput, now = new Date()) {
  if (input.start.getTime() < now.getTime() - PAST_GRACE_MS) throw new AppError("in_the_past", "start is in the past");

  return withTx(pool, async (c: PoolClient) => {
    const { rows } = await c.query<SpotRow>("select * from spots where id = $1 and active", [input.spotId]);
    const spot = rows[0];
    if (!spot) throw new AppError("not_found", "spot not found");
    if (spot.host_id === driverId) throw new AppError("own_spot", "you cannot book your own spot");
    if (!(spot.payment_methods ?? []).includes(input.paymentMethod)) {
      throw new AppError("method_not_accepted", "the host does not accept this payment method", { accepted: spot.payment_methods });
    }
    if (!fitsAvailability(availOf(spot), input.start, input.end)) {
      throw new AppError("outside_availability", "the spot is closed at that time");
    }

    // Unpaid holds expire so an abandoned checkout never blocks a spot forever.
    await c.query(
      `update bookings set status = 'expired'
        where spot_id = $1 and status = 'pending_payment' and created_at < now() - interval '${PENDING_TTL_MIN} minutes'`,
      [spot.id],
    );

    const q = quote(rulesOf(spot), input.start, input.end);
    const provider = providerFor(input.paymentMethod);
    const status = input.paymentMethod === "cash" ? "confirmed" : "pending_payment";

    let booking: BookingRow;
    try {
      const res = await c.query<BookingRow>(
        `insert into bookings (spot_id, driver_id, start_at, end_at, status, amount_millimes, commission_millimes,
                               payment_method, checkin_code, plate)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
        [spot.id, driverId, input.start, input.end, status, q.totalMillimes, q.commissionMillimes, input.paymentMethod, generateCheckinCode(), input.plate?.toUpperCase() || null],
      );
      booking = res.rows[0];
    } catch (e) {
      // The exclusion constraint is the single source of truth for overlaps.
      if (pgCode(e) === EXCLUSION_VIOLATION) throw new AppError("slot_taken", "this slot was just taken");
      throw e;
    }

    const intent = await provider.createIntent(booking.id, q.totalMillimes, input.paymentMethod);
    const upd = await c.query<BookingRow>("update bookings set payment_ref = $2 where id = $1 returning *", [booking.id, intent.ref]);
    return { booking: bookingDTO(upd.rows[0], { withCode: true }), quote: q, redirectUrl: intent.redirectUrl };
  });
}

async function loadOwnBooking(db: Db, driverId: string, bookingId: string) {
  const { rows } = await db.query<BookingRow>(`${JOINED} where b.id = $1`, [bookingId]);
  const b = rows[0];
  if (!b) throw new AppError("not_found", "booking not found");
  if (b.driver_id !== driverId) throw new AppError("forbidden", "not your booking");
  return b;
}

export async function getDriverBooking(db: Db, driverId: string, bookingId: string) {
  return bookingDTO(await loadOwnBooking(db, driverId, bookingId), { withCode: true });
}

export async function confirmPayment(db: Db, driverId: string, bookingId: string, ref: string, approved: boolean) {
  const b = await loadOwnBooking(db, driverId, bookingId);
  if (b.status !== "pending_payment") {
    if (b.status === "confirmed") return bookingDTO(b, { withCode: true }); // idempotent
    throw new AppError("not_cancellable", `booking is ${b.status}`);
  }
  if (b.payment_ref !== ref) throw new AppError("bad_request", "payment reference mismatch");
  const ok = await providerFor(b.payment_method).confirm(ref, b.amount_millimes, approved);
  const next = ok ? "confirmed" : "cancelled";
  await db.query(
    `update bookings set status = $2, cancelled_at = case when $2 = 'cancelled' then now() else null end
      where id = $1 and status = 'pending_payment'`,
    [bookingId, next],
  );
  const after = await loadOwnBooking(db, driverId, bookingId);
  if (!ok) throw new AppError("payment_failed", "the payment was declined", bookingDTO(after));
  return bookingDTO(after, { withCode: true });
}

export async function cancelBooking(db: Db, driverId: string, bookingId: string, now = new Date()) {
  const b = await loadOwnBooking(db, driverId, bookingId);
  if (!["pending_payment", "confirmed"].includes(b.status)) throw new AppError("not_cancellable", `booking is ${b.status}`);
  if (new Date(b.start_at) <= now) throw new AppError("not_cancellable", "the booking has already started");
  await db.query("update bookings set status = 'cancelled', cancelled_at = now() where id = $1", [bookingId]);
  const refund =
    b.status === "confirmed" && b.payment_ref ? await providerFor(b.payment_method).refund(b.payment_ref, b.amount_millimes) : { refunded: false };
  return { booking: bookingDTO(await loadOwnBooking(db, driverId, bookingId), { withCode: true }), refunded: refund.refunded };
}

export async function listDriverBookings(db: Db, driverId: string) {
  const { rows } = await db.query<BookingRow>(`${JOINED} where b.driver_id = $1 and b.status <> 'expired' order by b.start_at desc limit 50`, [driverId]);
  return rows.map((r) => bookingDTO(r, { withCode: true }));
}

export async function listHostBookings(db: Db, hostId: string, now = new Date()) {
  const { rows } = await db.query<BookingRow>(
    `${JOINED} where s.host_id = $1 and b.status in ('confirmed','checked_in','cancelled')
       and b.end_at > $2::timestamptz - interval '7 days'
     order by b.start_at asc limit 100`,
    [hostId, now.toISOString()],
  );
  // hosts never see the check-in code: the driver shows it to them
  return rows.map((r) => bookingDTO(r));
}

/** Host (or their gardien) types the driver's 4-digit code on arrival. */
export async function checkIn(db: Db, hostId: string, code: string, now = new Date()) {
  const { rows } = await db.query<BookingRow>(
    `${JOINED} where s.host_id = $1 and b.checkin_code = $2 and b.status = 'confirmed'
        and $3::timestamptz between b.start_at - interval '30 minutes' and b.end_at
      order by abs(extract(epoch from (b.start_at - $3::timestamptz))) limit 1`,
    [hostId, code, now.toISOString()],
  );
  const b = rows[0];
  if (!b) throw new AppError("not_found", "no booking with this code right now");
  await db.query("update bookings set status = 'checked_in' where id = $1", [b.id]);
  return bookingDTO({ ...b, status: "checked_in" });
}

export async function hostSummary(db: Db, hostId: string, now = new Date()) {
  const { rows } = await db.query<{
    week_host: string | null;
    month_host: string | null;
    month_count: string;
    upcoming: string;
    spots: string;
  }>(
    `select
       (select sum(b.amount_millimes - b.commission_millimes) from bookings b join spots s on s.id=b.spot_id
         where s.host_id=$1 and b.status in ('confirmed','checked_in') and b.start_at >= $2::timestamptz - interval '7 days' and b.start_at < $2::timestamptz) as week_host,
       (select sum(b.amount_millimes - b.commission_millimes) from bookings b join spots s on s.id=b.spot_id
         where s.host_id=$1 and b.status in ('confirmed','checked_in') and b.start_at >= $2::timestamptz - interval '30 days' and b.start_at < $2::timestamptz) as month_host,
       (select count(*) from bookings b join spots s on s.id=b.spot_id
         where s.host_id=$1 and b.status in ('confirmed','checked_in') and b.start_at >= $2::timestamptz - interval '30 days' and b.start_at < $2::timestamptz) as month_count,
       (select count(*) from bookings b join spots s on s.id=b.spot_id
         where s.host_id=$1 and b.status = 'confirmed' and b.start_at >= $2::timestamptz) as upcoming,
       (select count(*) from spots where host_id=$1 and active) as spots`,
    [hostId, now.toISOString()],
  );
  const r = rows[0];
  return {
    weekHostMillimes: Number(r.week_host ?? 0),
    monthHostMillimes: Number(r.month_host ?? 0),
    monthBookings: Number(r.month_count),
    upcomingBookings: Number(r.upcoming),
    activeSpots: Number(r.spots),
  };
}

/** A stay can be rated once, by its driver, after it has ended (or after check-in). */
export async function createReview(pool: Pool, driverId: string, bookingId: string, input: { rating: number; comment: string }, now = new Date()) {
  return withTx(pool, async (c) => {
    const { rows } = await c.query<BookingRow>("select * from bookings where id = $1 for update", [bookingId]);
    const b = rows[0];
    if (!b) throw new AppError("not_found", "booking not found");
    if (b.driver_id !== driverId) throw new AppError("forbidden", "not your booking");
    const stayed = b.status === "checked_in" || (b.status === "confirmed" && new Date(b.end_at) <= now);
    if (!stayed) throw new AppError("not_reviewable", "you can rate a spot after your stay");
    try {
      await c.query("insert into reviews (booking_id, spot_id, driver_id, rating, comment) values ($1,$2,$3,$4,$5)", [
        b.id, b.spot_id, driverId, input.rating, input.comment ?? "",
      ]);
    } catch (e) {
      if (pgCode(e) === UNIQUE_VIOLATION) throw new AppError("already_reviewed", "you already rated this stay");
      throw e;
    }
    await c.query("update spots set rating_sum = rating_sum + $2, rating_count = rating_count + 1 where id = $1", [b.spot_id, input.rating]);
    return { rating: input.rating };
  });
}
