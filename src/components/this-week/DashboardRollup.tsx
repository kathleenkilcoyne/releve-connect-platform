// A role dashboard rollup that stacks below the personal week, e.g.
// "TEACHER DASHBOARD · THIS WEEK" listing that role's items with pay.

import type { DashboardRollup as Rollup } from "@/lib/this-week/types";
import { PayBadge } from "./PayBadge";

export function DashboardRollup({ rollup }: { rollup: Rollup }) {
  return (
    <section className="rounded-xl border border-[var(--rc-hairline)] bg-[var(--rc-ivory)]">
      <div className="border-b border-[var(--rc-hairline)] px-4 py-2.5 sm:px-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--rc-ink)]">
          {rollup.title}
        </h2>
      </div>
      <ul className="divide-y divide-[var(--rc-hairline)]">
        {rollup.items.map((item) => (
          <li
            key={item.label}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 sm:px-5"
          >
            <div>
              <p className="rc-serif font-semibold text-[var(--rc-ink)]">
                {item.label}
              </p>
              <p className="text-sm text-[var(--rc-muted)]">{item.detail}</p>
            </div>
            {item.pay && <PayBadge pay={item.pay} />}
          </li>
        ))}
      </ul>
    </section>
  );
}
