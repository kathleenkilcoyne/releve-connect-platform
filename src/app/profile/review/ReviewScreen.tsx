"use client";

// The interactive half of /profile/review: the checklist, the carried assets,
// the visibility choice, and the publish action.

import Link from "next/link";
import { useActionState, useState } from "react";
import { publishProfile, type PublishState } from "./actions";
import {
  WELCOME_COPY,
  PUBLISH_MEANING,
  completionCount,
  essentialsRemaining,
  canPublish,
  type ChecklistItem,
  type CarriedAsset,
  type ReviewAudience,
} from "@/lib/profile/review";
import { VISIBILITY_COPY } from "@/lib/profile/visibility";
import type { Visibility } from "@/lib/profile/visibility";

const initialState: PublishState = { ok: false, message: "" };

export default function ReviewScreen({
  audience,
  checklist,
  carried,
  displayName,
  slug,
  profileStatus,
  visibility,
}: {
  audience: ReviewAudience;
  checklist: ChecklistItem[];
  carried: CarriedAsset[];
  displayName: string;
  slug: string | null;
  profileStatus: string;
  visibility: string;
}) {
  const [state, formAction, pending] = useActionState(publishProfile, initialState);
  const [chosen, setChosen] = useState<Visibility>(
    visibility === "unlisted" ? "unlisted" : "public",
  );

  const welcome = WELCOME_COPY[audience];
  const { done, total } = completionCount(checklist);
  const missing = essentialsRemaining(checklist);
  const ready = canPublish(checklist);

  // The action's result wins over the server-rendered value, so the page reflects
  // what just happened without a reload.
  const live = state.status ? state.status === "published" : profileStatus === "published";

  return (
    <>
      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">{welcome.heading}</h1>
      <p className="mt-3 text-neutral-600">{welcome.body}</p>

      {/* Progress -------------------------------------------------------- */}
      <div className="mt-8 rounded-xl border border-neutral-200 p-5">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium text-neutral-800">
            {displayName ? `${displayName}'s profile` : "Your profile"}
          </p>
          <p className="text-sm text-neutral-500">
            {done} of {total} complete
          </p>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-neutral-900 transition-all"
            style={{ width: `${Math.round((done / total) * 100)}%` }}
          />
        </div>

        <ul className="mt-5 space-y-3">
          {checklist.map((item) => (
            <li key={item.key} className="flex items-start gap-3">
              <span
                aria-hidden
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                  item.done ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-400"
                }`}
              >
                {item.done ? "✓" : "–"}
              </span>
              <span>
                <span className="block text-sm font-medium text-neutral-800">
                  {item.label}
                  {/* Stated in words, never colour alone. */}
                  {item.done ? (
                    <span className="ml-2 text-xs font-normal text-green-700">Added</span>
                  ) : item.essential ? (
                    <span className="ml-2 text-xs font-normal text-amber-700">Still needed</span>
                  ) : (
                    <span className="ml-2 text-xs font-normal text-neutral-400">Optional</span>
                  )}
                </span>
                {!item.done && (
                  <span className="mt-0.5 block text-xs text-neutral-500">{item.why}</span>
                )}
              </span>
            </li>
          ))}
        </ul>

        <Link
          href="/profile/edit"
          className="mt-5 inline-block rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
        >
          Edit my profile
        </Link>
      </div>

      {/* Assets we already hold ------------------------------------------ */}
      {carried.length > 0 && (
        <div className="mt-6 rounded-xl border border-[#e3d9c3] bg-[#f6f1e7] p-5">
          <p className="text-sm font-medium text-[#6f6656]">You already sent us these</p>
          <p className="mt-1 text-xs text-[#6f6656]">
            You gave us these links on your application. We don&apos;t copy files from other
            websites into Relevé, so please upload them on your profile — or open the link to check
            it&apos;s still the one you want.
          </p>
          <ul className="mt-3 space-y-2">
            {carried.map((a) => (
              <li key={a.kind} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-neutral-800">
                  {a.kind === "headshot" ? "Headshot" : "Résumé / CV"}
                </span>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="max-w-full truncate text-neutral-600 underline"
                >
                  {a.url}
                </a>
                <Link href="/profile/edit" className="text-neutral-900 underline">
                  Upload it →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Publish ---------------------------------------------------------- */}
      <form action={formAction} className="mt-6 rounded-xl border border-neutral-200 p-5">
        <h2 className="text-lg font-semibold text-neutral-900">
          {live ? "Your profile is live" : "Publish your profile"}
        </h2>

        {!live && !ready && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-medium text-amber-900">
              Not ready to publish yet — {missing.length}{" "}
              {missing.length === 1 ? "item" : "items"} to go
            </p>
            <ul className="mt-2 space-y-1">
              {missing.map((m) => (
                <li key={m.key} className="text-xs text-amber-900">
                  <span className="font-medium">{m.label}</span> — {m.why}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-amber-800">
              Your profile stays a private draft until these are in. They are what make your page
              worth a studio&apos;s attention — the rest of the checklist is optional.
            </p>
            <Link
              href="/profile/edit"
              className="mt-3 inline-block rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
            >
              Add what&apos;s missing →
            </Link>
          </div>
        )}

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-neutral-800">Who can find you?</legend>
          <div className="mt-3 space-y-3">
            {(["public", "unlisted"] as const).map((v) => (
              <label key={v} className="flex items-start gap-3">
                <input
                  type="radio"
                  name="visibility"
                  value={v}
                  checked={chosen === v}
                  onChange={() => setChosen(v)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  <span className="block text-sm font-medium text-neutral-800">
                    {VISIBILITY_COPY[v].label}
                  </span>
                  <span className="mt-0.5 block text-xs text-neutral-500">
                    {VISIBILITY_COPY[v].help}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Say plainly what the button will do, before it is pressed. */}
        <p className="mt-4 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          <span className="font-medium text-neutral-800">
            {live ? "Currently: " : "When you publish: "}
          </span>
          {PUBLISH_MEANING[chosen]}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          {/* Disabled until the four essentials are in. The server enforces the
              same rule — this only saves the member a wasted click. */}
          <button
            type="submit"
            name="intent"
            value="publish"
            disabled={pending || (!live && !ready)}
            title={!live && !ready ? "Add the missing essentials first" : undefined}
            className="rounded-lg bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? "Saving…" : live ? "Update visibility" : "Publish my profile"}
          </button>

          {live && (
            <button
              type="submit"
              name="intent"
              value="unpublish"
              disabled={pending}
              className="text-sm text-neutral-600 underline disabled:opacity-40"
            >
              Take it back to a draft
            </button>
          )}

          {live && slug && (
            <a
              href={`/${slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-neutral-700 underline"
            >
              View my page ↗
            </a>
          )}
        </div>

        {state.message && (
          <p className={`mt-4 text-sm ${state.ok ? "text-green-700" : "text-red-600"}`}>
            {state.message}
          </p>
        )}

        {!live && (
          <p className="mt-4 text-xs text-neutral-400">
            Nothing is public until you press publish. You can change your mind at any time.
          </p>
        )}
      </form>
    </>
  );
}
