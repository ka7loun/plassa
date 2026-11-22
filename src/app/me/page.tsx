"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorText, useApp } from "@/components/AppProvider";
import { Alert, Page, RequireUser, Spinner } from "@/components/Shell";
import { BadgeGrid, Bars, LevelCard, Stat } from "@/components/Game";
import { ReviewForm } from "@/components/ReviewForm";
import { SpotPhoto } from "@/components/SpotThumb";
import { formatPhone } from "@/lib/phone";
import { fmtDay } from "@/lib/format";
import { formatTND } from "@/lib/pricing";
import type { driverDashboard } from "@/server/dashboard";
import type { UserDTO } from "@/server/users";

type Dash = Awaited<ReturnType<typeof driverDashboard>>;

const tnd = (m: number) => `${Math.round(m / 1000)} DT`;

function monthLabel(ym: string, locale: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-TN-u-nu-latn" : locale === "fr" ? "fr-TN" : "en-GB", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 15)));
}

function MeInner() {
  const { t, f, locale } = useApp();
  const [data, setData] = useState<{ user: UserDTO; dashboard: Dash } | null>(null);
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => {
    api<{ user: UserDTO; dashboard: Dash }>("/api/me/dashboard").then(setData, setErr);
  }, []);

  if (err) return <Alert>{errorText(t, err)}</Alert>;
  if (!data) return <Spinner label={t.common.loading} />;
  const { user, dashboard: d } = data;

  const reviewed = (bookingId: string) =>
    setData((cur) => (cur ? { ...cur, dashboard: { ...cur.dashboard, toReview: cur.dashboard.toReview.filter((r) => r.bookingId !== bookingId) } } : cur));

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-bold text-navy">{t.me.title}</h1>
        <p className="num text-sm text-navy-50">
          {user.phone ? `${formatPhone(user.phone)} · ` : ""}
          {f(t.me.memberSince, { d: fmtDay(user.createdAt, locale) })}
        </p>
      </div>

      <LevelCard points={d.points} level={d.level} name={user.name} />
      <p className="text-xs text-navy-50">{t.game.howToEarn}</p>

      <div className="grid grid-cols-2 gap-2">
        <Stat label={t.me.stays} value={d.stays} testId="me-stays" />
        <Stat label={t.me.hours} value={d.hoursParked} />
        <Stat label={t.me.spent} value={formatTND(d.spentMillimes, locale)} />
        <Stat label={t.me.saved} value={f(t.me.savedValue, { h: Math.round(d.minutesSaved / 60) })} />
      </div>

      {d.upcoming > 0 && (
        <Link href="/bookings" className="card flex items-center justify-between p-4 text-sm font-semibold hover:border-blue">
          {t.me.upcoming}
          <span className="num rounded-full bg-blue px-2.5 py-0.5 text-white">{d.upcoming}</span>
        </Link>
      )}

      <section className="card grid gap-3 p-4" data-testid="to-review">
        <h2 className="font-semibold">{t.me.toReview}</h2>
        {d.toReview.length === 0 ? (
          <p className="text-sm text-navy-50">{t.me.allReviewed}</p>
        ) : (
          <ul className="grid gap-4">
            {d.toReview.map((r) => (
              <li key={r.bookingId} className="grid gap-2 border-t border-line pt-3 first:border-0 first:pt-0">
                <Link href={`/spot/${r.spotId}`} className="flex items-center gap-3">
                  <SpotPhoto photos={r.photo ? [r.photo] : []} type="lot" className="h-12 w-12 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{r.title}</span>
                    <span className="num block text-xs text-navy-50">{fmtDay(r.start, locale)}</span>
                  </span>
                </Link>
                <ReviewForm compact bookingId={r.bookingId} onDone={() => reviewed(r.bookingId)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <BadgeGrid badges={d.badges} side="driver" />

      {d.months.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">{t.me.spendTitle}</h2>
          <Bars items={d.months.map((m) => ({ label: monthLabel(m.month, locale), value: m.spentMillimes, display: tnd(m.spentMillimes) }))} testId="spend-chart" />
        </section>
      )}

      {d.favourites.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">{t.me.favourites}</h2>
          <ul className="grid gap-2.5">
            {d.favourites.map((s) => (
              <li key={s.id}>
                <Link href={`/spot/${s.id}`} className="flex items-center gap-3 hover:text-blue">
                  <SpotPhoto photos={s.photo ? [s.photo] : []} type="lot" className="h-12 w-12 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{s.title}</span>
                  <span className="num text-xs text-navy-50">{f(t.me.staysCount, { n: s.stays })}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.hostSpots > 0 ? (
        <>
          <BadgeGrid badges={d.badges} side="host" />
          <Link href="/host" className="btn btn-ghost">
            {t.me.hostSideCta}
          </Link>
        </>
      ) : (
        <section className="card grid gap-2 p-4">
          <h2 className="font-semibold">{t.me.hostSide}</h2>
          <p className="text-sm text-navy-70">{t.me.hostSideNone}</p>
          <Link href="/host/new" className="btn btn-ghost">
            {t.me.hostSideCtaNone}
          </Link>
        </section>
      )}
    </div>
  );
}

export default function MePage() {
  return (
    <Page>
      <RequireUser>
        <MeInner />
      </RequireUser>
    </Page>
  );
}
