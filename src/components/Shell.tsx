"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LOCALE_LABEL, LOCALES } from "@/i18n";
import { useApp, type Role } from "./AppProvider";
import { Icon, type IconName } from "./Icon";

export function Logo({ className = "h-7" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/plassa-logo-primary.svg" alt="Plassa" className={className} />;
}

export function LangSwitch() {
  const { locale, setLocale, t } = useApp();
  return (
    <div role="group" aria-label={t.common.language} className="flex rounded-full border border-line bg-white p-0.5 text-xs font-semibold">
      {LOCALES.map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          data-testid={`lang-${l}`}
          className={`min-h-9 min-w-10 rounded-full px-2.5 ${locale === l ? "bg-navy text-white" : "text-navy-70 hover:text-navy"}`}
        >
          {LOCALE_LABEL[l]}
        </button>
      ))}
    </div>
  );
}

export function TopBar() {
  const { user, logout, t } = useApp();
  const router = useRouter();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-stone/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
        <Link href="/" aria-label="Plassa">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <LangSwitch />
          {user && (
            <button
              className="hidden text-xs font-semibold text-navy-70 underline-offset-2 hover:underline sm:block"
              onClick={async () => {
                await logout();
                router.push("/");
              }}
            >
              {t.common.signOut}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

const NAV: Record<Role, { href: string; key: "find" | "bookings" | "host" | "city"; icon: IconName }[]> = {
  driver: [
    { href: "/find", key: "find", icon: "search" },
    { href: "/bookings", key: "bookings", icon: "calendar" },
  ],
  host: [
    { href: "/host", key: "host", icon: "home" },
    { href: "/find", key: "find", icon: "search" },
  ],
  admin: [
    { href: "/city", key: "city", icon: "chart" },
    { href: "/find", key: "find", icon: "search" },
  ],
};

export function BottomNav() {
  const { user, t } = useApp();
  const path = usePathname();
  const items = NAV[user?.role ?? "driver"];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-md justify-around">
        {items.map((it) => {
          const on = path === it.href || (it.href !== "/" && path.startsWith(it.href + "/"));
          return (
            <Link key={it.href} href={it.href} aria-current={on ? "page" : undefined} className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${on ? "text-blue" : "text-navy-50"}`}>
              <Icon name={it.icon} size={22} />
              {t.nav[it.key]}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Page({ children, nav = true, wide = false }: { children: React.ReactNode; nav?: boolean; wide?: boolean }) {
  return (
    <>
      <TopBar />
      <main className={`mx-auto w-full ${wide ? "max-w-5xl" : "max-w-xl"} px-4 pt-4 ${nav ? "pb-28" : "pb-10"}`}>{children}</main>
      {nav && <BottomNav />}
    </>
  );
}

/** Shows a one-click demo sign-in when the visitor lacks the needed role. */
export function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const { user, demoLogin, t } = useApp();
  const [busy, setBusy] = useState(false);
  if (user?.role === role) return <>{children}</>;
  const label = role === "driver" ? t.landing.asDriver : role === "host" ? t.landing.asHost : t.landing.asCity;
  const hint = role === "driver" ? t.landing.asDriverHint : role === "host" ? t.landing.asHostHint : t.landing.asCityHint;
  return (
    <div className="card mx-auto mt-10 max-w-sm p-6 text-center">
      <p className="mb-4 text-sm text-navy-70">{hint}</p>
      <button
        className="btn btn-primary w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await demoLogin(role);
          } finally {
            setBusy(false);
          }
        }}
      >
        {label}
      </button>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-navy-50" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue border-t-transparent" />
      {label}
    </div>
  );
}

export function Alert({ kind = "err", children }: { kind?: "err" | "ok" | "info"; children: React.ReactNode }) {
  const cls = kind === "err" ? "bg-err-50 text-err border-[#f1c3be]" : kind === "ok" ? "bg-ok-50 text-ok border-[#bfe3cf]" : "bg-blue-50 text-blue border-[#cdd8ff]";
  return (
    <div role={kind === "err" ? "alert" : "status"} className={`rounded-xl border px-3.5 py-2.5 text-sm font-medium ${cls}`}>
      {children}
    </div>
  );
}
