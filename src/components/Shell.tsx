"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LOCALE_LABEL, LOCALES } from "@/i18n";
import { errorText, useApp, type Persona } from "./AppProvider";
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
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-stone/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
        <Link href="/" aria-label="Plassa">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <LangSwitch />
          {!user && path !== "/login" && path !== "/signup" && (
            <Link href={`/login?next=${encodeURIComponent(path)}`} data-testid="topbar-signin" className="text-xs font-semibold text-blue underline-offset-2 hover:underline">
              {t.landing.signIn}
            </Link>
          )}
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

type NavKey = "find" | "bookings" | "host" | "city" | "me" | "top";
const NAV: Record<"guest" | "user" | "admin", { href: string; key: NavKey; icon: IconName }[]> = {
  guest: [
    { href: "/find", key: "find", icon: "search" },
    { href: "/top", key: "top", icon: "trophy" },
    { href: "/me", key: "me", icon: "user" },
  ],
  user: [
    { href: "/find", key: "find", icon: "search" },
    { href: "/bookings", key: "bookings", icon: "calendar" },
    { href: "/host", key: "host", icon: "home" },
    { href: "/me", key: "me", icon: "user" },
  ],
  admin: [
    { href: "/city", key: "city", icon: "chart" },
    { href: "/find", key: "find", icon: "search" },
    { href: "/top", key: "top", icon: "trophy" },
  ],
};

export function BottomNav() {
  const { user, t } = useApp();
  const path = usePathname();
  const items = NAV[user?.role ?? "guest"];
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

/** One-click demo accounts, used on the landing page and wherever sign-in is needed. */
export function DemoButtons({ personas = ["driver", "host", "admin"], onDone }: { personas?: Persona[]; onDone?: (p: Persona) => void }) {
  const { demoLogin, t } = useApp();
  const [busy, setBusy] = useState<Persona | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const info: Record<Persona, { name: string; hint: string }> = {
    driver: { name: t.landing.demoDriver, hint: t.landing.demoDriverHint },
    host: { name: t.landing.demoHost, hint: t.landing.demoHostHint },
    admin: { name: t.landing.demoCity, hint: t.landing.demoCityHint },
  };
  return (
    <div className="grid gap-2">
      {personas.map((p) => (
        <button
          key={p}
          data-testid={`demo-${p}`}
          disabled={busy !== null}
          onClick={async () => {
            setBusy(p);
            setErr(null);
            try {
              await demoLogin(p);
              onDone?.(p);
            } catch (e) {
              setErr(errorText(t, e));
            } finally {
              setBusy(null);
            }
          }}
          className="flex items-center gap-3 rounded-2xl border border-line bg-white px-3.5 py-3 text-start hover:border-blue disabled:opacity-60"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-50 font-display text-sm font-semibold text-blue">{info[p].name.slice(0, 1)}</span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-navy">{info[p].name}</span>
            <span className="block text-xs text-navy-50">{info[p].hint}</span>
          </span>
        </button>
      ))}
      {err && <Alert>{err}</Alert>}
    </div>
  );
}

/**
 * Shows the page to signed-in accounts. Visitors get sign-in / sign-up links and
 * the demo accounts instead. `admin` pages are for the city operator only.
 */
export function RequireUser({ admin = false, children }: { admin?: boolean; children: React.ReactNode }) {
  const { user, t } = useApp();
  const path = usePathname();
  if (user && (admin ? user.role === "admin" : true)) return <>{children}</>;
  const next = encodeURIComponent(path);
  return (
    <div className="card mx-auto mt-8 max-w-sm p-5">
      {!admin && (
        <>
          <p className="mb-4 text-sm text-navy-70">{t.auth.oneAccount}</p>
          <div className="grid grid-cols-2 gap-2">
            <Link href={`/login?next=${next}`} className="btn btn-primary" data-testid="require-login">
              {t.landing.signIn}
            </Link>
            <Link href={`/signup?next=${next}`} className="btn btn-ghost">
              {t.landing.signUp}
            </Link>
          </div>
          <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-navy-50">{t.auth.orDemo}</p>
        </>
      )}
      <DemoButtons personas={admin ? ["admin"] : ["driver", "host"]} />
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
