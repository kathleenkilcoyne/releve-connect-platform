"use client";

// The interest-form fields for "Become a Founding Studio". A thin client wrapper
// around the submitStudioInterest server action — on success it swaps the whole
// form for a warm confirmation, so a studio owner knows their note landed.

import { useActionState } from "react";
import { submitStudioInterest, type StudioInterestState } from "./actions";

const INITIAL: StudioInterestState = { ok: false, message: "" };

export default function StudioInterestForm() {
  const [state, formAction, pending] = useActionState(submitStudioInterest, INITIAL);

  if (state.ok) {
    return (
      <div className="mt-8 rounded-lg border border-green-200 bg-green-50 px-6 py-8 text-center">
        <p className="text-lg font-medium text-green-900">You&apos;re on the list.</p>
        <p className="mt-2 text-sm leading-relaxed text-green-800">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <Field name="studio_name" label="Studio name" required autoComplete="organization" />
      <Field name="contact_name" label="Your name" required autoComplete="name" />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="email" label="Email" type="email" required autoComplete="email" />
        <Field name="phone" label="Phone (optional)" type="tel" autoComplete="tel" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="city" label="City (optional)" autoComplete="address-level2" />
        <Field name="state_province" label="State (optional)" autoComplete="address-level1" />
      </div>

      <div>
        <label
          htmlFor="student_count_band"
          className="mb-1 block text-xs font-medium text-neutral-600"
        >
          Roughly how many students? (optional)
        </label>
        <select
          id="student_count_band"
          name="student_count_band"
          defaultValue=""
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
        >
          <option value="">Prefer not to say</option>
          <option value="under_50">Under 50</option>
          <option value="50_99">50–99</option>
          <option value="100_199">100–199</option>
          <option value="200_plus">200+</option>
        </select>
      </div>

      <div>
        <label htmlFor="message" className="mb-1 block text-xs font-medium text-neutral-600">
          Anything you&apos;d like us to know? (optional)
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
          placeholder="Your studio, your families, what you're hoping for…"
        />
      </div>

      {state.message && !state.ok && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-700">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
      >
        {pending ? "Sending…" : "Request information"}
      </button>
      <p className="text-center text-xs leading-relaxed text-neutral-500">
        No account is created and nothing is charged. This just tells us you&apos;re interested —
        Kathleen onboards founding studios personally.
      </p>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  required = false,
  autoComplete,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-xs font-medium text-neutral-600">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
      />
    </div>
  );
}
