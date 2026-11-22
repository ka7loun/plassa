"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useApp, type Persona } from "@/components/AppProvider";
import { DemoButtons, LangSwitch, Logo } from "@/components/Shell";
import { Icon } from "@/components/Icon";
import { MapView, type MapMarker } from "@/components/MapView";
import { formatTND } from "@/lib/pricing";
import { suggestedStart, tunisTimeString } from "@/lib/time";
import type { SpotDTO } from "@/server/spots";

const BAB_BHAR: [number, number] = [10.6372, 35.8287];



export default function Landing() {
  const { t, locale, user } = useApp();
  const router = useRouter();
  const [live, setLive] = useState<SpotDTO[]>([]);
  const [heroAt] = useState(() => suggestedStart());

  // The hero is the product itself: free spots around Bab Bhar for the next two hours.
  useEffect(() => {
    const start = heroAt;
    const end = new Date(start.getTime() + 2 * 3_600_000);
    const qs = new URLSearchParams({ lat: String(BAB_BHAR[1]), lng: String(BAB_BHAR[0]), radius: "1200", start: start.toISOString(), end: end.toISOString() });
    fetch(`/api/spots?${qs}`, { headers: { "x-plassa-nolog": "1" } })
      .then((r) => (r.ok ? r.json() : { spots: [] }))
      .then((d: { spots: SpotDTO[] }) => setLive(d.spots))
      .catch(() => {});
  }, [heroAt]);
  const markers: MapMarker[] = useMemo(
    () => live.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, label: s.available ? formatTND(s.quote!.totalMillimes, locale) : "—", off: !s.available })),
    [live, locale],
  );
  const freeNow = live.filter((s) => s.available).length;

  const after: Record<Persona, string> = { driver: "/find", host: "/host", admin: "/city" };

  return (
    <main className="min-h-dvh">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Logo className="h-8" />
        <LangSwitch />
      </div>

      <section className="mx-auto grid max-w-5xl gap-8 px-4 pb-10 pt-4 md:grid-cols-[1.1fr_1fr] md:items-center md:pt-10">
        <div>
                    <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-navy md:text-6xl">{t.landing.hero}</h1>
          <p className="mt-4 max-w-lg text-base text-navy-70 md:text-lg">{t.landing.sub}</p>

          <div className="mt-7 grid gap-3 sm:max-w-md">
            <Link href="/find" data-testid="cta-find" className="btn btn-primary w-full justify-between py-4 text-start text-lg">
              <span>
                <span className="block">{t.landing.findCta}</span>
                <span className="block text-xs font-medium text-white/80">{t.landing.findCtaHint}</span>
              </span>
              <Icon name="forward" className="shrink-0 rtl:rotate-180" />
            </Link>
            <Link href="/host" data-testid="cta-host" className="btn btn-ghost w-full justify-between text-start">
              <span>
                <span className="block">{t.landing.hostCta}</span>
                <span className="block text-xs font-medium text-navy-50">{t.landing.hostCtaHint}</span>
              </span>
              <Icon name="forward" className="shrink-0 rtl:rotate-180" />
            </Link>
            {user ? (
              <Link href="/me" className="text-sm font-semibold text-blue underline-offset-2 hover:underline">
                {user.name} · {t.nav.me}
              </Link>
            ) : (
              <p className="flex gap-4 text-sm font-semibold">
                <Link href="/login" data-testid="landing-login" className="text-blue underline-offset-2 hover:underline">
                  {t.landing.signIn}
                </Link>
                <Link href="/signup" data-testid="landing-signup" className="text-blue underline-offset-2 hover:underline">
                  {t.landing.signUp}
                </Link>
              </p>
            )}
          </div>

          <div className="mt-8 sm:max-w-md">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-50">{t.landing.demoTitle}</p>
            <DemoButtons onDone={(p) => router.push(after[p])} />
          </div>
        </div>

        <div className="relative">
          <div className="card overflow-hidden p-0">
            <div className="relative">
              <MapView center={BAB_BHAR} zoom={15.3} markers={markers} className="h-80 rounded-none border-0 md:h-96" testId="hero-map" />
              {live.length > 0 && (
                <p className="num pointer-events-none absolute bottom-3 start-3 rounded-full bg-navy px-3 py-1.5 text-xs font-semibold text-white shadow-[0_4px_14px_rgb(15_26_46/0.25)]">
                  Bab Bhar {heroAt ? tunisTimeString(heroAt) : ""}: {freeNow}/{live.length}
                </p>
              )}
            </div>
            <ol className="grid gap-4 p-5 text-sm">
              {[
                [t.landing.how1, t.landing.how1d],
                [t.landing.how2, t.landing.how2d],
                [t.landing.how3, t.landing.how3d],
              ].map(([h, d], i) => (
                <li key={i} className="flex gap-3">
                  <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 font-bold text-blue">{i + 1}</span>
                  <span>
                    <span className="block font-semibold">{h}</span>
                    <span className="text-navy-70">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-5xl px-4 pb-8 text-xs text-navy-50">
        {t.common.demoData} Map data © OpenStreetMap contributors, © CARTO.
      </footer>
    </main>
  );
}
