"use client";

// The hiring actions on a public profile: Save (bookmark) + Request an intro.
// Shown only to signed-in active members who aren't the profile owner (the server
// decides that and passes `canAct`). No contact is exchanged here — the intro
// request is a lean note; the talent responds in-app (Open Decision 2).

import { useState, useTransition } from "react";
import { toggleSave, sendIntroRequest } from "@/lib/connections/actions";
import { INTRO_MAX_LEN } from "@/lib/connections/messages";

export default function ConnectActions({
  profileId,
  firstName,
  initialSaved,
  initialRequested,
}: {
  profileId: string;
  firstName: string;
  initialSaved: boolean;
  initialRequested: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [requested, setRequested] = useState(initialRequested);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onToggleSave() {
    setError(null);
    startTransition(async () => {
      const res = await toggleSave(profileId);
      if (res.error) setError(res.error);
      else setSaved(res.saved);
    });
  }

  function onSend() {
    setError(null);
    startTransition(async () => {
      const res = await sendIntroRequest(profileId, message);
      if (res.error) {
        setError(res.error);
      } else {
        setRequested(true);
        setOpen(false);
        setMessage("");
      }
    });
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onToggleSave}
          disabled={pending}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-40"
        >
          {saved ? "★ Saved" : "☆ Save"}
        </button>
        {requested ? (
          <span className="rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-700 ring-1 ring-green-200">
            ✓ Intro request sent
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            disabled={pending}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-40"
          >
            Request an intro
          </button>
        )}
      </div>

      {open && !requested && (
        <div className="mt-4 rounded-xl border border-neutral-200 p-4">
          <label className="mb-1 block text-xs font-medium text-neutral-600">
            Your note to {firstName}
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, INTRO_MAX_LEN))}
            rows={4}
            placeholder="Introduce yourself and why you'd like to connect (a role, a class, a project)…"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-neutral-400">
            {firstName} sees your note and can respond. Your contact details stay private until you
            both choose to share them.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={onSend}
              disabled={pending}
              className="rounded-lg bg-neutral-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {pending ? "Sending…" : "Send request"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm text-neutral-500 underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
