"use client";

// The vetting queue UI. Client-side; talks to the gated /api/admin/applications/[id]
// route, then router.refresh() so the list updates.
//
// ── 2026-07-22: the admin-token box is gone ──
// There used to be a password field here, and EVERY action button was disabled
// until a 48-character secret from a local dotfile was pasted into it. Signed in
// as a real admin, you could read the queue and act on none of it. The route now
// checks the session instead (src/lib/admin-auth.ts), so if you can see this
// page you can use it.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { STUDENT_COUNT_LABELS } from "@/lib/studio/profile";
import type { ApplicationRow } from "./page";

// Editorial honorifics (build spec §13) — conferred by the admin, never self-selected.
const HONORIFICS = [
  "Verified Artist",
  "Founding Artist",
  "Master Teacher",
  "Stage Doors Educator",
  "Adaptive Arts Faculty",
];
// Choreographer marketplace tiers an admin may assign ("featured" retired; "signature" = Founding 25).
const TIERS = ["emerging", "established", "signature"];

const STATE_LABEL: Record<string, string> = {
  draft: "Draft (unpaid)",
  submitted: "Submitted (fee pending)",
  "in-review": "In review",
  approved: "Approved",
  "more-info": "More info requested",
  declined: "Declined",
};

type Ans = {
  identity?: { mobile?: string; country?: string; age_range?: string };
  story?: { bio?: string; years_experience?: string };
  industry?: { studios_companies?: string; notable_credits?: string; unions?: string[]; certifications?: string; degrees?: string[] };
  teaching?: { philosophy?: string; levels?: string[]; styles?: string[]; adaptive_experience?: string; available_to_sub?: string; currently_teaching?: string } | null;
  studio_owner?: { details?: string; student_count_band?: string } | null;
  choreographer?: { focus_areas?: string[]; years?: string; available_to_license?: string; work_links?: string[] } | null;
  working_dancer?: { training?: string; performance?: string; auditioning_for?: string[] } | null;
  references?: Array<{ name?: string; contact?: string; relationship?: string }>;
  work_authorization?: string;
  digital_presence?: Record<string, string>;
  alignment?: { prompt_1?: string; prompt_2?: string };
  open_to?: string[];
};

export default function ApplicationsConsole({ applications }: { applications: ApplicationRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  /**
   * What just happened to each application, so the console can CONFIRM an action
   * instead of silently swallowing it.
   *
   * Without this, approving looked like nothing happened: the request succeeded,
   * `router.refresh()` ran, and the row simply vanished — because the default
   * filter is "in-review" and the application had just become "approved". A card
   * disappearing reads as a glitch, not a confirmation.
   */
  const [done, setDone] = useState<Record<string, string>>({});

  // ---- Filters -------------------------------------------------------------
  const [stateFilter, setStateFilter] = useState("in-review");
  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return applications.filter((a) => {
      // Keep anything just acted on visible, whatever the filter says, so the
      // confirmation can actually be seen. Otherwise approving makes the row
      // disappear and the action looks like it failed.
      if (done[a.application_id]) return true;
      if (stateFilter !== "all" && a.state !== stateFilter) return false;
      if (roleFilter && !(a.roles ?? []).includes(roleFilter)) return false;
      if (search) {
        const hay = `${a.first_name ?? ""} ${a.last_name ?? ""} ${a.email} ${a.city ?? ""} ${a.state_province ?? ""}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [applications, stateFilter, roleFilter, search, done]);

  async function act(id: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/applications/${id}`, {
        method: "PATCH",
        // No token header — the route reads the signed-in session. Same-origin
        // fetch sends the auth cookie automatically.
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);

      const action = (body as { action?: string }).action;
      setDone((prev) => ({ ...prev, [id]: describeOutcome(action, data) }));
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";

  return (
    <div className="mt-8 space-y-6">
      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className={input}>
          <option value="in-review">In review</option>
          <option value="submitted">Submitted (fee pending)</option>
          <option value="more-info">More info requested</option>
          <option value="approved">Approved</option>
          <option value="declined">Declined</option>
          <option value="all">All</option>
        </select>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={input}>
          <option value="">All roles</option>
          <option value="teacher">Teacher</option>
          <option value="choreographer">Choreographer</option>
          <option value="working_dancer">Working Dancer</option>
          <option value="studio_owner">Studio Owner</option>
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name / email / location"
          className={input}
        />
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <p className="text-sm text-neutral-500">
        {filtered.length} application{filtered.length === 1 ? "" : "s"}
      </p>

      {/* Queue */}
      <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
        {filtered.length === 0 && <p className="p-6 text-sm text-neutral-500">Nothing here.</p>}
        {filtered.map((a) => (
          <ApplicationCard
            key={a.application_id}
            app={a}
            open={expanded === a.application_id}
            onToggle={() => setExpanded(expanded === a.application_id ? null : a.application_id)}
            busy={busy}
            outcome={done[a.application_id] ?? null}
            act={act}
          />
        ))}
      </div>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "green" | "amber" | "neutral" | "red" }) {
  const cls = {
    green: "bg-green-100 text-green-800",
    amber: "bg-amber-100 text-amber-800",
    neutral: "bg-neutral-100 text-neutral-700",
    red: "bg-red-100 text-red-700",
  }[tone];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

function LinkList({ links }: { links: Array<[string, string]> }) {
  const real = links.filter(([, v]) => v && v.trim());
  if (real.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {real.map(([label, url]) => (
        <a
          key={label}
          href={/^https?:\/\//.test(url) ? url : `https://${url.replace(/^@/, "instagram.com/")}`}
          target="_blank"
          rel="noreferrer"
          className="text-blue-700 underline"
        >
          {label} ↗
        </a>
      ))}
    </div>
  );
}

/**
 * Turn an API response into a sentence the admin can trust.
 *
 * Deliberately reports the SIDE EFFECT, not just the state change — approving
 * now also grants a complimentary founding membership, and if that silently
 * failed while the approval succeeded, you would want to know immediately
 * rather than when the member emails asking why they're locked out.
 */
function describeOutcome(action: string | undefined, data: Record<string, unknown>): string {
  if (action === "approve") {
    const fm = data.foundingMembership;
    if (fm && typeof fm === "object" && "until" in fm) {
      // No date, matching the member-facing copy (2026-07-21).
      return "Approved ✓ — complimentary membership granted. Welcome email sent.";
    }
    if (fm === "already_active") return "Approved ✓ — they already had an active membership.";
    return "Approved ✓ — but NO membership was granted. Check the server log.";
  }
  if (action === "decline") return "Declined — the 'not right now' email has been sent.";
  if (action === "request_info") return "More info requested — email sent.";
  if (action === "honorifics") return "Honorifics saved.";
  return "Done.";
}

function ApplicationCard({
  app,
  open,
  onToggle,
  busy,
  outcome,
  act,
}: {
  app: ApplicationRow;
  open: boolean;
  onToggle: () => void;
  busy: boolean;
  /** Set once this application has been acted on — replaces the buttons. */
  outcome: string | null;
  act: (id: string, body: unknown) => Promise<void>;
}) {
  const ans = (app.answers ?? {}) as Ans;
  const isChoreographer = (app.roles ?? []).includes("choreographer");
  const [tier, setTier] = useState("emerging");
  const [note, setNote] = useState("");
  const [honorifics, setHonorifics] = useState<Set<string>>(new Set(app.honorifics ?? []));

  const name = `${app.first_name ?? ""} ${app.last_name ?? ""}`.trim() || app.email;
  const feeTone = app.fee_status === "paid" ? "green" : app.fee_status === "refunded" ? "red" : app.fee_status === "waived" ? "neutral" : "amber";
  const dp = ans.digital_presence ?? {};
  const canAct = !busy;

  return (
    <div className="p-4">
      {/* Header row */}
      <button onClick={onToggle} className="flex w-full flex-wrap items-center justify-between gap-3 text-left">
        <div>
          <p className="font-medium text-neutral-900">
            {name}{" "}
            {app.is_founding_25 && <span className="text-amber-600">· Founding 25</span>}
          </p>
          <p className="text-xs text-neutral-500">
            {(app.roles ?? []).join(", ") || "—"} · {app.city ?? "?"}
            {app.state_province ? `, ${app.state_province}` : ""} · {app.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="neutral">{STATE_LABEL[app.state] ?? app.state}</Badge>
          <Badge tone={feeTone}>fee: {app.fee_status ?? "none"}</Badge>
          {app.approved_tier && <Badge tone="green">{app.approved_tier}</Badge>}
          <span className="text-neutral-400">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {/* Full submission + actions */}
      {open && (
        <div className="mt-4 space-y-4 border-t border-neutral-100 pt-4">
          {/* Media preview */}
          {dp.headshot_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dp.headshot_url} alt="Headshot" className="h-28 w-28 rounded-lg object-cover" />
          )}

          <Detail label="Story">{ans.story?.bio}</Detail>
          <Detail label="Years experience">{ans.story?.years_experience}</Detail>
          <Detail label="Studios / companies">{ans.industry?.studios_companies}</Detail>
          <Detail label="Notable credits">{ans.industry?.notable_credits}</Detail>
          <Detail label="Certifications">{ans.industry?.certifications}</Detail>
          {ans.industry?.unions?.length ? <Detail label="Unions">{ans.industry.unions.join(", ")}</Detail> : null}
          {ans.industry?.degrees?.length ? <Detail label="Degrees">{ans.industry.degrees.join(", ")}</Detail> : null}

          {ans.teaching && (
            <>
              <Detail label="Teaching philosophy">{ans.teaching.philosophy}</Detail>
              <Detail label="Teaches levels">{(ans.teaching.levels ?? []).join(", ")}</Detail>
              <Detail label="Teaches styles">{(ans.teaching.styles ?? []).join(", ")}</Detail>
            </>
          )}
          {ans.choreographer && (
            <>
              <Detail label="Choreographs">{(ans.choreographer.focus_areas ?? []).join(", ")}</Detail>
              <LinkList links={(ans.choreographer.work_links ?? []).map((u, i) => [`Work ${i + 1}`, u])} />
            </>
          )}
          {/* Studio owners were TYPED but never rendered here — Kathleen
              approved a studio application on 2026-07-23 without being shown a
              single word of what they wrote. An employer is exactly who you
              most need to read before saying yes. */}
          {ans.studio_owner && (
            <>
              <Detail label="Their studio">{ans.studio_owner.details}</Detail>
              <Detail label="Students">
                {ans.studio_owner.student_count_band
                  ? STUDENT_COUNT_LABELS[
                      ans.studio_owner.student_count_band as keyof typeof STUDENT_COUNT_LABELS
                    ] ?? ans.studio_owner.student_count_band
                  : undefined}
              </Detail>
            </>
          )}
          {ans.working_dancer && <Detail label="Performance">{ans.working_dancer.performance}</Detail>}
          <Detail label="Relevé alignment">{[ans.alignment?.prompt_1, ans.alignment?.prompt_2].filter(Boolean).join(" · ")}</Detail>
          {ans.open_to?.length ? <Detail label="Open to">{ans.open_to.join(", ")}</Detail> : null}

          <div>
            <p className="mb-1 text-xs font-medium text-neutral-500">Links (private references are not shown publicly)</p>
            <LinkList
              links={[
                ["Website", dp.website ?? ""],
                ["Instagram", dp.instagram ?? ""],
                ["Vimeo", dp.vimeo ?? ""],
                ["YouTube", dp.youtube ?? ""],
                ["LinkedIn", dp.linkedin ?? ""],
                ["Résumé", dp.resume_url ?? ""],
                ["Teaching reel", dp.teaching_reel ?? ""],
                ["Choreography reel", dp.choreography_reel ?? ""],
                ["Performance reel", dp.performance_reel ?? ""],
              ]}
            />
          </div>

          {/* Actions */}
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Decision</p>

            {/* Once acted on, the buttons are replaced by what actually happened
                — not left live and identical, which is what made the old console
                look like it had ignored the click. */}
            {outcome ? (
              <div className="mt-3 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
                <span className="font-medium">{outcome}</span>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {isChoreographer ? (
                  <>
                    <select value={tier} onChange={(e) => setTier(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm">
                      {TIERS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <button
                      disabled={!canAct}
                      onClick={() => act(app.application_id, { action: "approve", tier })}
                      className="rounded-lg bg-green-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                    >
                      {busy ? "Approving…" : "Approve at tier"}
                    </button>
                  </>
                ) : (
                  <button
                    disabled={!canAct}
                    onClick={() => act(app.application_id, { action: "approve" })}
                    className="rounded-lg bg-green-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                  >
                    {busy ? "Approving…" : "Approve"}
                  </button>
                )}

                <button
                  disabled={!canAct}
                  onClick={() => {
                    if (confirm("Decline this application? We'll email them a 'not right now'.")) {
                      act(app.application_id, { action: "decline" });
                    }
                  }}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 disabled:opacity-40"
                >
                  Decline
                </button>
              </div>
            )}

            {/* Request more info */}
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What do you need from them?"
                className="min-w-[220px] flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
              />
              <button
                disabled={!canAct}
                onClick={() => act(app.application_id, { action: "request_info", note })}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-800 disabled:opacity-40"
              >
                Request more info
              </button>
            </div>

            {/* Honorifics */}
            <div className="mt-4">
              <p className="text-xs font-medium text-neutral-500">Honorifics (editorial — conferred by you)</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {HONORIFICS.map((h) => {
                  const on = honorifics.has(h);
                  return (
                    <button
                      key={h}
                      onClick={() =>
                        setHonorifics((prev) => {
                          const next = new Set(prev);
                          if (next.has(h)) next.delete(h);
                          else next.add(h);
                          return next;
                        })
                      }
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        on ? "bg-amber-200 text-amber-900" : "bg-white text-neutral-600 ring-1 ring-neutral-300"
                      }`}
                    >
                      {h}
                    </button>
                  );
                })}
                <button
                  disabled={!canAct}
                  onClick={() => act(app.application_id, { action: "honorifics", honorifics: Array.from(honorifics) })}
                  className="rounded-lg border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-800 disabled:opacity-40"
                >
                  Save honorifics
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  if (!children || (typeof children === "string" && !children.trim())) return null;
  return (
    <div>
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="whitespace-pre-wrap text-sm text-neutral-800">{children}</p>
    </div>
  );
}
