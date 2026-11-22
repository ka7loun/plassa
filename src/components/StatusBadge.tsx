"use client";

import { useApp } from "./AppProvider";

export function StatusBadge({ status }: { status: string }) {
  const { t } = useApp();
  const map: Record<string, [string, string]> = {
    confirmed: [t.booking.upcoming, "bg-ok-50 text-ok"],
    pending_payment: [t.booking.pending, "bg-sand-100 text-[#8a5a2b]"],
    checked_in: [t.booking.checkedIn, "bg-blue-50 text-blue"],
    cancelled: [t.booking.cancelled, "bg-err-50 text-err"],
    expired: [t.booking.expired, "bg-stone text-navy-50"],
  };
  const [label, cls] = map[status] ?? [status, "bg-stone"];
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${cls}`} data-testid="status">
      {label}
    </span>
  );
}
