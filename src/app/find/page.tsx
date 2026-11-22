"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, errorText, useApp } from "@/components/AppProvider";
import { MapView, type MapMarker } from "@/components/MapView";
import { Alert, Page } from "@/components/Shell";
import { RatingTag, SpotPhoto } from "@/components/SpotThumb";
import { Icon } from "@/components/Icon";
import { defaultWhen, WhenPicker, whenToRange, type When } from "@/components/WhenPicker";
import { fmtDistance } from "@/lib/format";
import { formatTND } from "@/lib/pricing";
import type { SortKey } from "@/lib/ranking";
import type { SpotDTO } from "@/server/spots";

const SORTS: SortKey[] = ["recommended", "distance", "price", "rating"];

const PLACES: { id: string; fr: string; ar: string; en: string; lng: number; lat: number; zoom: number }[] = [
  { id: "babbhar", fr: "Bab Bhar", ar: "باب البحر", en: "Bab Bhar", lng: 10.6375, lat: 35.8287, zoom: 15.5 },
  { id: "medina", fr: "Médina", ar: "المدينة", en: "Medina", lng: 10.6325, lat: 35.8245, zoom: 15.5 },
  { id: "boujaafar", fr: "Boujaafar", ar: "بوجعفر", en: "Boujaafar", lng: 10.6295, lat: 35.8370, zoom: 15 },
  { id: "sahloul", fr: "Hôpital Sahloul", ar: "سبيطار سهلول", en: "Sahloul hospital", lng: 10.5935, lat: 35.8370, zoom: 15 },
  { id: "khezama", fr: "Khezama", ar: "خزامة", en: "Khezama", lng: 10.6075, lat: 35.8535, zoom: 15 },
  { id: "kantaoui", fr: "Kantaoui", ar: "القنطاوي", en: "Kantaoui", lng: 10.5930, lat: 35.8898, zoom: 15 },
];

interface SearchResult {
  count: number;
  available: number;
  spots: SpotDTO[];
}

export default function FindPage() {
  const { t, f, locale } = useApp();
  const [when, setWhen] = useState<When>(() => defaultWhen());
  const [place, setPlace] = useState(PLACES[0]);
  const [center, setCenter] = useState<[number, number]>([PLACES[0].lng, PLACES[0].lat]);
  const [searchAt, setSearchAt] = useState<[number, number]>([PLACES[0].lng, PLACES[0].lat]);
  const [me, setMe] = useState<[number, number] | null>(null);
  const [result, setResult] = useState<{ key: string; data?: SearchResult; err?: unknown } | null>(null);
  const [nonce, setNonce] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("recommended");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const range = useMemo(() => whenToRange(when), [when]);

  const qs = useMemo(
    () => new URLSearchParams({ lat: String(searchAt[1]), lng: String(searchAt[0]), radius: "1800", start: range.start.toISOString(), end: range.end.toISOString(), sort }).toString(),
    [searchAt, range, sort],
  );
  const key = `${qs}#${nonce}`;

  useEffect(() => {
    let on = true;
    api<SearchResult>(`/api/spots?${qs}`).then(
      (data) => on && setResult((prev) => ({ key, data: data ?? prev?.data })),
      (err) => on && setResult((prev) => ({ key, err, data: prev?.data })),
    );
    return () => {
      on = false;
    };
  }, [qs, key]);

  const loading = result?.key !== key;
  const data = result?.data ?? null;
  const err = loading ? null : result?.err;
  const run = () => setNonce((n) => n + 1);

  const onMoveEnd = useCallback((lng: number, lat: number) => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setSearchAt((prev) => (Math.abs(prev[0] - lng) + Math.abs(prev[1] - lat) > 0.002 ? [lng, lat] : prev));
    }, 450);
  }, []);

  // the server already ranks the list (free spots first, then the chosen sort)
  const spots = useMemo(() => data?.spots ?? [], [data]);

  const markers: MapMarker[] = useMemo(
    () => spots.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, label: s.available ? formatTND(s.quote!.totalMillimes, locale) : "—", off: !s.available, selected: s.id === selected })),
    [spots, selected, locale],
  );

  const href = (id: string) => `/spot/${id}?start=${encodeURIComponent(range.start.toISOString())}&end=${encodeURIComponent(range.end.toISOString())}`;

  const locate = () => {
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        const c: [number, number] = [p.coords.longitude, p.coords.latitude];
        setMe(c);
        setCenter(c);
        setSearchAt(c);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <Page wide>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[380px_1fr]">
        <section className="grid min-w-0 grid-cols-1 content-start gap-3">
          <WhenPicker value={when} onChange={setWhen} />
          <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t.find.near}>
            <button className="chip" onClick={locate}>
              <Icon name="locate" size={16} /> {t.find.locate}
            </button>
            {PLACES.map((p) => (
              <button
                key={p.id}
                className="chip"
                aria-pressed={place.id === p.id}
                onClick={() => {
                  setPlace(p);
                  setCenter([p.lng, p.lat]);
                  setSearchAt([p.lng, p.lat]);
                }}
              >
                {p[locale]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1" role="group" aria-label={t.find.sort}>
            {SORTS.map((k) => (
              <button key={k} className="chip" aria-pressed={sort === k} onClick={() => setSort(k)} data-testid={`sort-${k}`}>
                {t.find.sortBy[k]}
              </button>
            ))}
            <Link href="/top" className="chip ms-auto shrink-0" data-testid="top-link">
              <Icon name="trophy" size={16} /> {t.find.topLink}
            </Link>
          </div>

          <div className="md:hidden">
            <MapView center={center} zoom={place.zoom} markers={markers} me={me} onMarkerClick={setSelected} onMoveEnd={onMoveEnd} className="h-64" testId="map" />
          </div>

          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold text-navy-70" data-testid="results-count">
              {data ? f(t.find.results, { n: data.count, a: data.available }) : " "}
            </p>
            {loading && <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue border-t-transparent" />}
          </div>

          {err ? (
            <Alert>
              {errorText(t, err)}{" "}
              <button className="underline" onClick={run}>
                {t.common.retry}
              </button>
            </Alert>
          ) : null}
          {!data && loading && (
            <div className="grid gap-2.5" aria-busy="true" aria-label={t.common.loading}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-[88px]" />
              ))}
            </div>
          )}
          {data && data.available === 0 && <Alert kind="info">{t.find.noResults}</Alert>}

          <ul className="grid grid-cols-1 gap-2.5" data-testid="spot-list">
            {spots.map((s) => (
              <li key={s.id}>
                <Link
                  href={href(s.id)}
                  onMouseEnter={() => setSelected(s.id)}
                  className={`card flex gap-3 p-3 transition hover:border-blue ${s.id === selected ? "border-blue" : ""} ${s.available ? "" : "opacity-60"}`}
                  data-testid="spot-card"
                  data-available={s.available ? "1" : "0"}
                >
                  <SpotPhoto photos={s.photos} type={s.spotType} className="h-16 w-16 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 truncate font-semibold">{s.title}</p>
                      <RatingTag avg={s.rating.avg} count={s.rating.count} newLabel={t.find.newSpot} className="shrink-0" />
                    </div>
                    <p className="truncate text-xs text-navy-50">{t.spot.type[s.spotType as keyof typeof t.spot.type]}, {fmtDistance(s.distanceM, locale)}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                      {s.available ? (
                        <span className="rounded-full bg-ok-50 px-2 py-0.5 text-ok">{t.find.free}</span>
                      ) : (
                        <span className="rounded-full bg-stone px-2 py-0.5 text-navy-50">{s.unavailableReason === "booked" ? t.find.booked : t.find.closed}</span>
                      )}
                      {s.gardienName && <span className="rounded-full bg-sand-100 px-2 py-0.5 text-[#8a5a2b]">{t.spot.gardien}</span>}
                      {s.covered && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue">{t.spot.covered}</span>}
                    </div>
                  </div>
                  <div className="text-end">
                    <p className="num text-lg font-bold text-blue">{formatTND(s.quote!.totalMillimes, locale)}</p>
                    <p className="num text-[11px] text-navy-50">
                      {formatTND(s.priceMillimes, locale)} {t.common.perHour}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="hidden md:block">
          <div className="sticky top-20">
            <MapView center={center} zoom={place.zoom} markers={markers} me={me} onMarkerClick={setSelected} onMoveEnd={onMoveEnd} className="h-[calc(100dvh-8rem)]" testId="map-desktop" />
          </div>
        </div>
      </div>
    </Page>
  );
}
