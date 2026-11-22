"use client";

import { useApp } from "./AppProvider";
import { fromTunisLocal, nextHalfHour, suggestedStart, tunisDateString, tunisTimeString } from "@/lib/time";

export interface When {
  date: string; // YYYY-MM-DD (Tunis)
  time: string; // HH:MM
  hours: number;
}

export function defaultWhen(now = new Date()): When {
  const n = suggestedStart(now);
  return { date: tunisDateString(n), time: tunisTimeString(n), hours: 2 };
}

export function whenToRange(w: When) {
  const start = fromTunisLocal(w.date, w.time);
  const end = new Date(start.getTime() + w.hours * 3_600_000);
  return { start, end };
}

const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const DURATIONS = [1, 2, 3, 4, 6];

export function WhenPicker({ value, onChange }: { value: When; onChange: (w: When) => void }) {
  const { t, locale } = useApp();
  const now = new Date();
  const days = [0, 1, 2, 3].map((d) => {
    const date = tunisDateString(new Date(now.getTime() + d * 86_400_000));
    const label =
      d === 0
        ? t.common.today
        : d === 1
          ? t.common.tomorrow
          : new Intl.DateTimeFormat(locale === "ar" ? "ar-TN" : locale, { weekday: "short", day: "numeric", timeZone: "Africa/Tunis" }).format(new Date(now.getTime() + d * 86_400_000));
    return { date, label };
  });
  const today = days[0].date;
  const minTime = value.date === today ? tunisTimeString(nextHalfHour(new Date(now.getTime() - 25 * 60_000))) : "00:00";
  const times = TIMES.filter((x) => x >= minTime);

  return (
    <div className="grid min-w-0 grid-cols-1 gap-2.5">
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {days.map((d) => (
          <button key={d.date} className="chip" aria-pressed={value.date === d.date} onClick={() => onChange({ ...value, date: d.date, time: d.date === today && value.time < minTime ? times[0] : value.time })}>
            {d.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center">
        <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-line bg-white px-3 sm:flex-1">
          <span className="text-xs font-semibold text-navy-50">{t.find.arrive}</span>
          <select data-testid="arrive" className="num w-full min-w-0 bg-transparent py-1 font-semibold outline-none" value={value.time} onChange={(e) => onChange({ ...value, time: e.target.value })}>
            {(times.includes(value.time) ? times : [value.time, ...times]).map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-1.5 overflow-x-auto" role="group" aria-label={t.find.duration}>
          <span className="self-center pe-1 text-xs font-semibold text-navy-50 sm:hidden">{t.find.duration}</span>
          {DURATIONS.map((h) => (
            <button key={h} className="chip num min-w-11 justify-center px-2.5" aria-pressed={value.hours === h} onClick={() => onChange({ ...value, hours: h })} data-testid={`dur-${h}`}>
              {h}h
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
