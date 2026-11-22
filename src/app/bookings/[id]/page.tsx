"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api, errorText, useApp } from "@/components/AppProvider";
import { MapView } from "@/components/MapView";
import { Alert, Page, RequireUser, Spinner } from "@/components/Shell";
import { StatusBadge } from "@/components/StatusBadge";
import { Icon } from "@/components/Icon";
import { ReviewForm } from "@/components/ReviewForm";
import { fmtRange } from "@/lib/format";
import { formatTND } from "@/lib/pricing";
import type { BookingDTO } from "@/server/bookings";

function BookingInner() {
  const { id } = useParams<{ id: string }>();
  const isNew = useSearchParams().get("new") === "1";
  const { t, f, locale, user } = useApp();
  const [b, setB] = useState<BookingDTO | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ booking: BookingDTO }>(`/api/bookings/${id}`).then((r) => setB(r.booking), setErr);
  }, [id]);

  const cancel = async () => {
    if (!confirm(t.booking.cancelConfirm)) return;
    setBusy(true);
    try {
      const r = await api<{ booking: BookingDTO; refunded: boolean }>(`/api/bookings/${id}/cancel`, { method: "POST" });
      setB(r.booking);
      setMsg(r.refunded ? t.booking.refunded : t.booking.cancelledCash);
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  if (err && !b) return <Alert>{errorText(t, err)}</Alert>;
  if (!b) return <Spinner label={t.common.loading} />;

  const s = b.spot!;
  const gmaps = `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`;
  const waze = `https://waze.com/ul?ll=${s.lat},${s.lng}&navigate=yes`;
  const share = `https://wa.me/?text=${encodeURIComponent(`Plassa · ${s.title} · ${fmtRange(b.start, b.end, locale)} · ${gmaps}`)}`;
  const live = b.status === "confirmed" || b.status === "pending_payment";
  const stayed = b.status === "checked_in" || (b.status === "confirmed" && new Date(b.end) <= new Date());
  const canRate = stayed && b.driverId === user?.id;

  return (
    <div className="grid gap-4">
      {isNew && b.status === "confirmed" && (
        <div className="rounded-2xl bg-blue p-4 text-white" data-testid="confirmed">
          <p className="text-lg font-bold">{t.booking.confirmed}</p>
        </div>
      )}
      {msg && <Alert kind="ok">{msg}</Alert>}
      {err ? <Alert>{errorText(t, err)}</Alert> : null}

      <div className="card grid gap-1 p-4">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-xl font-bold">{s.title}</h1>
          <StatusBadge status={b.status} />
        </div>
        <p className="text-sm text-navy-50">{s.address}</p>
        <p className="num mt-1 font-semibold">{fmtRange(b.start, b.end, locale)}</p>
      </div>

      {(b.status === "confirmed" || b.status === "checked_in") && (
        <div className="card grid justify-items-center gap-1 p-5 text-center">
          <p className="text-sm font-semibold text-navy-70">{t.booking.code}</p>
          <p className="num text-5xl font-bold tracking-[0.25em] text-navy" data-testid="checkin-code" dir="ltr">
            {b.checkinCode}
          </p>
          <p className="max-w-xs text-xs text-navy-50">{t.booking.codeHint}</p>
          {s.gardienName && (
            <p className="mt-2 text-sm">
              {t.spot.gardien}: <span className="font-semibold">{s.gardienName}</span>{" "}
              {s.gardienPhone && (
                <a className="num text-blue underline" href={`tel:${s.gardienPhone.replace(/\s/g, "")}`} dir="ltr">
                  {s.gardienPhone}
                </a>
              )}
            </p>
          )}
        </div>
      )}

      {canRate && (
        <div className="card p-4">
          {b.myRating ? (
            <p className="text-sm font-semibold text-ok" data-testid="rated">
              {f(t.booking.rated, { r: b.myRating })}
            </p>
          ) : (
            <ReviewForm bookingId={b.id} onDone={(r) => setB({ ...b, myRating: r })} />
          )}
        </div>
      )}

      <div className="card grid gap-1 p-4 text-sm">
        <div className="flex justify-between font-semibold">
          <span>{t.spot.total}</span>
          <span className="num">{formatTND(b.amountMillimes, locale)}</span>
        </div>
        <p className="text-navy-50">
          {b.paymentMethod === "cash" ? f(t.booking.payAtSpot, { v: formatTND(b.amountMillimes, locale) }) : f(t.booking.paidBy, { m: t.spot.method[b.paymentMethod] })}
          {b.plate ? `, ${b.plate}` : ""}
        </p>
      </div>

      <MapView center={[s.lng, s.lat]} zoom={16} markers={[{ id: b.spotId, lat: s.lat, lng: s.lng, label: "P", selected: true }]} className="h-44" />

      <div className="grid grid-cols-2 gap-2">
        <a className="btn btn-primary" href={gmaps} target="_blank" rel="noreferrer">
          <Icon name="navigate" size={18} /> Google Maps
        </a>
        <a className="btn btn-ghost" href={waze} target="_blank" rel="noreferrer">
          Waze
        </a>
        <a className="btn btn-ghost col-span-2" href={share} target="_blank" rel="noreferrer">
          <Icon name="share" size={18} /> {t.booking.share}
        </a>
        {live && new Date(b.start) > new Date() && (
          <button className="btn btn-danger col-span-2" onClick={cancel} disabled={busy} data-testid="cancel">
            {t.booking.cancelBtn}
          </button>
        )}
      </div>
      <Link href="/bookings" className="text-center text-sm font-semibold text-blue">
        {t.booking.mine}
      </Link>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Page>
      <RequireUser>
        <Suspense fallback={<Spinner />}>
          <BookingInner />
        </Suspense>
      </RequireUser>
    </Page>
  );
}
