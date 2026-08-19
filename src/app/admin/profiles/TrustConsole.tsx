"use client";

// The interactive half of /admin/profiles. Renders each profile's current
// standing and lets an admin change it, with a reason, through the gated PATCH
// route. Nothing here writes to the database directly.

import { useState } from "react";
import {
  CONFERRABLE_HONORIFICS,
  CONFERRABLE_DISTINCTIONS,
  CHOREOGRAPHER_TIERS,
  DISTINCTION_LABEL,
  DISTINCTION_HELP,
  TIER_LABEL,
  isRetiredHonorific,
  type FounderDistinction,
  type ChoreographerTier,
} from "@/lib/profile/trust";

export type ProfileRow = {
  profile_id: string;
  display_name: string | null;
  public_slug: string | null;
  primary_role: string | null;
  city: string | null;
  state_province: string | null;
  profile_status: string | null;
  visibility: string | null;
  verification_flag: boolean;
  honorifics: string[] | null;
  founder_distinction: string | null;
  choreographer_tier: string | null;
  prefilled_from_application_id: string | null;
  created_at: string;
};

export type TrustEvent = {
  event_id: string;
  profile_id: string;
  field: string;
  previous_value: string | null;
  new_value: string | null;
  reason: string | null;
  created_at: string;
};

export default function TrustConsole({
  profiles,
  events,
}: {
  profiles: ProfileRow[];
  events: TrustEvent[];
}) {
  const [open, setOpen] = useState<string | null>(null);

  if (profiles.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-dashed border-neutral-300 px-6 py-16 text-center text-neutral-500">
        No professional profiles yet. Profiles are created at activation — approved plus an active
        paid or authorized complimentary membership.
      </div>
    );
  }

  return (
    <ul className="mt-4 space-y-3">
      {profiles.map((p) => (
        <ProfileCard
          key={p.profile_id}
          profile={p}
          history={events.filter((e) => e.profile_id === p.profile_id)}
          open={open === p.profile_id}
          onToggle={() => setOpen(open === p.profile_id ? null : p.profile_id)}
        />
      ))}
    </ul>
  );
}

function ProfileCard({
  profile,
  history,
  open,
  onToggle,
}: {
  profile: ProfileRow;
  history: TrustEvent[];
  open: boolean;
  onToggle: () => void;
}) {
  const [honorifics, setHonorifics] = useState<Set<string>>(
    new Set(profile.honorifics ?? []),
  );
  const [distinction, setDistinction] = useState<string>(profile.founder_distinction ?? "none");
  const [tier, setTier] = useState<string>(profile.choreographer_tier ?? "emerging");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Values conferred before the vocabulary was tightened. Shown so nothing is
  // hidden, and removable, but never offered for a new conferral.
  const retained = (profile.honorifics ?? []).filter(isRetiredHonorific);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/profiles/${profile.profile_id}/trust`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          honorifics: Array.from(honorifics),
          founder_distinction: distinction,
          choreographer_tier: tier,
          reason,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: json.error ?? "Something went wrong." });
      } else if (!json.changed) {
        setMsg({ ok: true, text: "No changes to save." });
      } else {
        setMsg({
          ok: true,
          text: json.audited
            ? "Saved and recorded."
            : "Saved — but the audit row failed. Check the server log.",
        });
        setReason("");
      }
    } catch {
      setMsg({ ok: false, text: "Network error." });
    } finally {
      setBusy(false);
    }
  }

  const location = [profile.city, profile.state_province].filter(Boolean).join(", ");

  return (
    <li className="rounded-xl border border-neutral-200">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-neutral-900">
              {profile.display_name ?? "(no name)"}
            </span>
            {profile.verification_flag && (
              <span title="Verified Member — granted at activation, not editable here" className="text-sky-600">
                ✓
              </span>
            )}
            {profile.founder_distinction && profile.founder_distinction !== "none" && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">
                {DISTINCTION_LABEL[profile.founder_distinction as FounderDistinction] ??
                  profile.founder_distinction}
              </span>
            )}
            <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-600">
              {TIER_LABEL[profile.choreographer_tier as ChoreographerTier] ??
                profile.choreographer_tier}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs ${
                profile.profile_status === "published"
                  ? "bg-green-50 text-green-700"
                  : "bg-neutral-100 text-neutral-500"
              }`}
            >
              {profile.profile_status === "published"
                ? profile.visibility === "unlisted"
                  ? "Published · unlisted"
                  : "Published · public"
                : "Draft"}
            </span>
          </span>
          <span className="mt-1 block truncate text-sm text-neutral-500">
            {profile.primary_role ?? "—"}
            {location ? ` · ${location}` : ""}
            {(profile.honorifics ?? []).length > 0
              ? ` · ${(profile.honorifics ?? []).join(", ")}`
              : ""}
          </span>
        </span>
        <span className="shrink-0 text-sm text-neutral-400">{open ? "Close" : "Manage"}</span>
      </button>

      {open && (
        <div className="border-t border-neutral-200 px-5 py-5">
          {/* Honorifics ------------------------------------------------- */}
          <p className="text-sm font-medium text-neutral-800">Honorifics</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            Editorial recognition conferred by Relevé. Changeable at any time.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {CONFERRABLE_HONORIFICS.map((h) => {
              const on = honorifics.has(h);
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => {
                    const next = new Set(honorifics);
                    if (on) next.delete(h);
                    else next.add(h);
                    setHonorifics(next);
                  }}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    on
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-300 text-neutral-700"
                  }`}
                >
                  {h}
                </button>
              );
            })}
          </div>
          {retained.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Retired honorific{retained.length > 1 ? "s" : ""} still on this profile:{" "}
              <span className="font-medium">{retained.join(", ")}</span>. These collided with the
              system-controlled Verified and Founding marks and are no longer conferrable. Remove:
              {retained.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => {
                    const next = new Set(honorifics);
                    next.delete(h);
                    setHonorifics(next);
                  }}
                  className="ml-2 underline"
                >
                  {h} ✕
                </button>
              ))}
            </div>
          )}

          {/* Distinction ------------------------------------------------ */}
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-neutral-800">Founding distinction</label>
              <select
                value={distinction}
                onChange={(e) => setDistinction(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              >
                {CONFERRABLE_DISTINCTIONS.map((d) => (
                  <option key={d} value={d}>
                    {DISTINCTION_LABEL[d]}
                  </option>
                ))}
                {/* A retired value already on the profile stays selectable so
                    saving does not silently strip it. */}
                {!CONFERRABLE_DISTINCTIONS.includes(distinction as FounderDistinction) && (
                  <option value={distinction}>
                    {DISTINCTION_LABEL[distinction as FounderDistinction] ?? distinction}
                  </option>
                )}
              </select>
              <p className="mt-1 text-xs text-neutral-500">
                {DISTINCTION_HELP[distinction as FounderDistinction] ?? ""}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-800">Choreographer tier</label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              >
                {CHOREOGRAPHER_TIERS.map((t) => (
                  <option key={t} value={t}>
                    {TIER_LABEL[t]}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-neutral-500">
                Curatorial standing only. No pricing or split logic reads this — Choreo License
                decides the relationship between tier and economics.
              </p>
            </div>
          </div>

          {/* Reason ----------------------------------------------------- */}
          <div className="mt-5">
            <label className="text-sm font-medium text-neutral-800">Reason</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this being conferred, corrected, or withdrawn?"
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-neutral-500">
              Recorded with your name. A conferral without a stated reason is what erodes a trust
              signal over time.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="rounded-lg bg-neutral-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {busy ? "Saving…" : "Save trust signals"}
            </button>
            {profile.public_slug && (
              <a
                href={`/${profile.public_slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-neutral-600 underline"
              >
                View profile ↗
              </a>
            )}
            {msg && (
              <span className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>
                {msg.text}
              </span>
            )}
          </div>

          {/* History ---------------------------------------------------- */}
          <div className="mt-6 border-t border-neutral-200 pt-4">
            <p className="text-sm font-medium text-neutral-800">History</p>
            {history.length === 0 ? (
              <p className="mt-1 text-xs text-neutral-500">
                No recorded changes. Signals seeded at activation are recorded on the profile itself
                (see provenance), not here.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {history.map((e) => (
                  <li key={e.event_id} className="text-xs text-neutral-600">
                    <span className="text-neutral-400">{e.created_at.slice(0, 10)}</span>{" "}
                    <span className="font-medium">{e.field}</span>:{" "}
                    <span className="text-neutral-500">{e.previous_value || "—"}</span> →{" "}
                    <span className="text-neutral-900">{e.new_value || "—"}</span>
                    {e.reason ? <span className="text-neutral-500"> · {e.reason}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {profile.prefilled_from_application_id && (
            <p className="mt-4 text-xs text-neutral-400">
              Seeded from application {profile.prefilled_from_application_id.slice(0, 8)}… at
              activation.
            </p>
          )}
        </div>
      )}
    </li>
  );
}
