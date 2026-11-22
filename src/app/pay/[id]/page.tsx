"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api, ApiError, errorText, useApp } from "@/components/AppProvider";
import { Alert, Logo, Spinner } from "@/components/Shell";
import { formatTND } from "@/lib/pricing";
import type { BookingDTO } from "@/server/bookings";

// Simulated wallet / card approval screen. A real integration would redirect
// to the provider and come back to /api/bookings/[id]/pay via its callback.
function PayInner() {
  const { id } = useParams<{ id: string }>();
  const ref = useSearchParams().get("ref") ?? "";
  const router = useRouter();
  const { t, locale } = useApp();
  const [b, setB] = useState<BookingDTO | null>(null);
  const [busy, setBusy] = useState<"approve" | "decline" | null>(null);
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => {
    api<{ booking: BookingDTO }>(`/api/bookings/${id}`).then((r) => setB(r.booking), setErr);
  }, [id]);

  const submit = async (approved: boolean) => {
    setBusy(approved ? "approve" : "decline");
    setErr(null);
    try {
      await new Promise((r) => setTimeout(r, 900)); // feel of a gateway round-trip
      await api(`/api/bookings/${id}/pay`, { method: "POST", json: { ref, approved } });
      router.replace(`/bookings/${id}?new=1`);
    } catch (e) {
      setErr(e);
      setBusy(null);
      if (e instanceof ApiError && e.code === "payment_failed") setB((x) => (x ? { ...x, status: "cancelled" } : x));
    }
  };

  const methodLabel = b ? t.spot.method[b.paymentMethod] : "";
  return (
    <main className="mx-auto grid min-h-dvh max-w-sm content-center gap-4 px-4 py-10">
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between bg-navy px-5 py-4 text-white">
          <span className="text-lg font-bold">{methodLabel || "…"}</span>
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold">{t.pay.simulated}</span>
        </div>
        <div className="grid gap-4 p-5">
          <h1 className="text-lg font-bold">{t.pay.title}</h1>
          {!b && !err && <Spinner />}
          {b && (
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-navy-50">{t.pay.merchant}</dt>
                <dd className="text-end font-semibold">Plassa · {b.spot?.title}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-navy-50">{t.pay.amount}</dt>
                <dd className="num text-xl font-bold text-blue" data-testid="pay-amount">
                  {formatTND(b.amountMillimes, locale)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-navy-50">Ref</dt>
                <dd className="num text-xs">{ref}</dd>
              </div>
            </dl>
          )}
          {err ? <Alert>{err instanceof ApiError && err.code === "payment_failed" ? t.pay.declined : errorText(t, err)}</Alert> : null}
          {b?.status === "pending_payment" && (
            <div className="grid gap-2">
              <button className="btn btn-primary w-full py-3.5" disabled={!!busy} onClick={() => submit(true)} data-testid="pay-approve">
                {busy === "approve" ? t.pay.processing : t.pay.approve}
              </button>
              <button className="btn btn-ghost w-full" disabled={!!busy} onClick={() => submit(false)} data-testid="pay-decline">
                {busy === "decline" ? t.pay.processing : t.pay.decline}
              </button>
            </div>
          )}
          {b?.status === "cancelled" && (
            <button className="btn btn-ghost w-full" onClick={() => router.push("/find")}>
              {t.booking.findOne}
            </button>
          )}
        </div>
      </div>
      <div className="flex justify-center opacity-60">
        <Logo className="h-5" />
      </div>
    </main>
  );
}

export default function PayPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <PayInner />
    </Suspense>
  );
}
