"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError, errorText, useApp } from "@/components/AppProvider";
import { MapView } from "@/components/MapView";
import { Alert, Page, RequireRole } from "@/components/Shell";

const TYPES = ["garage", "courtyard", "driveway", "lot", "basement"] as const;
const HOURS = Array.from({ length: 49 }, (_, i) => i * 30);
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function NewSpotForm() {
  const { t } = useApp();
  const router = useRouter();
  const [pin, setPin] = useState<[number, number] | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    address: "",
    spotType: "garage" as (typeof TYPES)[number],
    covered: false,
    price: "1.500",
    peakOn: false,
    peakMultiplier: 1.3,
    peakStartHour: 17,
    peakEndHour: 21,
    peakSummer: false,
    availDays: [0, 1, 2, 3, 4, 5, 6],
    availStartMin: 480,
    availEndMin: 1260,
    gardienName: "",
    gardienPhone: "",
    privateAttested: false,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((s) => ({ ...s, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!pin) {
      setErr(new ApiError("bad_request", 400, t.host.fPin));
      return;
    }
    setBusy(true);
    try {
      const priceMillimes = Math.round(Number(form.price.replace(",", ".")) * 1000);
      await api("/api/host/spots", {
        method: "POST",
        json: {
          title: form.title,
          description: form.description,
          address: form.address,
          lat: pin[1],
          lng: pin[0],
          spotType: form.spotType,
          covered: form.covered,
          privateAttested: form.privateAttested,
          gardienName: form.gardienName || null,
          gardienPhone: form.gardienPhone || null,
          priceMillimes,
          peakMultiplier: form.peakOn ? form.peakMultiplier : 1,
          peakStartHour: form.peakOn ? form.peakStartHour : null,
          peakEndHour: form.peakOn ? form.peakEndHour : null,
          peakMonths: form.peakOn && form.peakSummer ? [6, 7, 8, 9] : [],
          availDays: form.availDays,
          availStartMin: form.availStartMin,
          availEndMin: form.availEndMin,
        },
      });
      router.push("/host?published=1");
    } catch (e) {
      setErr(e);
      setBusy(false);
    }
  };

  const issues = err instanceof ApiError && Array.isArray((err.body as { issues?: unknown })?.issues) ? ((err.body as { issues: { path: string; message: string }[] }).issues) : [];

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <h1 className="text-2xl font-bold">{t.host.newTitle}</h1>

      <div className="card grid gap-3 p-4">
        <div>
          <label className="label" htmlFor="title">{t.host.fTitle}</label>
          <input id="title" className="input" required minLength={3} maxLength={80} placeholder={t.host.fTitlePh} value={form.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="address">{t.host.fAddress}</label>
          <input id="address" className="input" maxLength={160} value={form.address} onChange={(e) => set("address", e.target.value)} />
        </div>
        <div>
          <p className="label">{t.host.fPin}</p>
          <MapView center={[10.6375, 35.8287]} zoom={15} pick={pin} onMapClick={(lng, lat) => setPin([lng, lat])} className="h-60" testId="pick-map" />
          {pin && <p className="num mt-1 text-xs text-navy-50" dir="ltr">{pin[1].toFixed(5)}, {pin[0].toFixed(5)}</p>}
        </div>
        <div>
          <label className="label" htmlFor="desc">{t.host.fDesc}</label>
          <textarea id="desc" className="input min-h-20" maxLength={500} placeholder={t.host.fDescPh} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div>
          <p className="label">{t.host.fType}</p>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((ty) => (
              <button type="button" key={ty} className="chip" aria-pressed={form.spotType === ty} onClick={() => set("spotType", ty)}>
                {t.spot.type[ty]}
              </button>
            ))}
            <label className="chip cursor-pointer">
              <input type="checkbox" checked={form.covered} onChange={(e) => set("covered", e.target.checked)} /> {t.host.fCovered}
            </label>
          </div>
        </div>
      </div>

      <div className="card grid gap-3 p-4">
        <div>
          <label className="label" htmlFor="price">{t.host.fPrice}</label>
          <input id="price" className="input num" inputMode="decimal" value={form.price} onChange={(e) => set("price", e.target.value)} dir="ltr" />
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={form.peakOn} onChange={(e) => set("peakOn", e.target.checked)} /> {t.host.fPeak}
        </label>
        {form.peakOn && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="label">{t.host.fPeakMult}</label>
              <select className="input num" value={form.peakMultiplier} onChange={(e) => set("peakMultiplier", Number(e.target.value))}>
                {[1.2, 1.3, 1.4, 1.5, 2].map((m) => <option key={m} value={m}>×{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t.host.fPeakFrom}</label>
              <select className="input num" value={form.peakStartHour} onChange={(e) => set("peakStartHour", Number(e.target.value))}>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}:00</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t.host.fPeakTo}</label>
              <select className="input num" value={form.peakEndHour} onChange={(e) => set("peakEndHour", Number(e.target.value))}>
                {Array.from({ length: 24 }, (_, h) => h + 1).map((h) => <option key={h} value={h}>{h}:00</option>)}
              </select>
            </div>
            <label className="col-span-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.peakSummer} onChange={(e) => set("peakSummer", e.target.checked)} /> {t.host.fPeakSummer}
            </label>
          </div>
        )}
      </div>

      <div className="card grid gap-3 p-4">
        <div>
          <p className="label">{t.host.fDays}</p>
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <button
                type="button"
                key={d}
                className="chip"
                aria-pressed={form.availDays.includes(d)}
                onClick={() => set("availDays", form.availDays.includes(d) ? form.availDays.filter((x) => x !== d) : [...form.availDays, d])}
              >
                {t.common.days[d]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">{t.host.fOpen}</label>
            <select className="input num" value={form.availStartMin} onChange={(e) => set("availStartMin", Number(e.target.value))}>
              {HOURS.slice(0, 48).map((m) => <option key={m} value={m}>{hhmm(m)}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t.host.fClose}</label>
            <select className="input num" value={form.availEndMin} onChange={(e) => set("availEndMin", Number(e.target.value))}>
              {HOURS.slice(1).map((m) => <option key={m} value={m}>{m === 1440 ? "24:00" : hhmm(m)}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="gname">{t.host.fGardien}</label>
            <input id="gname" className="input" maxLength={60} value={form.gardienName} onChange={(e) => set("gardienName", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="gphone">{t.host.fGardienPhone}</label>
            <input id="gphone" className="input num" inputMode="tel" placeholder="+216 22 123 456" value={form.gardienPhone} onChange={(e) => set("gardienPhone", e.target.value)} dir="ltr" />
          </div>
        </div>
      </div>

      <label className="flex items-start gap-3 rounded-2xl border border-line bg-white p-4 text-sm">
        <input type="checkbox" className="mt-1" checked={form.privateAttested} onChange={(e) => set("privateAttested", e.target.checked)} data-testid="private-attest" />
        <span>{t.host.fPrivate}</span>
      </label>

      {err ? (
        <Alert>
          {errorText(t, err)}
          {issues.length > 0 && (
            <ul className="mt-1 list-disc ps-5 text-xs">
              {issues.map((i) => <li key={i.path + i.message}>{i.path}: {i.message}</li>)}
            </ul>
          )}
        </Alert>
      ) : null}

      <button className="btn btn-primary w-full py-4 text-lg" disabled={busy || !form.privateAttested} data-testid="publish">
        {t.host.fPublish}
      </button>
    </form>
  );
}

export default function NewSpotPage() {
  return (
    <Page>
      <RequireRole role="host">
        <NewSpotForm />
      </RequireRole>
    </Page>
  );
}
