"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorText, useApp } from "@/components/AppProvider";
import { Alert, Page, Spinner } from "@/components/Shell";
import { RatingTag, SpotPhoto } from "@/components/SpotThumb";
import { formatTND } from "@/lib/pricing";
import type { SpotDTO } from "@/server/spots";

interface Host {
  id: string;
  name: string;
  stays: number;
  spots: number;
  ratingAvg: number | null;
}

const MEDAL = ["bg-sand text-white", "bg-navy-50 text-white", "bg-[#b9835a] text-white"];

export default function TopPage() {
  const { t, f, locale } = useApp();
  const [data, setData] = useState<{ spots: SpotDTO[]; hosts: Host[] } | null>(null);
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => {
    api<{ spots: SpotDTO[]; hosts: Host[] }>("/api/spots/top").then(setData, setErr);
  }, []);

  return (
    <Page>
      <div className="grid gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">{t.top.title}</h1>
          <p className="mt-1 text-sm text-navy-70">{t.top.sub}</p>
        </div>
        {err ? <Alert>{errorText(t, err)}</Alert> : null}
        {!data && !err && <Spinner label={t.common.loading} />}
        {data && (
          <>
            <ol className="grid gap-2.5" data-testid="top-spots">
              {data.spots.map((s, i) => (
                <li key={s.id}>
                  <Link href={`/spot/${s.id}`} className="card flex items-center gap-3 p-3 hover:border-blue">
                    <span className={`num grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${MEDAL[i] ?? "bg-stone text-navy-70"}`}>{i + 1}</span>
                    <SpotPhoto photos={s.photos} type={s.spotType} className="h-14 w-14 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{s.title}</span>
                      <span className="block truncate text-xs text-navy-50">
                        {s.zoneName ? s.zoneName[locale] : ""} · {formatTND(s.priceMillimes, locale)} {t.common.perHour}
                      </span>
                      <RatingTag avg={s.rating.avg} count={s.rating.count} newLabel={t.find.newSpot} />
                    </span>
                  </Link>
                </li>
              ))}
            </ol>

            <section className="card p-4">
              <h2 className="mb-3 font-semibold">{t.top.hosts}</h2>
              <ol className="grid gap-2.5" data-testid="top-hosts">
                {data.hosts.map((h, i) => (
                  <li key={h.id} className="flex items-center gap-3 text-sm">
                    <span className={`num grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${MEDAL[i] ?? "bg-stone text-navy-70"}`}>{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{h.name}</span>
                      <span className="num block text-xs text-navy-50">
                        {f(t.top.spots, { n: h.spots })}
                        {h.ratingAvg !== null ? ` · ★ ${h.ratingAvg.toFixed(1)}` : ""}
                      </span>
                    </span>
                    <span className="num text-xs font-semibold text-blue">{f(t.top.stays, { n: h.stays })}</span>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}
      </div>
    </Page>
  );
}
