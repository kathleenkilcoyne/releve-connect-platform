"use client";

// The admin licensing review console. Lists submitted / in-review works and
// moves each through the lifecycle. A work leaves the queue when it's approved,
// returned, or declined; "Start review" keeps it here (now in-review). Return
// and Decline capture a note the artist will see.

import { useState, useTransition } from "react";
import Link from "next/link";
import { workTypeLabel, WORK_STATUS_LABEL } from "@/lib/professional/licensing";
import { reviewWork } from "./actions";
import type { QueueWork } from "./page";

export default function LicensingQueue({ works }: { works: QueueWork[] }) {
  const [rows, setRows] = useState<QueueWork[]>(works);
  const [pending, startTransition] = useTransition();

  function act(workId: string, action: "start_review" | "approve" | "return" | "decline", note?: string) {
    startTransition(async () => {
      const res = await reviewWork(workId, action, note);
      if (!res.ok || !res.work) return;
      const next = res.work.status;
      setRows((prev) =>
        next === "submitted" || next === "in_review"
          ? prev.map((r) => (r.work_id === workId ? { ...r, status: next } : r))
          : prev.filter((r) => r.work_id !== workId),
      );
    });
  }

  if (rows.length === 0) {
    return (
      <div className="mt-10 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-6 py-14 text-center">
        <p className="text-lg font-medium text-neutral-800">The queue is clear.</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
          Nothing is waiting for review right now.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4">
      {rows.map((w) => (
        <QueueRow key={w.work_id} work={w} busy={pending} onReview={(a, note) => act(w.work_id, a, note)} />
      ))}
    </div>
  );
}

function QueueRow({
  work,
  busy,
  onReview,
}: {
  work: QueueWork;
  busy: boolean;
  onReview: (action: "start_review" | "approve" | "return" | "decline", note?: string) => void;
}) {
  const [mode, setMode] = useState<"return" | "decline" | null>(null);
  const [note, setNote] = useState("");

  const meta = [
    workTypeLabel(work.work_type),
    work.style,
    work.cast_size,
    work.duration,
    work.level_audience,
    work.year_created ? String(work.year_created) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">{work.title}</h3>
          <p className="mt-0.5 text-sm text-neutral-500">
            {work.artistSlug ? (
              <Link href={`/${work.artistSlug}`} className="underline" target="_blank">
                {work.artistName}
              </Link>
            ) : (
              work.artistName
            )}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600">
          {WORK_STATUS_LABEL[work.status]}
        </span>
      </div>

      {meta && <p className="mt-2 text-sm text-neutral-600">{meta}</p>}
      {work.description && (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-neutral-700">
          {work.description}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
        {work.preview_video_url && (
          <a
            href={work.preview_video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-neutral-800 underline"
          >
            Watch preview ↗
          </a>
        )}
        {work.license_type && <span className="text-neutral-500">{work.license_type}</span>}
      </div>

      {/* Note box for return / decline. */}
      {mode && (
        <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
            {mode === "return" ? "What should the artist change?" : "Reason (shared with the artist)"}
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            placeholder="A short, specific note."
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                onReview(mode, note);
                setMode(null);
                setNote("");
              }}
              className="rounded-lg bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
            >
              Confirm {mode === "return" ? "return" : "decline"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setMode(null);
                setNote("");
              }}
              className="rounded-lg border border-neutral-300 px-4 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Primary actions. */}
      {!mode && (
        <div className="mt-4 flex flex-wrap gap-2">
          {work.status === "submitted" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onReview("start_review")}
              className="rounded-lg border border-neutral-300 px-4 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-60"
            >
              Start review
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => onReview("approve")}
            className="rounded-lg bg-emerald-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setMode("return")}
            className="rounded-lg border border-amber-300 px-4 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-60"
          >
            Return for changes
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setMode("decline")}
            className="rounded-lg border border-red-300 px-4 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            Decline
          </button>
        </div>
      )}
    </div>
  );
}
