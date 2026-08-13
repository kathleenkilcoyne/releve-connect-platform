"use client";

// Live Swing availability toggle (Slice 1). A member flips whether they're
// available for sub calls; the change persists via the owner-scoped server
// action. Optimistic: the switch moves immediately and reverts only if the
// write fails. Distinct from the fixed "Available for" services list — this is
// a live status, not a fixed offering.

import { useState, useTransition } from "react";
import { setSwingAvailability } from "./actions";

export default function SwingToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next); // optimistic
    startTransition(async () => {
      const res = await setSwingAvailability(next);
      if (!res.ok) setOn(!next); // revert on failure
    });
  }

  return (
    <div className="mt-9 flex items-center justify-between gap-4 border-y border-[var(--rc-line)] py-4">
      <div>
        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--rc-ink)]">
          Swing availability
        </div>
        {on ? (
          <div className="mt-1 inline-flex items-center gap-1.5 text-[12.5px] text-[var(--rc-gold-deep)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--rc-gold)]" />
            Available for sub calls
          </div>
        ) : (
          <div className="mt-1 text-[12.5px] text-[var(--rc-taupe)]">Not currently taking sub calls</div>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Swing availability — available for sub calls"
        onClick={toggle}
        disabled={pending}
        className={`relative h-[27px] w-[46px] shrink-0 rounded-full transition-colors ${
          on ? "bg-[var(--rc-ink)]" : "bg-[var(--rc-cream-soft)]"
        } ${pending ? "opacity-70" : ""}`}
      >
        <span
          className={`absolute top-[3px] h-[21px] w-[21px] rounded-full bg-white shadow-sm transition-all ${
            on ? "left-[22px]" : "left-[3px]"
          }`}
        />
      </button>
    </div>
  );
}
