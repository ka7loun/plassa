"use client";

import { useApp } from "./AppProvider";
import { Icon, type IconName } from "./Icon";
import type { Badge, BadgeKey, LevelKey } from "@/lib/gamification";

interface Level {
  key: LevelKey;
  index: number;
  next: { key: LevelKey; min: number } | null;
  progress: number;
}

/** Level, points and the bar towards the next level. */
export function LevelCard({ points, level, name }: { points: number; level: Level; name?: string }) {
  const { t, f } = useApp();
  return (
    <div className="rounded-2xl bg-navy p-4 text-white" data-testid="level-card">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-blue text-white">
          <Icon name="trophy" size={24} />
        </span>
        <div className="min-w-0 flex-1">
          {name && <p className="truncate text-xs text-white/70">{name}</p>}
          <p className="text-lg font-bold leading-tight" data-testid="level-name">
            {t.game.levels[level.key]}
          </p>
          <p className="num text-xs text-white/70">{f(t.game.points, { n: points })}</p>
        </div>
        <span className="num text-xs font-semibold text-white/60">
          {t.game.level} {level.index + 1}/4
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level.progress * 100)}>
        <div className="h-full rounded-full bg-sand" style={{ width: `${Math.max(4, level.progress * 100)}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-white/70">
        {level.next ? f(t.game.toNext, { n: level.next.min - points, level: t.game.levels[level.next.key] }) : t.game.maxLevel}
      </p>
    </div>
  );
}

const BADGE_ICON: Record<BadgeKey, IconName> = {
  first_stay: "check",
  regular: "calendar",
  medina: "home",
  early_bird: "clock",
  night_owl: "clock",
  critic: "star",
  first_guest: "key",
  busy_host: "chart",
  earner: "trophy",
  super_host: "star",
  always_open: "shield",
};

/** Badges of one side (driver or host): earned ones in colour, the rest with progress. */
export function BadgeGrid({ badges, side }: { badges: Badge[]; side: Badge["side"] }) {
  const { t } = useApp();
  const list = badges.filter((b) => b.side === side);
  const earned = list.filter((b) => b.earned).length;
  return (
    <section className="card p-4" data-testid={`badges-${side}`}>
      <h2 className="mb-3 flex items-baseline justify-between font-semibold">
        {side === "driver" ? t.game.driverBadges : t.game.hostBadges}
        <span className="num text-xs font-semibold text-navy-50">
          {earned}/{list.length}
        </span>
      </h2>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {list.map((b) => {
          const info = t.game.badge[b.key];
          return (
            <li key={b.key} className={`flex items-start gap-2.5 rounded-xl border p-2.5 ${b.earned ? "border-sand bg-sand-100/60" : "border-line bg-white"}`} data-earned={b.earned ? "1" : "0"}>
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${b.earned ? "bg-sand text-white" : "bg-stone text-navy-50"}`}>
                <Icon name={BADGE_ICON[b.key]} size={18} />
              </span>
              <span className="min-w-0">
                <span className={`block text-sm font-semibold leading-tight ${b.earned ? "text-navy" : "text-navy-70"}`}>{info.t}</span>
                <span className="block text-[11px] leading-snug text-navy-50">{info.d}</span>
                {!b.earned && b.goal > 1 && (
                  <span className="num mt-0.5 block text-[11px] font-semibold text-blue">
                    {b.current}/{b.goal}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Simple bar chart for a few values (earnings per week, spend per month). */
export function Bars({ items, testId }: { items: { label: string; value: number; display: string }[]; testId?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="flex h-36 items-end gap-1.5" data-testid={testId} dir="ltr">
      {items.map((it, i) => (
        <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <span className="num truncate text-[10px] font-semibold text-navy-70">{it.value > 0 ? it.display : ""}</span>
          <div
            className={`w-full rounded-t-md ${i === items.length - 1 ? "bg-blue" : "bg-blue/35"}`}
            style={{ height: `${Math.max(it.value > 0 ? 6 : 2, (it.value / max) * 100)}%` }}
            title={`${it.label}: ${it.display}`}
          />
          <span className="num truncate text-[10px] text-navy-50">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Stat({ label, value, testId }: { label: string; value: React.ReactNode; testId?: string }) {
  return (
    <div className="card p-3">
      <p className="text-xs text-navy-50">{label}</p>
      <p className="num text-xl font-bold text-navy" data-testid={testId}>
        {value}
      </p>
    </div>
  );
}
