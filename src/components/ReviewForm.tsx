"use client";

import { useState } from "react";
import { api, errorText, useApp } from "./AppProvider";
import { Alert } from "./Shell";
import { POINTS } from "@/lib/gamification";

/** Star rating plus an optional comment, for a stay the driver has finished. */
export function ReviewForm({ bookingId, onDone, compact = false }: { bookingId: string; onDone: (rating: number) => void; compact?: boolean }) {
  const { t, f } = useApp();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  const send = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/bookings/${bookingId}/review`, { method: "POST", json: { rating, comment: comment.trim() || undefined } });
      onDone(rating);
    } catch (e) {
      setErr(e);
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-2.5" data-testid="review-form">
      {!compact && (
        <div>
          <h2 className="font-semibold">{t.booking.rateTitle}</h2>
          <p className="text-xs text-navy-50">{f(t.booking.rateHint, { p: POINTS.review })}</p>
        </div>
      )}
      <div className="flex gap-1" role="radiogroup" aria-label={t.booking.rateTitle} onMouseLeave={() => setHover(0)} dir="ltr">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n}/5`}
            data-testid={`star-${n}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => setRating(n)}
            className={`grid h-11 w-11 place-items-center rounded-xl text-2xl leading-none transition ${n <= (hover || rating) ? "text-sand" : "text-line"}`}
          >
            ★
          </button>
        ))}
      </div>
      {rating > 0 && (
        <>
          {!compact && (
            <textarea className="input min-h-20" maxLength={300} placeholder={t.booking.ratePh} value={comment} onChange={(e) => setComment(e.target.value)} data-testid="review-comment" />
          )}
          <button className="btn btn-primary" disabled={busy} onClick={send} data-testid="review-send">
            {t.booking.rateSend}
          </button>
        </>
      )}
      {err ? <Alert>{errorText(t, err)}</Alert> : null}
    </div>
  );
}
