"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { errorText, useApp } from "./AppProvider";
import { Alert, DemoButtons } from "./Shell";

/** Only follow same-site paths after sign-in, never another origin. */
export function safeNext(raw: string | null, fallback = "/find") {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : fallback;
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const { t, f, login, signup } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isLogin = mode === "login";
  const other = `${isLogin ? "/signup" : "/login"}${params.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (isLogin) await login(phone, password);
      else await signup(name, phone, password);
      router.push(next);
    } catch (e) {
      setErr(errorText(t, e));
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold text-navy">{isLogin ? t.auth.loginTitle : t.auth.signupTitle}</h1>
      <p className="mt-1 text-sm text-navy-70">{t.auth.oneAccount}</p>

      <form onSubmit={submit} className="card mt-5 grid gap-3.5 p-5" noValidate>
        {!isLogin && (
          <label className="grid gap-1 text-sm font-semibold">
            {t.auth.name}
            <input className="input" name="name" autoComplete="name" required minLength={2} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} data-testid="auth-name" />
          </label>
        )}
        <label className="grid gap-1 text-sm font-semibold">
          {t.auth.phone}
          <span className="flex items-stretch overflow-hidden rounded-xl border border-line bg-white focus-within:border-blue" dir="ltr">
            <span className="num flex items-center bg-stone px-3 text-sm text-navy-70">+216</span>
            <input
              className="min-w-0 flex-1 px-3 py-2.5 text-base outline-none"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder={t.auth.phonePh}
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              data-testid="auth-phone"
            />
          </span>
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          {t.auth.password}
          <input
            className="input"
            name="password"
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-testid="auth-password"
          />
          {!isLogin && <span className="text-xs font-normal text-navy-50">{t.auth.passwordHint}</span>}
        </label>
        {err && <Alert>{err}</Alert>}
        <button type="submit" className="btn btn-primary w-full" disabled={busy} data-testid="auth-submit">
          {isLogin ? t.auth.loginBtn : t.auth.signupBtn}
        </button>
        <p className="text-center text-sm text-navy-70">
          {isLogin ? t.auth.noAccount : t.auth.haveAccount}{" "}
          <Link href={other} className="font-semibold text-blue underline-offset-2 hover:underline">
            {isLogin ? t.landing.signUp : t.landing.signIn}
          </Link>
        </p>
      </form>

      <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-navy-50">{t.auth.orDemo}</p>
      <DemoButtons personas={["driver", "host"]} onDone={() => router.push(next)} />
      {isLogin && <p className="num mt-3 text-xs text-navy-50">{f(t.auth.demoNote, { p: "00 000 101", pw: "plassa2026" })}</p>}
    </div>
  );
}
