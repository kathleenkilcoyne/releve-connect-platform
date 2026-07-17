// Pay rate + payment status, shown on teaching/booked cards and rollup rows.
// Status is conveyed by text (never colour alone): a small labelled dot plus the
// word ("Paid" / "Pending" / "Unpaid").

import type { PayInfo, PaymentStatus } from "@/lib/this-week/types";

const STATUS_LABEL: Record<PaymentStatus, string> = {
  paid: "Paid",
  pending: "Pending",
  unpaid: "Unpaid",
};

// Neutral-leaning status dots (kept off the category palette on purpose).
const STATUS_DOT: Record<PaymentStatus, string> = {
  paid: "#2f7d4f",
  pending: "#b98a2e",
  unpaid: "#9a8f79",
};

export function PayBadge({ pay }: { pay: PayInfo }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className="font-semibold text-[var(--rc-ink)]">{pay.rate}</span>
      <span className="inline-flex items-center gap-1 text-[var(--rc-muted)]">
        <span
          aria-hidden="true"
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: STATUS_DOT[pay.status] }}
        />
        {STATUS_LABEL[pay.status]}
      </span>
    </span>
  );
}
