"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorText, useApp } from "@/components/AppProvider";
import { Alert, Page, RequireUser, Spinner } from "@/components/Shell";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtRange } from "@/lib/format";
import { formatTND } from "@/lib/pricing";
import type { BookingDTO } from "@/server/bookings";

function List() {
  const { t, locale } = useApp();
  const [items, setItems] = useState<BookingDTO[] | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [now] = useState(() => Date.now());
  useEffect(() => {
    api<{ bookings: BookingDTO[] }>("/api/bookings").then((r) => setItems(r.bookings), setErr);
  }, []);
  if (err) return <Alert>{errorText(t, err)}</Alert>;
  if (!items) return <Spinner label={t.common.loading} />;
  const upcoming = items.filter((b) => new Date(b.end).getTime() > now && b.status !== "cancelled").reverse();
  const past = items.filter((b) => !upcoming.includes(b));

  const row = (b: BookingDTO) => (
    <li key={b.id}>
      <Link href={`/bookings/${b.id}`} className="card flex items-center justify-between gap-3 p-3.5 hover:border-blue" data-testid="booking-row">
        <div className="min-w-0">
          <p className="truncate font-semibold">{b.spot?.title}</p>
          <p className="num text-xs text-navy-50">{fmtRange(b.start, b.end, locale)}</p>
        </div>
        <div className="grid justify-items-end gap-1">
          <StatusBadge status={b.status} />
          <span className="num text-sm font-semibold">{formatTND(b.amountMillimes, locale)}</span>
        </div>
      </Link>
    </li>
  );

  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-bold">{t.booking.mine}</h1>
      {items.length === 0 && (
        <div className="card grid justify-items-center gap-3 p-8 text-center">
          <p className="text-navy-70">{t.booking.none}</p>
          <Link className="btn btn-primary" href="/find">
            {t.booking.findOne}
          </Link>
        </div>
      )}
      {upcoming.length > 0 && (
        <section className="grid gap-2">
          <h2 className="section-title">{t.booking.upcoming}</h2>
          <ul className="grid grid-cols-1 gap-2">{upcoming.map(row)}</ul>
        </section>
      )}
      {past.length > 0 && (
        <section className="grid gap-2">
          <h2 className="section-title">{t.booking.past}</h2>
          <ul className="grid grid-cols-1 gap-2">{past.map(row)}</ul>
        </section>
      )}
    </div>
  );
}

export default function BookingsPage() {
  return (
    <Page>
      <RequireUser>
        <List />
      </RequireUser>
    </Page>
  );
}
