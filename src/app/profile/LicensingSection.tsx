"use client";

// Licensing on the professional home: the "Available for Licensing" toggle
// (mirrors SwingToggle — a live ON/OFF capability) plus, when ON, the "Works
// Available to License" manager. Kept as one client block so flipping the toggle
// reveals the works area without a server round-trip, and so both share state.
//
// The artist can Add a Work (creates a DRAFT — never auto-publishes), edit while
// draft/returned, submit for review, and withdraw a submission. Only APPROVED
// work is shown publicly (enforced on the public page + in RLS). The status
// machine is enforced server-side; this UI only offers legal actions.

import { useState, useTransition } from "react";
import {
  WORK_ORIGIN_OPTIONS,
  WORK_ORIGIN_LABEL,
  WORK_STATUS_LABEL,
  WORK_TYPE_OPTIONS,
  WORK_TYPE_LABEL,
  workTypeLabel,
  type WorkInput,
  type WorkRecord,
  type WorkStatus,
} from "@/lib/professional/licensing";
import {
  addWork,
  setAvailableForLicensing,
  submitWork,
  updateWork,
  withdrawWork,
} from "./licensing-actions";

const INPUT =
  "w-full rounded-[0.6rem] border border-[var(--rc-line)] bg-[var(--rc-cream)] px-2.5 py-2 text-[13.5px] text-[var(--rc-ink)] focus:border-[var(--rc-gold)] focus:outline-none";

const CHIP: Record<WorkStatus, string> = {
  draft: "bg-[var(--rc-cream-soft)] text-[var(--rc-taupe)]",
  submitted: "bg-[#eef2ff] text-[#3f4a86]",
  in_review: "bg-[#fbf5e7] text-[var(--rc-gold-deep)]",
  returned: "bg-[#fdf0e6] text-[#a1571f]",
  approved: "bg-[#eaf5ec] text-[#2f6d43]",
  declined: "bg-[#fbebeb] text-[#9a3b3b]",
};

const EMPTY: WorkInput = {
  title: "",
  work_type: "",
  style: "",
  cast_size: "",
  duration: "",
  level_audience: "",
  year_created: null,
  description: "",
  preview_video_url: "",
  origin: "",
  license_type: "",
};

function toInput(w: WorkRecord): WorkInput {
  return {
    title: w.title ?? "",
    work_type: w.work_type ?? "",
    style: w.style ?? "",
    cast_size: w.cast_size ?? "",
    duration: w.duration ?? "",
    level_audience: w.level_audience ?? "",
    year_created: w.year_created,
    description: w.description ?? "",
    preview_video_url: w.preview_video_url ?? "",
    origin: w.origin ?? "",
    license_type: w.license_type ?? "",
  };
}

export default function LicensingSection({
  initialOn,
  initialWorks,
}: {
  initialOn: boolean;
  initialWorks: WorkRecord[];
}) {
  const [on, setOn] = useState(initialOn);
  const [works, setWorks] = useState<WorkRecord[]>(initialWorks);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next); // optimistic
    startTransition(async () => {
      const res = await setAvailableForLicensing(next);
      if (!res.ok) setOn(!next);
    });
  }

  function upsertLocal(work: WorkRecord) {
    setWorks((prev) => {
      const i = prev.findIndex((w) => w.work_id === work.work_id);
      if (i === -1) return [work, ...prev];
      const copy = prev.slice();
      copy[i] = work;
      return copy;
    });
  }

  return (
    <section>
      {/* ── Toggle (styled like SwingToggle) ─────────────────────────────── */}
      <div className="mt-4 flex items-center justify-between gap-4 border-y border-[var(--rc-line)] py-4">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--rc-ink)]">
            Available for licensing
          </div>
          {on ? (
            <div className="mt-1 inline-flex items-center gap-1.5 text-[12.5px] text-[var(--rc-gold-deep)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--rc-gold)]" />
              Your approved works can be discovered for licensing
            </div>
          ) : (
            <div className="mt-1 text-[12.5px] text-[var(--rc-taupe)]">
              Not currently offering works to license
            </div>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Available for licensing"
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

      {/* ── Works manager (only when ON) ─────────────────────────────────── */}
      {on && (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2.5 text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--rc-taupe-light)]">
              <span className="h-px w-3.5 bg-[var(--rc-gold)] opacity-85" />
              Works available to license
            </h3>
            {!adding && !editingId && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="rounded-full border border-[#d8cbac] px-4 py-1.5 text-[13px] font-medium text-[var(--rc-ink)] transition-colors hover:bg-[var(--rc-cream-soft)]"
              >
                + Add a work
              </button>
            )}
          </div>

          <p className="mt-2 text-[12.5px] text-[var(--rc-taupe)]">
            Add a work as a draft, then submit it for review. A Relevé reviewer approves each
            work before it appears on your public profile. Transactions are coming soon.
          </p>

          {/* Add form */}
          {adding && (
            <WorkForm
              initial={EMPTY}
              busy={pending}
              onCancel={() => setAdding(false)}
              onSave={(input) =>
                startTransition(async () => {
                  const res = await addWork(input);
                  if (res.ok && res.work) {
                    upsertLocal(res.work);
                    setAdding(false);
                  }
                })
              }
            />
          )}

          {/* List */}
          <div className="mt-4 space-y-3">
            {works.length === 0 && !adding && (
              <div className="rounded-2xl border border-dashed border-[var(--rc-line)] bg-[var(--rc-cream-panel)] px-6 py-8 text-center">
                <p className="font-serif text-lg text-[var(--rc-ink)]">No works yet.</p>
                <p className="mx-auto mt-1 max-w-sm text-[13px] text-[var(--rc-taupe)]">
                  Add your first piece to begin. It stays private until you submit it and a
                  reviewer approves it.
                </p>
              </div>
            )}

            {works.map((w) =>
              editingId === w.work_id ? (
                <WorkForm
                  key={w.work_id}
                  initial={toInput(w)}
                  busy={pending}
                  onCancel={() => setEditingId(null)}
                  onSave={(input) =>
                    startTransition(async () => {
                      const res = await updateWork(w.work_id, input);
                      if (res.ok && res.work) {
                        upsertLocal(res.work);
                        setEditingId(null);
                      }
                    })
                  }
                />
              ) : (
                <WorkCard
                  key={w.work_id}
                  work={w}
                  busy={pending}
                  onEdit={() => setEditingId(w.work_id)}
                  onSubmit={() =>
                    startTransition(async () => {
                      const res = await submitWork(w.work_id);
                      if (res.ok && res.work) upsertLocal(res.work);
                    })
                  }
                  onWithdraw={() =>
                    startTransition(async () => {
                      const res = await withdrawWork(w.work_id);
                      if (res.ok && res.work) upsertLocal(res.work);
                    })
                  }
                />
              ),
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/* ─────────────────────────────  A work row  ──────────────────────────────── */

function WorkCard({
  work,
  busy,
  onEdit,
  onSubmit,
  onWithdraw,
}: {
  work: WorkRecord;
  busy: boolean;
  onEdit: () => void;
  onSubmit: () => void;
  onWithdraw: () => void;
}) {
  const meta = [
    workTypeLabel(work.work_type),
    work.style,
    work.duration,
    work.year_created ? String(work.year_created) : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  const editable = work.status === "draft" || work.status === "returned";

  return (
    <div className="rounded-2xl border border-[var(--rc-line)] bg-[var(--rc-cream-panel)] px-5 py-4 shadow-[0_1px_2px_rgba(20,17,11,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-serif text-[19px] font-medium text-[var(--rc-ink)]">{work.title}</h4>
          {meta && <p className="mt-0.5 text-[13px] text-[var(--rc-taupe)]">{meta}</p>}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.12em] ${CHIP[work.status]}`}
        >
          {WORK_STATUS_LABEL[work.status]}
        </span>
      </div>

      {/* Reviewer note on returned/declined. */}
      {(work.status === "returned" || work.status === "declined") && work.review_notes && (
        <p className="mt-3 rounded-lg bg-[var(--rc-cream-soft)] px-3 py-2 text-[12.5px] text-[var(--rc-ink-soft)]">
          <span className="font-medium">Reviewer note:</span> {work.review_notes}
        </p>
      )}

      {work.status === "approved" && (
        <p className="mt-2 text-[12.5px] text-[#2f6d43]">Live on your public profile.</p>
      )}
      {work.status === "in_review" && (
        <p className="mt-2 text-[12.5px] text-[var(--rc-gold-deep)]">A reviewer is looking at this.</p>
      )}

      {/* Actions available in this state. */}
      <div className="mt-3 flex flex-wrap gap-2">
        {editable && (
          <>
            <button
              type="button"
              onClick={onEdit}
              disabled={busy}
              className="rounded-full border border-[#d8cbac] px-4 py-1.5 text-[12.5px] font-medium text-[var(--rc-ink)] transition-colors hover:bg-[var(--rc-cream-soft)] disabled:opacity-60"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={busy}
              className="rounded-full bg-[var(--rc-ink)] px-4 py-1.5 text-[12.5px] font-medium text-[var(--rc-cream)] transition-colors hover:bg-black disabled:opacity-60"
            >
              Submit for review
            </button>
          </>
        )}
        {work.status === "submitted" && (
          <button
            type="button"
            onClick={onWithdraw}
            disabled={busy}
            className="rounded-full border border-[#d8cbac] px-4 py-1.5 text-[12.5px] font-medium text-[var(--rc-ink)] transition-colors hover:bg-[var(--rc-cream-soft)] disabled:opacity-60"
          >
            Withdraw
          </button>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────  Add/Edit form  ───────────────────────────── */

function WorkForm({
  initial,
  busy,
  onSave,
  onCancel,
}: {
  initial: WorkInput;
  busy: boolean;
  onSave: (input: WorkInput) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<WorkInput>(initial);
  const set = (k: keyof WorkInput, v: string) =>
    setForm(
      (f) =>
        ({
          ...f,
          [k]: k === "year_created" ? (v === "" ? null : Number(v)) : v,
        }) as WorkInput,
    );
  const titleOk = (form.title ?? "").trim().length > 0;

  return (
    <div className="mt-4 rounded-2xl border border-[var(--rc-line)] bg-[var(--rc-cream-panel)] px-5 py-5 shadow-[0_1px_2px_rgba(20,17,11,0.05)]">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Title" required className="sm:col-span-2">
          <input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            className={INPUT}
            placeholder="e.g. Ashes in the Wind"
          />
        </Field>

        <Field label="Type">
          <select value={form.work_type ?? ""} onChange={(e) => set("work_type", e.target.value)} className={INPUT}>
            <option value="">—</option>
            {WORK_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {WORK_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Origin">
          <select value={form.origin ?? ""} onChange={(e) => set("origin", e.target.value)} className={INPUT}>
            <option value="">—</option>
            {WORK_ORIGIN_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {WORK_ORIGIN_LABEL[o]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Style">
          <input value={form.style ?? ""} onChange={(e) => set("style", e.target.value)} className={INPUT} placeholder="Contemporary" />
        </Field>
        <Field label="Cast size">
          <input value={form.cast_size ?? ""} onChange={(e) => set("cast_size", e.target.value)} className={INPUT} placeholder="e.g. 8 dancers" />
        </Field>
        <Field label="Duration">
          <input value={form.duration ?? ""} onChange={(e) => set("duration", e.target.value)} className={INPUT} placeholder="1:45" />
        </Field>
        <Field label="Level / audience">
          <input value={form.level_audience ?? ""} onChange={(e) => set("level_audience", e.target.value)} className={INPUT} placeholder="Advanced / pre-professional" />
        </Field>
        <Field label="Year created">
          <input
            value={form.year_created ?? ""}
            onChange={(e) => set("year_created", e.target.value)}
            inputMode="numeric"
            className={INPUT}
            placeholder="2024"
          />
        </Field>
        <Field label="Preview video URL">
          <input value={form.preview_video_url ?? ""} onChange={(e) => set("preview_video_url", e.target.value)} className={INPUT} placeholder="https://vimeo.com/…" />
        </Field>

        <Field label="Description" className="sm:col-span-2">
          <textarea
            value={form.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
            rows={3}
            className={INPUT}
            placeholder="What the piece is, its mood, what makes it license-worthy."
          />
        </Field>
        <Field label="Licensing note" className="sm:col-span-2">
          <input
            value={form.license_type ?? ""}
            onChange={(e) => set("license_type", e.target.value)}
            className={INPUT}
            placeholder="e.g. non-exclusive; music is the licensee's responsibility"
          />
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={busy || !titleOk}
          className="rounded-full bg-[var(--rc-ink)] px-5 py-2 text-[13px] font-medium text-[var(--rc-cream)] transition-colors hover:bg-black disabled:opacity-60"
        >
          Save draft
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-full border border-[#d8cbac] px-5 py-2 text-[13px] font-medium text-[var(--rc-ink)] transition-colors hover:bg-[var(--rc-cream-soft)] disabled:opacity-60"
        >
          Cancel
        </button>
        {!titleOk && <span className="text-[12px] text-[var(--rc-taupe-light)]">A title is required.</span>}
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--rc-taupe-light)]">
        {label}
        {required && <span className="text-[var(--rc-gold-deep)]"> *</span>}
      </span>
      {children}
    </label>
  );
}
