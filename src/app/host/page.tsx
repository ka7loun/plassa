"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, errorText, useApp } from "@/components/AppProvider";
import { Alert, Page, RequireUser, Spinner } from "@/components/Shell";
import { BadgeGrid, Bars, LevelCard, Stat } from "@/components/Game";
import { RatingTag, SpotPhoto } from "@/components/SpotThumb";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtMinutes, fmtRange } from "@/lib/format";
import { formatTND } from "@/lib/pricing";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/payments";
import type { BookingDTO } from "@/server/bookings";
import type { hostDashboard } from "@/server/dashboard";
import type { SpotDTO } from "@/server/spots";

type Dash = Awaited<ReturnType<typeof hostDashboard>>;

interface Summary {
  weekHostMillimes: number;
  monthHostMillimes: number;
  monthBookings: number;
  upcomingBookings: number;
  activeSpots: number;
}

function Dashboard() {
  const { t, f, locale } = useApp();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [dash, setDash] = useState<Dash | null>(null);
  const [spots, setSpots] = useState<SpotDTO[] | null>(null);
  const [bookings, setBookings] = useState<BookingDTO[] | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [code, setCode] = useState("");
  const [checkMsg, setCheckMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [now] = useState(() => Date.now());

  const load = useCallback(() => {
    let on = true;
    Promise.all([
      api<{ summary: Summary; dashboard: Dash }>("/api/host/dashboard"),
      api<{ spots: SpotDTO[] }>("/api/host/spots"),
      api<{ bookings: BookingDTO[] }>("/api/host/bookings"),
    ]).then(
      ([d, sp, b]) => {
        if (!on) return;
        setSummary(d.summary);
        setDash(d.dashboard);
        setSpots(sp.spots);
        setBookings(b.bookings);
      },
      (e) => on && setErr(e),
    );
    return () => {
      on = false;
    };
  }, []);

  useEffect(() => load(), [load]);

  const checkin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckMsg(null);
    try {
      const r = await api<{ booking: BookingDTO }>("/api/host/checkin", { method: "POST", json: { code } });
      setCheckMsg({ ok: true, text: f(t.host.checkinOk, { name: r.booking.driverName ?? "", plate: r.booking.plate ?? "—" }) });
      setCode("");
      load();
    } catch {
      setCheckMsg({ ok: false, text: t.host.checkinFail });
    }
  };

  const patch = async (s: SpotDTO, body: { active?: boolean; paymentMethods?: PaymentMethod[] }) => {
    try {
      const r = await api<{ spot: SpotDTO }>(`/api/host/spots/${s.id}`, { method: "PATCH", json: body });
      setSpots((xs) => xs?.map((x) => (x.id === s.id ? { ...x, ...r.spot } : x)) ?? null);
    } catch (e) {
      setErr(e);
    }
  };

  const toggleMethod = (s: SpotDTO, m: PaymentMethod) => {
    const on = s.paymentMethods.includes(m);
    if (on && s.paymentMethods.length === 1) return; // drivers need at least one way to pay
    const next = PAYMENT_METHODS.filter((x) => (x === m ? !on : s.paymentMethods.includes(x)));
    void patch(s, { paymentMethods: next });
  };

  if (err && !spots) return <Alert>{errorText(t, err)}</Alert>;
  if (!summary || !dash || !spots || !bookings) return <Spinner label={t.common.loading} />;

  const upcoming = bookings.filter((b) => new Date(b.end).getTime() > now && b.status !== "cancelled");
  const mixTotal = dash.paymentMix.reduce((a, x) => a + x.bookings, 0);

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.host.title}</h1>
        <Link href="/host/new" className="btn btn-primary py-2.5 text-sm" data-testid="add-spot">
          + {t.host.add}
        </Link>
      </div>
      {err ? <Alert>{errorText(t, err)}</Alert> : null}

      {spots.length === 0 && (
        <div className="card grid gap-2 p-5 text-center" data-testid="host-empty">
          <p className="font-semibold">{t.host.noSpotsYet}</p>
          <p className="text-sm text-navy-70">{t.host.noSpotsCta}</p>
          <Link href="/host/new" className="btn btn-primary mt-1">
            {t.host.add}
          </Link>
        </div>
      )}

      <LevelCard points={dash.points} level={dash.level} />

      <div className="card grid grid-cols-3 divide-x divide-line rtl:divide-x-reverse" data-testid="host-summary">
        {[
          [t.host.week, formatTND(summary.weekHostMillimes, locale)],
          [t.host.month, formatTND(summary.monthHostMillimes, locale)],
          [t.host.monthBookings, String(summary.monthBookings)],
        ].map(([k, v]) => (
          <div key={k} className="p-3.5">
            <p className="text-[11px] font-semibold leading-tight text-navy-50">{k}</p>
            <p className="num mt-1 text-lg font-bold text-navy">{v}</p>
          </div>
        ))}
      </div>
      <p className="-mt-3 text-xs text-navy-50">{t.host.earningsNote}</p>

      {spots.length > 0 && (
        <>
          <section className="card p-4">
            <h2 className="mb-3 font-semibold">{t.host.earnings8w}</h2>
            <Bars
              testId="earnings-chart"
              // skip empty weeks before the host's first booking (keep at least 4 bars)
              items={dash.weeks.slice(Math.min(4, Math.max(0, dash.weeks.findIndex((w) => w.earnedMillimes > 0)))).map((w) => ({
                label: w.weeksAgo === 0 ? t.host.thisWeek : f(t.host.weeksAgo, { n: w.weeksAgo }),
                value: w.earnedMillimes,
                display: String(Math.round(w.earnedMillimes / 1000)),
              }))}
            />
          </section>

          <div className="grid grid-cols-3 gap-2">
            <Stat label={t.host.hours30} value={dash.bookedHours30d} />
            <Stat label={t.host.ratingLabel} value={dash.rating.avg !== null ? `★ ${dash.rating.avg.toFixed(1)}` : "—"} />
            <Stat label={t.host.rankLabel} value={dash.rank ? f(t.host.rankValue, { p: dash.rank.position, n: dash.rank.of }) : "—"} testId="host-rank" />
          </div>
        </>
      )}

      <form onSubmit={checkin} className="card grid gap-2 p-4">
        <label className="label" htmlFor="code">
          {t.host.checkin}
        </label>
        <div className="flex gap-2">
          <input
            id="code"
            className="input num text-center text-xl tracking-[0.3em]"
            inputMode="numeric"
            maxLength={4}
            pattern="\d{4}"
            placeholder="0000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            dir="ltr"
            data-testid="checkin-input"
          />
          <button className="btn btn-primary" disabled={code.length !== 4}>
            {t.host.checkinBtn}
          </button>
        </div>
        {checkMsg && <Alert kind={checkMsg.ok ? "ok" : "err"}>{checkMsg.text}</Alert>}
      </form>

      <section className="grid gap-2">
        <h2 className="section-title">
          {t.host.upcoming} ({upcoming.length})
        </h2>
        {upcoming.length === 0 && <p className="text-sm text-navy-50">{t.host.noBookings}</p>}
        <ul className="grid grid-cols-1 gap-2" data-testid="host-bookings">
          {upcoming.map((b) => (
            <li key={b.id} className="card flex items-center justify-between gap-3 p-3.5">
              <div className="min-w-0">
                <p className="truncate font-semibold">{b.spot?.title}</p>
                <p className="num text-xs text-navy-50">
                  {fmtRange(b.start, b.end, locale)}, {b.driverName}
                  {b.plate ? `, ${b.plate}` : ""}
                </p>
              </div>
              <div className="grid justify-items-end gap-1">
                <StatusBadge status={b.status} />
                <span className="num text-sm font-semibold text-ok">+{formatTND(b.hostMillimes, locale)}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {spots.length > 0 && (
        <section className="grid gap-2">
          <h2 className="section-title">
            {t.host.spots} ({spots.length})
          </h2>
          <ul className="grid grid-cols-1 gap-2" data-testid="host-spots">
            {spots.map((s) => (
              <li key={s.id} className="card grid gap-3 p-3" data-testid="host-spot">
                <div className={`flex items-center gap-3 ${s.active ? "" : "opacity-60"}`}>
                  <SpotPhoto photos={s.photos} type={s.spotType} className="h-14 w-14 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/spot/${s.id}`} className="block truncate font-semibold hover:text-blue">
                      {s.title}
                    </Link>
                    <p className="num text-xs text-navy-50">
                      {formatTND(s.priceMillimes, locale)} {t.common.perHour}, {fmtMinutes(s.availStartMin)}–{fmtMinutes(s.availEndMin)}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-navy-50">
                      <RatingTag avg={s.rating.avg} count={s.rating.count} newLabel={t.find.newSpot} />
                      {s.bookings30d !== undefined && <span className="num">{f(t.host.bookings30, { n: s.bookings30d })}</span>}
                    </p>
                  </div>
                  <button className="chip shrink-0" aria-pressed={s.active} onClick={() => patch(s, { active: !s.active })}>
                    {s.active ? t.host.active : t.host.paused}
                  </button>
                </div>
                <div className="border-t border-line pt-2.5">
                  <p className="text-xs font-semibold text-navy-70">{t.host.methodsTitle}</p>
                  <p className="mb-1.5 text-[11px] text-navy-50">{t.host.methodsHint}</p>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={t.host.methodsTitle}>
                    {PAYMENT_METHODS.map((m) => {
                      const on = s.paymentMethods.includes(m);
                      return (
                        <button
                          key={m}
                          className="chip"
                          aria-pressed={on}
                          disabled={on && s.paymentMethods.length === 1}
                          onClick={() => toggleMethod(s, m)}
                          data-testid={`method-${m}`}
                        >
                          {t.spot.method[m]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {mixTotal > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 font-semibold">{t.host.paymentMix}</h2>
          <ul className="grid gap-1.5 text-sm">
            {dash.paymentMix.map((m) => {
              const pct = Math.round((m.bookings / mixTotal) * 100);
              return (
                <li key={m.method} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2">
                  <span className="truncate">{t.spot.method[m.method as PaymentMethod] ?? m.method}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-stone">
                    <span className="block h-full rounded-full bg-blue" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="num text-end text-xs text-navy-70">{pct}%</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {dash.reviews.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 font-semibold">{t.host.latestReviews}</h2>
          <ul className="grid gap-3">
            {dash.reviews.map((r) => (
              <li key={r.id} className="grid gap-0.5 border-t border-line pt-3 text-sm first:border-0 first:pt-0">
                <p className="flex items-center gap-2">
                  <span className="text-sand" aria-label={`${r.rating}/5`}>
                    {"★".repeat(r.rating)}
                  </span>
                  <span className="font-semibold">{r.driverName}</span>
                  <span className="min-w-0 truncate text-xs text-navy-50">{r.spotTitle}</span>
                </p>
                {r.comment && <p className="text-navy-70">{r.comment}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <BadgeGrid badges={dash.badges} side="host" />
    </div>
  );
}

export default function HostPage() {
  return (
    <Page>
      <RequireUser>
        <Dashboard />
      </RequireUser>
    </Page>
  );
}
