"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { DICTS, dirOf, fill, LOCALE_COOKIE, type Dict, type Locale } from "@/i18n";

/** Every account can book spots and rent out its own; "admin" is the city operator. */
export type Role = "user" | "admin";
/** The three one-click demo accounts. */
export type Persona = "driver" | "host" | "admin";
export interface User {
  id: string;
  role: Role;
  name: string;
}

interface Ctx {
  locale: Locale;
  t: Dict;
  f: typeof fill;
  setLocale: (l: Locale) => void;
  user: User | null;
  setUser: (u: User | null) => void;
  demoLogin: (persona: Persona) => Promise<User>;
  login: (phone: string, password: string) => Promise<User>;
  signup: (name: string, phone: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ initialLocale, initialUser, children }: { initialLocale: Locale; initialUser: User | null; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [user, setUser] = useState<User | null>(initialUser);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = l;
    document.documentElement.dir = dirOf(l);
    document.title = DICTS[l].meta.title;
  }, []);

  const demoLogin = useCallback(async (persona: Persona) => {
    const { user } = await api<{ user: User }>("/api/auth/demo", { method: "POST", json: { role: persona } });
    setUser(user);
    return user;
  }, []);

  const login = useCallback(async (phone: string, password: string) => {
    const { user } = await api<{ user: User }>("/api/auth/login", { method: "POST", json: { phone, password } });
    setUser(user);
    return user;
  }, []);

  const signup = useCallback(async (name: string, phone: string, password: string) => {
    const { user } = await api<{ user: User }>("/api/auth/signup", { method: "POST", json: { name, phone, password } });
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  const value = useMemo<Ctx>(
    () => ({ locale, t: DICTS[locale], f: fill, setLocale, user, setUser, demoLogin, login, signup, logout }),
    [locale, setLocale, user, demoLogin, login, signup, logout],
  );
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
}

export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
  }
}

/** fetch wrapper: JSON in/out, throws ApiError with the server's error code. */
export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? "internal", res.status, body.message ?? res.statusText, body);
  return body as T;
}

export function errorText(t: Dict, e: unknown) {
  if (e instanceof ApiError && e.code in t.errors) return t.errors[e.code as keyof Dict["errors"]];
  return t.common.error;
}
