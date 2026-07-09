"use client";

// The interactive admin console. Everything here is client-side and talks to the
// gated /api/admin/* routes with the ADMIN_TOKEN in a header. After each write it
// calls router.refresh() so the server-rendered lists update.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ArtistRow, WorkRow } from "./page";

const TOKEN_KEY = "releve_admin_token";

type Feedback = { kind: "ok" | "err"; text: string } | null;

export default function AdminConsole({
  artists,
  works,
}: {
  artists: ArtistRow[];
  works: WorkRow[];
}) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  // Remember the token locally so it isn't retyped every visit. This one-time
  // read runs in an effect (not a lazy initializer) so the first client render
  // still matches the server's empty value — avoiding a hydration mismatch on a
  // controlled input. The set-state-in-effect lint rule is a perf heuristic that
  // doesn't apply to this SSR-correct pattern.
  useEffect(() => {
    const saved = window.localStorage.getItem(TOKEN_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setToken(saved);
  }, []);
  useEffect(() => {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
  }, [token]);

  async function adminFetch(url: string, method: string, body: unknown) {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
    return data;
  }

  // ---- Artist quick-create ------------------------------------------------
  const [artistName, setArtistName] = useState("");
  const [artistFeedback, setArtistFeedback] = useState<Feedback>(null);

  async function createArtist() {
    setBusy(true);
    setArtistFeedback(null);
    try {
      const data = await adminFetch("/api/admin/artists", "POST", { displayName: artistName });
      setArtistFeedback({ kind: "ok", text: `Created. Profile id: ${data.profileId}` });
      setArtistName("");
      router.refresh();
    } catch (e) {
      setArtistFeedback({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  // ---- Work create --------------------------------------------------------
  const emptyWork = {
    profileId: artists[0]?.profile_id ?? "",
    title: "",
    style: "",
    length_label: "",
    level: "",
    built_for: "",
    priceDollars: "499",
    vimeo_performance_url: "",
    vimeo_breakdown_url: "",
    count_sheet_url: "",
    music_note: "",
    artistic_intent: "",
    status: "draft" as "draft" | "published",
  };
  const [work, setWork] = useState(emptyWork);
  const [workFeedback, setWorkFeedback] = useState<Feedback>(null);

  function setField<K extends keyof typeof work>(key: K, value: (typeof work)[K]) {
    setWork((w) => ({ ...w, [key]: value }));
  }

  async function createWork() {
    setBusy(true);
    setWorkFeedback(null);
    try {
      const price_cents = Math.round(parseFloat(work.priceDollars || "0") * 100);
      const data = await adminFetch("/api/admin/signature-works", "POST", {
        profileId: work.profileId,
        title: work.title,
        style: work.style,
        length_label: work.length_label,
        level: work.level,
        built_for: work.built_for,
        price_cents,
        vimeo_performance_url: work.vimeo_performance_url,
        vimeo_breakdown_url: work.vimeo_breakdown_url,
        count_sheet_url: work.count_sheet_url,
        music_note: work.music_note,
        artistic_intent: work.artistic_intent,
        status: work.status,
      });
      setWorkFeedback({ kind: "ok", text: `Created "${work.title}" (${data.status}).` });
      setWork({ ...emptyWork, profileId: work.profileId });
      router.refresh();
    } catch (e) {
      setWorkFeedback({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  // ---- Publish toggle -----------------------------------------------------
  const [rowFeedback, setRowFeedback] = useState<Feedback>(null);
  async function toggleStatus(w: WorkRow) {
    setBusy(true);
    setRowFeedback(null);
    const next = w.status === "published" ? "draft" : "published";
    try {
      await adminFetch(`/api/admin/signature-works/${w.id}`, "PATCH", { status: next });
      router.refresh();
    } catch (e) {
      setRowFeedback({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";
  const label = "block text-xs font-medium text-neutral-600 mb-1";

  return (
    <div className="mt-10 space-y-12">
      {/* Token ---------------------------------------------------------- */}
      <section>
        <label className={label}>Admin token</label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste your ADMIN_TOKEN"
          className={input}
        />
        <p className="mt-1 text-xs text-neutral-400">
          Must match <code>ADMIN_TOKEN</code> in <code>.env.local</code>. Stored only in your
          browser.
        </p>
      </section>

      {/* Artist quick-create -------------------------------------------- */}
      <section className="rounded-xl border border-neutral-200 p-5">
        <h2 className="text-lg font-semibold text-neutral-900">1 · Add an artist (test)</h2>
        <p className="mt-1 text-sm text-neutral-600">
          A work needs an artist to belong to. This makes a minimal profile for testing.
        </p>
        <div className="mt-4 flex gap-3">
          <input
            value={artistName}
            onChange={(e) => setArtistName(e.target.value)}
            placeholder="Artist display name"
            className={input}
          />
          <button
            onClick={createArtist}
            disabled={busy || !artistName.trim() || !token}
            className="whitespace-nowrap rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Add artist
          </button>
        </div>
        {artistFeedback && (
          <p className={`mt-2 text-sm ${artistFeedback.kind === "ok" ? "text-green-700" : "text-red-600"}`}>
            {artistFeedback.text}
          </p>
        )}
        {artists.length > 0 && (
          <div className="mt-4 space-y-1 text-xs text-neutral-500">
            {artists.map((a) => (
              <div key={a.profile_id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-neutral-700">{a.display_name}</span>
                <code className="rounded bg-neutral-100 px-1">{a.profile_id}</code>
                <span>{a.payouts_enabled ? "· payouts ✓" : "· no payouts (needs Express or founder path)"}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Work create ---------------------------------------------------- */}
      <section className="rounded-xl border border-neutral-200 p-5">
        <h2 className="text-lg font-semibold text-neutral-900">2 · Create a Signature Work</h2>
        {artists.length === 0 ? (
          <p className="mt-2 text-sm text-amber-700">Add an artist first.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={label}>Artist</label>
              <select
                value={work.profileId}
                onChange={(e) => setField("profileId", e.target.value)}
                className={input}
              >
                {artists.map((a) => (
                  <option key={a.profile_id} value={a.profile_id}>
                    {a.display_name} ({a.profile_id.slice(0, 8)}…)
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className={label}>Title *</label>
              <input value={work.title} onChange={(e) => setField("title", e.target.value)} className={input} />
            </div>

            <div>
              <label className={label}>Style</label>
              <input value={work.style} onChange={(e) => setField("style", e.target.value)} className={input} />
            </div>
            <div>
              <label className={label}>Length (e.g. 2 min)</label>
              <input value={work.length_label} onChange={(e) => setField("length_label", e.target.value)} className={input} />
            </div>
            <div>
              <label className={label}>Level</label>
              <input value={work.level} onChange={(e) => setField("level", e.target.value)} className={input} />
            </div>
            <div>
              <label className={label}>Price (USD)</label>
              <input
                type="number"
                min="1"
                step="1"
                value={work.priceDollars}
                onChange={(e) => setField("priceDollars", e.target.value)}
                className={input}
              />
            </div>

            <div className="sm:col-span-2">
              <label className={label}>Built for</label>
              <input value={work.built_for} onChange={(e) => setField("built_for", e.target.value)} className={input} />
            </div>

            <div>
              <label className={label}>Vimeo — performance URL</label>
              <input value={work.vimeo_performance_url} onChange={(e) => setField("vimeo_performance_url", e.target.value)} className={input} />
            </div>
            <div>
              <label className={label}>Vimeo — breakdown URL</label>
              <input value={work.vimeo_breakdown_url} onChange={(e) => setField("vimeo_breakdown_url", e.target.value)} className={input} />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Count sheet URL</label>
              <input value={work.count_sheet_url} onChange={(e) => setField("count_sheet_url", e.target.value)} className={input} />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Music note</label>
              <input value={work.music_note} onChange={(e) => setField("music_note", e.target.value)} className={input} />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Artistic intent</label>
              <textarea
                value={work.artistic_intent}
                onChange={(e) => setField("artistic_intent", e.target.value)}
                rows={3}
                className={input}
              />
            </div>

            <div>
              <label className={label}>Status</label>
              <select
                value={work.status}
                onChange={(e) => setField("status", e.target.value as "draft" | "published")}
                className={input}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={createWork}
                disabled={busy || !work.title.trim() || !work.profileId || !token}
                className="rounded-lg bg-neutral-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                Create work
              </button>
            </div>
          </div>
        )}
        {workFeedback && (
          <p className={`mt-3 text-sm ${workFeedback.kind === "ok" ? "text-green-700" : "text-red-600"}`}>
            {workFeedback.text}
          </p>
        )}
      </section>

      {/* Works list ----------------------------------------------------- */}
      <section>
        <h2 className="text-lg font-semibold text-neutral-900">3 · Works</h2>
        {rowFeedback && <p className="mt-2 text-sm text-red-600">{rowFeedback.text}</p>}
        {works.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No works yet.</p>
        ) : (
          <div className="mt-4 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
            {works.map((w) => (
              <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-neutral-900">{w.title}</p>
                  <p className="text-xs text-neutral-500">
                    {w.artist_name} · ${(w.price_cents / 100).toFixed(0)} ·{" "}
                    <span className={w.status === "published" ? "text-green-700" : "text-amber-700"}>
                      {w.status}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/experiences/${w.id}`}
                    className="text-sm text-neutral-600 underline"
                    target="_blank"
                  >
                    Open page ↗
                  </Link>
                  <button
                    onClick={() => toggleStatus(w)}
                    disabled={busy || !token}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-800 disabled:opacity-40"
                  >
                    {w.status === "published" ? "Unpublish" : "Publish"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
