"use client";

// The vetting queue UI. Client-side; talks to the gated /api/admin/applications/[id]
// route with the ADMIN_TOKEN header, then router.refresh() so the list updates.
// Mirrors the Signature-Works AdminConsole token pattern.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApplicationRow } from "./page";

const TOKEN_KEY = "releve_admin_token";

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
  studio_owner?: { details?: string } | null;
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
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(TOKEN_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setToken(saved);
  }, []);
  useEffect(() => {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
  }, [token]);

  // ---- Filters -------------------------------------------------------------
  const [stateFilter, setStateFilter] = useState("in-review");
  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return applications.filter((a) => {
      if (stateFilter !== "all" && a.state !== stateFilter) return false;
      if (roleFilter && !(a.roles ?? []).includes(roleFilter)) return false;
      if (search) {
        const hay = `${a.first_name ?? ""} ${a.last_name ?? ""} ${a.email} ${a.city ?? ""} ${a.state_province ?? ""}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [applications, stateFilter, roleFilter, search]);

  async function act(id: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
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
      {/* Token */}
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600">Admin token</label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste your ADMIN_TOKEN"
          className={input}
        />
      </div>

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
            tokenSet={!!token}
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

function ApplicationCard({
  app,
  open,
  onToggle,
  busy,
  tokenSet,
  act,
}: {
  app: ApplicationRow;
  open: boolean;
  onToggle: () => void;
  busy: boolean;
  tokenSet: boolean;
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
  const canAct = tokenSet && !busy;

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
                    Approve at tier
                  </button>
                </>
              ) : (
                <button
                  disabled={!canAct}
                  onClick={() => act(app.application_id, { action: "approve" })}
                  className="rounded-lg bg-green-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                >
                  Approve
                </button>
              )}

              <button
                disabled={!canAct}
                onClick={() => {
                  if (confirm("Decline this application? The $30 will be refunded in full.")) {
                    act(app.application_id, { action: "decline" });
                  }
                }}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 disabled:opacity-40"
              >
                Decline (refunds $30)
              </button>
            </div>

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
