"use client";

import { useEffect, useState } from "react";
import { api, errorText, useApp } from "@/components/AppProvider";
import { MapView } from "@/components/MapView";
import { Alert, Page, RequireUser } from "@/components/Shell";
import { fmtNumber } from "@/lib/format";
import { formatTND } from "@/lib/pricing";

interface Stats {
  totals: {
    activeSpots: number;
    hosts: number;
    bookings: number;
    gmvMillimes: number;
    bookedHours: number;
    searches: number;
    unmetSearchShare: number;
    circlingMinutesSaved: number;
    assumedCirclingMinPerBooking: number;
  };
  zones: { id: string; name: { fr: string; ar: string; en: string }; spots: number; searches: number; bookings: number; unmetShare: number; pressure: number }[];
  hourly: { hour: number; searches: number }[];
  daily: { day: string; bookings: number; gmvMillimes: number }[];
  heat: [number, number][];
}

function Bars({ values, labels, label, highlight }: { values: number[]; labels: string[]; label: string; highlight?: (i: number) => boolean }) {
  const max = Math.max(1, ...values);
  return (
    <figure>
      <div className="flex h-36 items-end gap-[3px]" role="img" aria-label={label} dir="ltr">
        {values.map((v, i) => (
          <div key={i} className="group relative flex-1">
            <div className={`w-full rounded-t-[4px] ${highlight?.(i) ? "bg-blue" : "bg-[#b9c6ff]"}`} style={{ height: `${Math.max(2, (v / max) * 136)}px` }} />
            <span className="num pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 rounded bg-navy px-1.5 py-0.5 text-[10px] text-white group-hover:block">{v}</span>
          </div>
        ))}
      </div>
      <div className="num mt-1 flex justify-between text-[10px] text-navy-50" dir="ltr">
        {labels.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
    </figure>
  );
}

function Dashboard() {
  const { t, f, locale } = useApp();
  const [s, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => {
    api<Stats>("/api/admin/stats").then(setStats, setErr);
  }, []);

  if (err) return <Alert>{errorText(t, err)}</Alert>;

  const center: [number, number] = [10.622, 35.848];
  const peakHour = s ? s.hourly.reduce((a, b) => (b.searches > a.searches ? b : a)).hour : -1;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t.city.title}</h1>
          <p className="text-sm text-navy-50">{t.city.sub}</p>
        </div>
      </div>

      {!s ? (
        <div className="grid gap-3" aria-busy="true">
          <div className="skeleton h-24" />
          <div className="skeleton h-80" />
        </div>
      ) : (
        <>
          <dl className="card grid grid-cols-2 sm:grid-cols-4" data-testid="city-kpis">
            {[
              [t.city.bookings, fmtNumber(s.totals.bookings, locale)],
              [t.city.spots, `${s.totals.activeSpots}`],
              [t.city.unmet, `${fmtNumber(s.totals.unmetSearchShare * 100, locale)} %`],
              [t.city.gmv, formatTND(s.totals.gmvMillimes, locale)],
            ].map(([k, v], i) => (
              <div key={k} className={`p-4 ${i % 2 ? "border-s border-line" : ""} ${i > 1 ? "border-t border-line sm:border-t-0" : ""} ${i === 2 ? "sm:border-s" : ""}`}>
                <dt className="text-xs font-semibold text-navy-50">{k}</dt>
                <dd className="num mt-1 text-xl font-bold">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="rounded-[18px] bg-navy p-5 text-white">
            <p className="text-sm text-white/75">{t.city.saved}</p>
            <p className="num mt-1 text-4xl font-bold">
              {fmtNumber(Math.round(s.totals.circlingMinutesSaved / 60), locale)} h
            </p>
            <p className="mt-2 max-w-prose text-xs text-white/75">{f(t.city.savedNote, { n: s.totals.bookings, m: s.totals.assumedCirclingMinPerBooking })}</p>
          </div>

          <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <div className="grid gap-2">
              <h2 className="section-title">{t.city.heat}</h2>
              <MapView center={center} zoom={12.6} heat={s.heat} className="h-80" testId="heat-map" />
            </div>
            <div className="grid content-start gap-2">
              <h2 className="section-title">{t.city.zones}</h2>
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-stone text-start text-xs text-navy-50">
                    <tr>
                      <th className="p-2.5 text-start font-semibold">{t.city.zone}</th>
                      <th className="p-2.5 text-end font-semibold">{t.city.spots}</th>
                      <th className="p-2.5 text-end font-semibold">{t.city.pressure}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.zones.map((z, i) => (
                      <tr key={z.id} className="border-t border-line">
                        <td className="p-2.5 font-semibold">{z.name[locale]}</td>
                        <td className="num p-2.5 text-end">{z.spots}</td>
                        <td className="p-2.5 text-end">
                          <span className={`num inline-block min-w-12 rounded-full px-2 py-0.5 text-center text-xs font-bold ${i === 0 ? "bg-err-50 text-err" : z.pressure > 1.5 ? "bg-sand-100 text-[#8a5a2b]" : "bg-ok-50 text-ok"}`}>
                            {fmtNumber(z.pressure, locale, 1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="card p-4">
              <h2 className="section-title mb-3">{t.city.searchesByHour}</h2>
              <Bars values={s.hourly.map((h) => h.searches)} labels={["0h", "6h", "12h", "18h", "23h"]} label={t.city.searchesByHour} highlight={(i) => i === peakHour} />
            </div>
            <div className="card p-4">
              <h2 className="section-title mb-3">{t.city.daily}</h2>
              <Bars values={s.daily.map((d) => d.bookings)} labels={[s.daily[0]?.day.slice(5) ?? "", s.daily.at(-1)?.day.slice(5) ?? ""]} label={t.city.daily} />
              <p className="num mt-2 text-xs text-navy-50">
                {fmtNumber(s.totals.bookedHours, locale)} {t.city.hours}
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default function CityPage() {
  return (
    <Page wide>
      <RequireUser admin>
        <Dashboard />
      </RequireUser>
    </Page>
  );
}
