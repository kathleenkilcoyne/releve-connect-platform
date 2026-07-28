"use client";

// "Submit for review" — the studio's own action that flips its profile
// in_progress → submitted and alerts Kathleen. Kept as its OWN form (separate
// from the StudioEditor save form — forms can't nest) so submitting never saves
// half-typed edits, and saving never submits.

import { useActionState } from "react";
import { submitStudioForReview, type SaveState } from "../edit/actions";

export default function SubmitForReview() {
  const [state, action, pending] = useActionState<SaveState, FormData>(submitStudioForReview, {
    ok: false,
    message: "",
  });

  return (
    <form action={action} className="mt-10 border-t border-neutral-200 pt-8">
      <h2 className="text-lg font-semibold text-neutral-900">Ready for review?</h2>
      <p className="mt-1 text-sm leading-relaxed text-neutral-600">
        Save your changes first, then submit your profile for Relevé to review. Nothing becomes
        public until it&apos;s reviewed and published — and you can still edit after submitting.
      </p>
      <div className="mt-3 flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-neutral-900 px-5 py-2.5 text-sm font-medium text-neutral-900 disabled:opacity-40"
        >
          {pending ? "Submitting…" : "Submit for review"}
        </button>
        {state.message && (
          <p className={`text-sm ${state.ok ? "text-green-700" : "text-red-600"}`}>{state.message}</p>
        )}
      </div>
    </form>
  );
}
