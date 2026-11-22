"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, errorText, useApp } from "@/components/AppProvider";
import { Alert, Page, RequireRole, Spinner } from "@/components/Shell";
import { SpotThumb } from "@/components/SpotThumb";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtMinutes, fmtRange } from "@/lib/format";
import { formatTND } from "@/lib/pricing";
import type { BookingDTO } from "@/server/bookings";
import type { SpotDTO } from "@/server/spots";

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
  const [spots, setSpots] = useState<SpotDTO[] | null>(null);
  const [bookings, setBookings] = useState<BookingDTO[] | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [code, setCode] = useState("");
  const [checkMsg, setCheckMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [now] = useState(() => Date.now());

  const load = useCallback(() => {
    let on = true;
    Promise.all([
      api<{ summary: Summary }>("/api/host/summary"),
      api<{ spots: SpotDTO[] }>("/api/host/spots"),
      api<{ bookings: BookingDTO[] }>("/api/host/bookings"),
    ]).then(
      ([s, sp, b]) => {
        if (!on) return;
        setSummary(s.summary);
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

  const toggle = async (s: SpotDTO) => {
    const r = await api<{ spot: SpotDTO }>(`/api/host/spots/${s.id}`, { method: "PATCH", json: { active: !s.active } });
    setSpots((xs) => xs?.map((x) => (x.id === s.id ? r.spot : x)) ?? null);
  };

  if (err) return <Alert>{errorText(t, err)}</Alert>;
  if (!summary || !spots || !bookings) return <Spinner label={t.common.loading} />;

  const upcoming = bookings.filter((b) => new Date(b.end).getTime() > now && b.status !== "cancelled");

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.host.title}</h1>
        <Link href="/host/new" className="btn btn-primary py-2.5 text-sm" data-testid="add-spot">
          + {t.host.add}
        </Link>
      </div>

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

      <section className="grid gap-2">
        <h2 className="section-title">
          {t.host.spots} ({spots.length})
        </h2>
        <ul className="grid grid-cols-1 gap-2" data-testid="host-spots">
          {spots.map((s) => (
            <li key={s.id} className={`card flex items-center gap-3 p-3 ${s.active ? "" : "opacity-60"}`}>
              <SpotThumb type={s.spotType} className="h-12 w-12 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{s.title}</p>
                <p className="num text-xs text-navy-50">
                  {formatTND(s.priceMillimes, locale)} {t.common.perHour}, {fmtMinutes(s.availStartMin)}–{fmtMinutes(s.availEndMin)}
                </p>
              </div>
              <button className={`chip ${s.active ? "" : ""}`} aria-pressed={s.active} onClick={() => toggle(s)}>
                {s.active ? t.host.active : t.host.paused}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function HostPage() {
  return (
    <Page>
      <RequireRole role="host">
        <Dashboard />
      </RequireRole>
    </Page>
  );
}
