"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { api, ApiError, errorText, useApp } from "@/components/AppProvider";
import { MapView } from "@/components/MapView";
import { Alert, Page, Spinner } from "@/components/Shell";
import { RatingTag, SpotThumb } from "@/components/SpotThumb";
import { Icon } from "@/components/Icon";
import { WhenPicker, whenToRange, type When } from "@/components/WhenPicker";
import { fmtDay, fmtMinutes, fmtRange } from "@/lib/format";
import { formatTND } from "@/lib/pricing";
import { suggestedStart, tunisDateString, tunisTimeString } from "@/lib/time";
import type { PaymentMethod } from "@/lib/payments";
import type { ReviewDTO, SpotDTO } from "@/server/spots";

function Stars({ n }: { n: number }) {
  return (
    <span className="text-sm tracking-tight text-sand" aria-label={`${n}/5`}>
      {"★★★★★".slice(0, n)}
      <span className="text-line">{"★★★★★".slice(n)}</span>
    </span>
  );
}

function Gallery({ photos, type, title }: { photos: string[]; type: string; title: string }) {
  const [i, setI] = useState(0);
  if (!photos.length) return <SpotThumb type={type} className="aspect-[4/3] w-full" />;
  return (
    <div className="grid gap-2" data-testid="gallery">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photos[i]} alt={title} className="aspect-[4/3] w-full rounded-2xl bg-blue-50 object-cover" />
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {photos.map((p, k) => (
            <button key={p} onClick={() => setI(k)} aria-pressed={i === k} aria-label={`${k + 1}/${photos.length}`} className={`shrink-0 rounded-lg border-2 ${i === k ? "border-blue" : "border-transparent"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.startsWith("/spots/") ? p.replace(/.jpg$/, "-sm.jpg") : p} alt="" className="h-14 w-20 rounded-md object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SpotInner() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const { t, f, locale, user } = useApp();

  const [when, setWhen] = useState<When>(() => {
    const s = sp.get("start");
    const e = sp.get("end");
    const start = s ? new Date(s) : suggestedStart();
    const hours = s && e ? Math.max(1, Math.round((new Date(e).getTime() - start.getTime()) / 3_600_000)) : 2;
    return { date: tunisDateString(start), time: tunisTimeString(start), hours };
  });
  const range = useMemo(() => whenToRange(when), [when]);
  const [spot, setSpot] = useState<SpotDTO | null>(null);
  const [reviews, setReviews] = useState<ReviewDTO[]>([]);
  const [loadErr, setLoadErr] = useState<unknown>(null);
  const [picked, setPicked] = useState<PaymentMethod | null>(null);
  const [plate, setPlate] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => {
    let live = true;
    api<{ spot: SpotDTO; reviews: ReviewDTO[] }>(`/api/spots/${id}?start=${encodeURIComponent(range.start.toISOString())}&end=${encodeURIComponent(range.end.toISOString())}`)
      .then((r) => {
        if (!live) return;
        setSpot(r.spot);
        setReviews(r.reviews);
      })
      .catch((e) => live && setLoadErr(e));
    return () => {
      live = false;
    };
  }, [id, range]);

  const book = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (!user) {
        router.push(`/login?next=${encodeURIComponent(`/spot/${id}?start=${range.start.toISOString()}&end=${range.end.toISOString()}`)}`);
        return;
      }
      const r = await api<{ booking: { id: string }; redirectUrl: string | null }>("/api/bookings", {
        method: "POST",
        json: { spotId: id, start: range.start.toISOString(), end: range.end.toISOString(), paymentMethod: method, plate: plate || undefined },
      });
      router.push(r.redirectUrl ?? `/bookings/${r.booking.id}?new=1`);
    } catch (e) {
      setErr(e);
      if (e instanceof ApiError && e.code === "slot_taken") setSpot((s) => (s ? { ...s, available: false, unavailableReason: "booked" } : s));
      setBusy(false);
    }
  };

  if (loadErr) return <Alert>{errorText(t, loadErr)}</Alert>;
  if (!spot) return <Spinner label={t.common.loading} />;

  const q = spot.quote!;
  // the host decides which payment methods drivers see on this spot
  const methods = spot.paymentMethods;
  const method = picked && methods.includes(picked) ? picked : methods[0];
  const own = user?.id === spot.hostId;
  const typeLabel = t.spot.type[spot.spotType as keyof typeof t.spot.type];
  const hours = spot.availStartMin === 0 && spot.availEndMin === 1440 ? t.spot.allDay : `${fmtMinutes(spot.availStartMin)}–${fmtMinutes(spot.availEndMin)}`;

  return (
    <div className="grid gap-4">
      <button className="flex min-h-11 w-fit items-center gap-1 text-sm font-semibold text-blue" onClick={() => router.back()}>
        <Icon name="back" size={18} className="rtl:rotate-180" /> {t.common.back}
      </button>

      <Gallery photos={spot.photos} type={spot.spotType} title={spot.title} />

      <div className="card flex gap-4 p-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight" data-testid="spot-title">
            {spot.title}
          </h1>
          <RatingTag avg={spot.rating.avg} count={spot.rating.count} newLabel={t.find.newSpot} className="mt-1" />
          <p className="text-sm text-navy-50">{spot.address}</p>
          <p className="mt-1 text-xs font-semibold text-navy-70">
            {typeLabel}
            {spot.covered ? ` · ${t.spot.covered}` : ""} · {t.spot.open} {spot.availDays.length === 7 ? "" : spot.availDays.map((d) => t.common.days[d]).join(" ")} {hours}
          </p>
        </div>
      </div>

      {spot.privateAttested && (
        <div className="flex items-start gap-3 rounded-2xl bg-ok-50 p-3.5 text-sm text-ok" data-testid="private-badge">
          <Icon name="shield" className="mt-0.5 shrink-0" />
          <span>
            <span className="block font-semibold">{t.spot.privateBadge}</span>
            <span className="opacity-80">{t.spot.privateNote}</span>
          </span>
        </div>
      )}

      {spot.description && <p className="text-sm text-navy-70">{spot.description}</p>}

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="card p-3">
          <p className="text-xs text-navy-50">{t.spot.host}</p>
          <p className="font-semibold">{spot.hostName}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-navy-50">{t.spot.gardien}</p>
          <p className="font-semibold">{spot.gardienName ?? "—"}</p>
        </div>
      </div>

      <section className="card grid gap-3 p-4" data-testid="reviews">
        <h2 className="flex items-center justify-between font-semibold">
          {t.spot.reviewsTitle}
          {spot.rating.avg !== null && <span className="num text-sm text-navy-70">{f(t.spot.ratingOutOf, { avg: spot.rating.avg.toFixed(1) })}</span>}
        </h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-navy-50">{t.spot.noReviews}</p>
        ) : (
          <ul className="grid gap-3">
            {reviews.map((r) => (
              <li key={r.id} className="grid gap-0.5 border-t border-line pt-3 first:border-0 first:pt-0">
                <p className="flex items-center gap-2 text-sm">
                  <Stars n={r.rating} />
                  <span className="font-semibold">{r.driverName}</span>
                  <span className="num ms-auto text-xs text-navy-50">{fmtDay(r.createdAt, locale)}</span>
                </p>
                {r.comment && <p className="text-sm text-navy-70">{r.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <MapView center={[spot.lng, spot.lat]} zoom={16} markers={[{ id: spot.id, lat: spot.lat, lng: spot.lng, label: "P", selected: true }]} className="h-44" />

      <section className="card grid gap-3 p-4">
        <h2 className="font-semibold">{t.spot.yourSlot}</h2>
        <WhenPicker value={when} onChange={setWhen} />
        <p className="num text-sm text-navy-70">{fmtRange(range.start.toISOString(), range.end.toISOString(), locale)}</p>

        <div className="grid gap-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between">
            <span>
              {t.spot.price}: {formatTND(spot.priceMillimes, locale)} {t.common.perHour}
            </span>
            <span className="num">{formatTND(q.baseMillimes, locale)}</span>
          </div>
          {spot.peakMultiplier > 1 && spot.peakStartHour != null && (
            <p className="text-xs text-warn">
              {f(t.spot.peak, { m: spot.peakMultiplier, a: spot.peakStartHour, b: spot.peakEndHour ?? 24 })} {spot.peakMonths.length ? t.spot.peakSummer : ""}
              {q.peakSlots > 0 ? `, ${f(t.spot.peakIncluded, { n: q.peakSlots })}` : ""}
            </p>
          )}
          <div className="flex justify-between text-base font-bold">
            <span>{t.spot.total}</span>
            <span className="num text-blue" data-testid="total">
              {formatTND(q.totalMillimes, locale)}
            </span>
          </div>
          <p className="text-xs text-navy-50">{f(t.spot.hostGets, { v: formatTND(q.hostMillimes, locale) })}</p>
        </div>
      </section>

      <section className="card grid gap-3 p-4">
        <div>
          <label className="label" htmlFor="plate">
            {t.spot.plate}
          </label>
          <input id="plate" className="input num" placeholder={t.spot.platePh} value={plate} maxLength={20} onChange={(e) => setPlate(e.target.value)} />
        </div>
        <fieldset>
          <legend className="label">{t.spot.pay}</legend>
          <div className="grid grid-cols-2 gap-2">
            {methods.map((m) => (
              <label key={m} className={`cursor-pointer rounded-xl border p-3 text-sm ${method === m ? "border-blue bg-blue-50" : "border-line bg-white"}`}>
                <input type="radio" name="method" value={m} checked={method === m} onChange={() => setPicked(m)} className="sr-only" data-testid={`pay-${m}`} />
                <span className="block font-semibold">{t.spot.method[m]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {err ? <Alert>{err instanceof ApiError && err.code === "slot_taken" ? t.spot.taken : errorText(t, err)}</Alert> : null}
        {!spot.available && !err && <Alert kind="info">{spot.unavailableReason === "closed" ? t.spot.closedMsg : t.spot.unavailable}</Alert>}

        {own && <Alert kind="info">{t.spot.ownSpot}</Alert>}
        <button className="btn btn-primary w-full py-4 text-lg" disabled={busy || !spot.available || own} onClick={book} data-testid="book">
          {!spot.available ? t.spot.unavailable : user ? f(t.spot.book, { v: formatTND(q.totalMillimes, locale) }) : t.spot.signInToBook}
        </button>
      </section>
    </div>
  );
}

export default function SpotPage() {
  return (
    <Page>
      <Suspense fallback={<Spinner />}>
        <SpotInner />
      </Suspense>
    </Page>
  );
}
