"use client";

// The decision controls for one org's review page (studio or Dance Team).
// Approve and Publish are two DISTINCT steps (same as before) — they just live
// here now, AFTER the admin has read the submission, instead of blind in the
// list. Each hits the existing gated /api/admin/studios/[id] PATCH route, then
// refreshes so the page reflects the new status (Approve → the Publish button
// appears). Notice/help copy branches on `orgType` via the shared `orgCopy()`
// helper (fix, 2026-09-01) — never a second copy system.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { orgCopy } from "@/lib/studio/org-copy";

export default function ReviewActions({
  employerId,
  status,
  orgType,
}: {
  employerId: string;
  status: string;
  orgType?: string | null;
}) {
  const copy = orgCopy(orgType);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function act(action: "approve" | "publish" | "unpublish") {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/studios/${employerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ ok: false, text: data.error ?? `Could not ${action}.` });
      } else {
        setNotice({ ok: true, text: `${copy.Noun} is now "${data.status}".` });
        router.refresh();
      }
    } catch {
      setNotice({ ok: false, text: "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {status === "submitted" && (
          <button
            onClick={() => act("approve")}
            disabled={busy}
            className="rounded-lg border border-sky-400 bg-sky-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? "Working…" : "Approve"}
          </button>
        )}
        {status === "approved" && (
          <button
            onClick={() => act("publish")}
            disabled={busy}
            className="rounded-lg border border-green-500 bg-green-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? "Working…" : "Publish — make public"}
          </button>
        )}
        {status === "live" && (
          <button
            onClick={() => act("unpublish")}
            disabled={busy}
            className="rounded-lg border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-700 disabled:opacity-40"
          >
            {busy ? "Working…" : "Unpublish"}
          </button>
        )}
      </div>
      {status === "approved" && (
        <p className="mt-2 text-xs text-neutral-500">
          Approved. Publishing is a separate, deliberate step — it&apos;s the only thing that makes
          the {copy.noun} public.
        </p>
      )}
      {notice && (
        <p className={`mt-3 text-sm ${notice.ok ? "text-green-700" : "text-red-600"}`}>{notice.text}</p>
      )}
    </div>
  );
}
