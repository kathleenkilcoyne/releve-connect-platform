"use client";

// The "Professional Services" management surface: an empty state, the member's
// services as management cards, and the builder (add / edit). Save/edit go
// through the saveService server action (inside ServiceBuilder); show, hide, and
// delete call their own server actions and let revalidatePath refresh this list.
//
// Mirrors OfferingsWorkspace so the two surfaces feel like one product. No DB
// terminology, no ids, no raw enum values on screen.

import { useState, useTransition } from "react";
import { categoryLabel, locationLine, type ServiceRow } from "@/lib/services";
import { setServiceStatus, deleteService } from "@/lib/services/actions";
import ServiceBuilder from "./ServiceBuilder";

export default function ServicesWorkspace({
  initialServices,
}: {
  initialServices: ServiceRow[];
}) {
  const [view, setView] = useState<"list" | "builder">("list");
  const [editing, setEditing] = useState<ServiceRow | null>(null);

  function openNew() {
    setEditing(null);
    setView("builder");
  }
  function openEdit(s: ServiceRow) {
    setEditing(s);
    setView("builder");
  }

  if (view === "builder") {
    return (
      <ServiceBuilder
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
      {initialServices.length === 0 ? (
        <EmptyState onAdd={openNew} />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-500">
              {initialServices.length} {initialServices.length === 1 ? "service" : "services"}
            </p>
            <button
              type="button"
              onClick={openNew}
              className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white"
            >
              + Add Professional Service
            </button>
          </div>
          <ul className="mt-5 space-y-4">
            {initialServices.map((s) => (
              <ServiceCard key={s.id} service={s} onEdit={() => openEdit(s)} />
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
      <h2 className="text-2xl font-semibold text-neutral-900">
        You’re more than one thing.
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-neutral-600">
        Massage therapy. Physical therapy. Pilates. Photography. Costume design. Music editing.
        Accompanists / Class Musicians. If you run it, the dance community should be able to find
        it.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-7 rounded-lg bg-neutral-900 px-6 py-3 text-sm font-medium text-white"
      >
        + Add Professional Service
      </button>
      <p className="mt-4 text-xs text-neutral-400">
        Entirely optional — your Relevé profile is complete without it.
      </p>
    </div>
  );
}

function ServiceCard({ service: s, onEdit }: { service: ServiceRow; onEdit: () => void }) {
  const [pending, start] = useTransition();
  const isShown = s.status === "active";
  const where = locationLine(s.location, s.service_type);

  function toggle() {
    start(async () => {
      await setServiceStatus(s.id, isShown ? "hidden" : "active");
    });
  }
  function remove() {
    if (!window.confirm(`Delete “${s.business_name}”? This can’t be undone.`)) return;
    start(async () => {
      await deleteService(s.id);
    });
  }

  return (
    <li
      className={`flex gap-4 rounded-xl border border-neutral-200 p-4 ${
        pending ? "opacity-50" : ""
      }`}
    >
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-neutral-100 ring-1 ring-neutral-200">
        {s.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-300">✦</div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-neutral-900">{s.business_name}</h3>
            <p className="mt-0.5 text-xs font-medium uppercase tracking-[0.1em] text-neutral-500">
              {categoryLabel(s.category, s.category_other_label)}
              {where ? <span className="text-neutral-400"> · {where}</span> : null}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isShown ? "bg-green-100 text-green-800" : "bg-neutral-100 text-neutral-500"
            }`}
          >
            {isShown ? "On my profile" : "Hidden"}
          </span>
        </div>

        {s.short_description && (
          <p className="mt-1.5 line-clamp-2 text-sm text-neutral-600">{s.short_description}</p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          <button type="button" onClick={onEdit} className="font-medium text-neutral-800 underline">
            Edit
          </button>
          <button
            type="button"
            onClick={toggle}
            disabled={pending}
            className="font-medium text-neutral-700 underline disabled:opacity-40"
          >
            {isShown ? "Hide from profile" : "Show on profile"}
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
