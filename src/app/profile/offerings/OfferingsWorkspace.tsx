"use client";

// The "My Offerings" management surface: a polished empty state, the professional's
// offerings as management cards, and the guided builder (add / edit). Save/edit go
// through the saveOffering server action (inside OfferingBuilder); activate,
// deactivate, and delete call their own server actions and let revalidatePath
// refresh this list. No DB terminology, no ids, no raw enum values on screen.

import { useState, useTransition } from "react";
import {
  OFFERING_TYPE_LABEL,
  pricingDisplay,
  type OfferingRow,
} from "@/lib/offerings";
import { setOfferingStatus, deleteOffering } from "@/lib/offerings/actions";
import OfferingBuilder from "./OfferingBuilder";

export default function OfferingsWorkspace({
  initialOfferings,
}: {
  initialOfferings: OfferingRow[];
}) {
  const [view, setView] = useState<"list" | "builder">("list");
  const [editing, setEditing] = useState<OfferingRow | null>(null);

  function openNew() {
    setEditing(null);
    setView("builder");
  }
  function openEdit(o: OfferingRow) {
    setEditing(o);
    setView("builder");
  }

  if (view === "builder") {
    return (
      <OfferingBuilder
        initial={editing}
        onDone={() => {
          setEditing(null);
          setView("list");
        }}
      />
    );
  }

  return (
    <div className="mt-10">
      {initialOfferings.length === 0 ? (
        <EmptyState onAdd={openNew} />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-500">
              {initialOfferings.length} {initialOfferings.length === 1 ? "offering" : "offerings"}
            </p>
            <button
              type="button"
              onClick={openNew}
              className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white"
            >
              Add an Offering
            </button>
          </div>
          <ul className="mt-5 space-y-4">
            {initialOfferings.map((o) => (
              <OfferingCard key={o.id} offering={o} onEdit={() => openEdit(o)} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-6 py-14 text-center">
      <h2 className="text-2xl font-semibold text-neutral-900">This is your space to build.</h2>
      <p className="mx-auto mt-3 max-w-xl text-neutral-600">
        Master classes. Coaching. Editing. Stage management. Creative work. Products. Licensing. Or
        something entirely your own.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-7 rounded-lg bg-neutral-900 px-6 py-3 text-sm font-medium text-white"
      >
        Add an Offering
      </button>
    </div>
  );
}

function OfferingCard({ offering: o, onEdit }: { offering: OfferingRow; onEdit: () => void }) {
  const [pending, start] = useTransition();
  const isLive = o.status === "active";
  const price = pricingDisplay({ priceDisplay: o.price_display, pricingType: o.pricing_type });

  function toggle() {
    start(async () => {
      await setOfferingStatus(o.id, isLive ? "inactive" : "active");
    });
  }
  function remove() {
    if (!window.confirm(`Delete “${o.title}”? This can’t be undone.`)) return;
    start(async () => {
      await deleteOffering(o.id);
    });
  }

  return (
    <li
      className={`flex gap-4 rounded-xl border border-neutral-200 p-4 ${
        pending ? "opacity-50" : ""
      }`}
    >
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-neutral-100 ring-1 ring-neutral-200">
        {o.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={o.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-300">✦</div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-neutral-900">{o.title}</h3>
            <p className="mt-0.5 text-xs font-medium uppercase tracking-[0.1em] text-neutral-500">
              {OFFERING_TYPE_LABEL[o.type]}
              {price ? <span className="text-neutral-400"> · {price}</span> : null}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isLive ? "bg-green-100 text-green-800" : "bg-neutral-100 text-neutral-500"
            }`}
          >
            {isLive ? "Live" : "Hidden"}
          </span>
        </div>

        {o.short_description && (
          <p className="mt-1.5 line-clamp-2 text-sm text-neutral-600">{o.short_description}</p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          <button
            type="button"
            onClick={onEdit}
            className="font-medium text-neutral-800 underline"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={toggle}
            disabled={pending}
            className="font-medium text-neutral-700 underline disabled:opacity-40"
          >
            {isLive ? "Deactivate" : "Publish"}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="text-neutral-400 underline hover:text-red-600 disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      </div>
    </li>
  );
}
