"use client";

// The role-branched intake (CLAUDE.md §3A). Full form + consents + a minimum
// word count on the Story. On submit it saves the application (server action),
// then sends the applicant to the $30 fee checkout.
//
// FAST-FOLLOW (required before public launch, per DECISIONS.md): auto-save + a
// 14-day resume link. This version is submit-only — don't open it to real
// applicants until auto-save lands.

import { useMemo, useState } from "react";
import { submitApplication } from "./actions";

type Option = { slug: string; label: string };

const STORY_MIN_WORDS = 150;
const AGE_RANGES = ["18-24", "25-34", "35-50", "50+"];
const YEARS_BANDS = ["1-2", "3-5", "6-10", "11-20", "20+"];
const UNIONS = ["AEA", "SAG-AFTRA", "AGMA", "None", "Other"];
const DEGREES = ["BA", "BFA", "MA", "MFA", "Doctorate"];
const AUDITION_FOR = [
  "Commercial", "Backup/Concert Tour", "Musical Theatre", "Event",
  "Cruise/Theme Park", "Industrial", "Film/TV", "Other",
];

function wc(s: string): number {
  const t = s.trim();
  return t ? t.split(/\s+/).length : 0;
}

// Small building blocks that match the app's neutral styling.
function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 border-t border-neutral-200 pt-8">
      <h2 className="text-lg font-semibold text-neutral-900">
        <span className="text-neutral-400">{n}.</span> {title}
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}
function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-neutral-400">{hint}</span>}
    </label>
  );
}
const inputCls =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";

function Text(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputCls} />;
}
function Area(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} min-h-[90px]`} />;
}
function CheckGroup({ name, options }: { name: string; options: Option[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label key={o.slug} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm">
          <input type="checkbox" name={name} value={o.slug} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

export default function ApplyForm({
  email,
  roleOptions,
  styleOptions,
  levelOptions,
  focusOptions,
  openToOptions,
}: {
  email: string;
  roleOptions: Option[];
  styleOptions: Option[];
  levelOptions: Option[];
  focusOptions: Option[];
  openToOptions: Option[];
}) {
  const [roles, setRoles] = useState<Set<string>>(new Set());
  const [primaryRole, setPrimaryRole] = useState("");
  const [story, setStory] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storyWords = useMemo(() => wc(story), [story]);
  const has = (slug: string) => roles.has(slug);

  function toggleRole(slug: string, on: boolean) {
    setRoles((prev) => {
      const next = new Set(prev);
      if (on) next.add(slug);
      else next.delete(slug);
      return next;
    });
    if (!on && primaryRole === slug) setPrimaryRole("");
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (storyWords < STORY_MIN_WORDS) {
      setError(`Your story needs at least ${STORY_MIN_WORDS} words (you have ${storyWords}).`);
      return;
    }
    setBusy(true);
    try {
      const formData = new FormData(e.currentTarget);
      const res = await submitApplication({ ok: false, message: "" }, formData);
      if (!res.ok || !res.applicationId) {
        setError(res.message || "Something went wrong. Please try again.");
        setBusy(false);
        return;
      }
      // FREE FOUNDING PERIOD: no application fee, so a saved application goes
      // straight to the thank-you page. (When the fee returns, POST to
      // /api/applications/<id>/fee-checkout here and redirect to `url`.)
      window.location.href = "/apply/submitted";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const selectedRoles = roleOptions.filter((r) => roles.has(r.slug));

  return (
    <form onSubmit={onSubmit} className="mt-8">
      {/* 1 — Identity & Contact */}
      <Section n={1} title="Identity & contact">
        <div className="grid grid-cols-2 gap-4">
          <Field label="First name"><Text name="first_name" required /></Field>
          <Field label="Last name"><Text name="last_name" required /></Field>
        </div>
        <Field label="Email"><Text type="email" name="email" defaultValue={email} required /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Mobile"><Text name="mobile" /></Field>
          <Field label="Age range">
            <select name="age_range" className={inputCls} defaultValue="">
              <option value="" disabled>Choose…</option>
              {AGE_RANGES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="City"><Text name="city" /></Field>
          <Field label="State / province"><Text name="state_province" /></Field>
          <Field label="Country"><Text name="country" defaultValue="United States" /></Field>
        </div>
      </Section>

      {/* 2 — Professional roles */}
      <Section n={2} title="Professional roles">
        <p className="text-sm text-neutral-500">Select every role that applies — the form adapts to what you pick.</p>
        <div className="flex flex-wrap gap-2">
          {roleOptions.map((r) => (
            <label key={r.slug} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm">
              <input
                type="checkbox"
                name="roles"
                value={r.slug}
                checked={roles.has(r.slug)}
                onChange={(e) => toggleRole(r.slug, e.target.checked)}
              />
              {r.label}
            </label>
          ))}
        </div>
        {selectedRoles.length > 0 && (
          <Field label="Primary role">
            <select
              name="primary_role"
              className={inputCls}
              value={primaryRole}
              onChange={(e) => setPrimaryRole(e.target.value)}
            >
              <option value="">Choose your primary role…</option>
              {selectedRoles.map((r) => <option key={r.slug} value={r.slug}>{r.label}</option>)}
            </select>
          </Field>
        )}
      </Section>

      {/* 3 — Your story */}
      <Section n={3} title="Your story">
        <Field label="Tell us who you are, in your own words" hint={`${storyWords} words · minimum ${STORY_MIN_WORDS}`}>
          <Area
            name="story_bio"
            value={story}
            onChange={(e) => setStory(e.target.value)}
            placeholder="Your training, your teaching or performing life, what you care about…"
          />
        </Field>
        <Field label="Years of professional experience">
          <select name="years_experience" className={inputCls} defaultValue="">
            <option value="" disabled>Choose…</option>
            {YEARS_BANDS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </Field>
      </Section>

      {/* 4 — Industry experience */}
      <Section n={4} title="Industry experience">
        <Field label="Studios / companies you've worked with"><Area name="studios_companies" /></Field>
        <Field label="Notable credits"><Area name="notable_credits" /></Field>
        <Field label="Union affiliations"><CheckGroup name="unions" options={UNIONS.map((u) => ({ slug: u, label: u }))} /></Field>
        <Field label="Certifications & specializations" hint="e.g. ABT NTC, RAD, Cecchetti, Acrobatic Arts…"><Area name="certifications" /></Field>
        <Field label="Degrees held"><CheckGroup name="degrees" options={DEGREES.map((d) => ({ slug: d, label: d }))} /></Field>
      </Section>

      {/* 5 — Teaching philosophy (Teacher) */}
      {has("teacher") && (
        <Section n={5} title="Teaching (because you selected Teacher)">
          <Field label="Your teaching philosophy"><Area name="teaching_philosophy" /></Field>
          <Field label="Levels you'll teach"><CheckGroup name="teaching_levels" options={levelOptions} /></Field>
          <Field label="Styles you teach"><CheckGroup name="teaching_styles" options={styleOptions} /></Field>
          <Field label="Adaptive / inclusive dance experience"><Area name="adaptive_experience" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Available to substitute (The Swing)?">
              <select name="available_to_sub" className={inputCls} defaultValue=""><option value="">—</option><option>Yes</option><option>No</option></select>
            </Field>
            <Field label="Where are you currently teaching?"><Text name="currently_teaching" /></Field>
          </div>
        </Section>
      )}

      {/* 6 — Studio owner */}
      {has("studio_owner") && (
        <Section n={6} title="Your studio (because you selected Studio Owner)">
          <Field label="Tell us about your studio" hint="Name, location, size, what you're known for."><Area name="studio_owner_details" /></Field>
        </Section>
      )}

      {/* 7 — Choreographer */}
      {has("choreographer") && (
        <Section n={7} title="Choreography (because you selected Choreographer)">
          <Field label="Focus areas"><CheckGroup name="choreographer_focus" options={focusOptions} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Years choreographing"><Text name="choreographer_years" /></Field>
            <Field label="Open to licensing existing pieces?">
              <select name="available_to_license" className={inputCls} defaultValue=""><option value="">—</option><option>Yes</option><option>No</option></select>
            </Field>
          </div>
          <Field label="Your work — up to 3 links" hint="Vimeo / YouTube / Drive / Dropbox">
            <div className="space-y-2">
              <Text name="work_link_1" placeholder="https://…" />
              <Text name="work_link_2" placeholder="https://…" />
              <Text name="work_link_3" placeholder="https://…" />
            </div>
          </Field>
        </Section>
      )}

      {/* 8 — Working dancer */}
      {has("working_dancer") && (
        <Section n={8} title="Performing (because you selected Working Dancer)">
          <Field label="Training summary"><Area name="dancer_training" /></Field>
          <Field label="Performance experience"><Area name="dancer_performance" /></Field>
          <Field label="Currently auditioning for"><CheckGroup name="auditioning_for" options={AUDITION_FOR.map((a) => ({ slug: a, label: a }))} /></Field>
        </Section>
      )}

      {/* 9 — Professionalism & references */}
      <Section n={9} title="Professionalism & references">
        <p className="text-sm text-neutral-500">References are private — used only for vetting, never shown on your profile.</p>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Reference 1 — name"><Text name="ref1_name" /></Field>
          <Field label="Email or phone"><Text name="ref1_contact" /></Field>
          <Field label="Relationship"><Text name="ref1_relationship" /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Reference 2 — name"><Text name="ref2_name" /></Field>
          <Field label="Email or phone"><Text name="ref2_contact" /></Field>
          <Field label="Relationship"><Text name="ref2_relationship" /></Field>
        </div>
        <Field label="Work authorization (US)">
          <select name="work_authorization" className={inputCls} defaultValue=""><option value="">—</option><option>Authorized to work in the US</option><option>Not authorized / other</option></select>
        </Field>
      </Section>

      {/* 10 — Digital presence */}
      <Section n={10} title="Digital presence (all optional)">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Website"><Text name="website" placeholder="https://…" /></Field>
          <Field label="Instagram"><Text name="instagram" placeholder="@handle" /></Field>
          <Field label="Vimeo"><Text name="vimeo" /></Field>
          <Field label="YouTube"><Text name="youtube" /></Field>
          <Field label="LinkedIn"><Text name="linkedin" /></Field>
          <Field label="Headshot URL"><Text name="headshot_url" /></Field>
          <Field label="Résumé / CV URL"><Text name="resume_url" /></Field>
          <Field label="Teaching reel"><Text name="teaching_reel" /></Field>
          <Field label="Choreography reel"><Text name="choreography_reel" /></Field>
          <Field label="Performance reel"><Text name="performance_reel" /></Field>
        </div>
      </Section>

      {/* 11 — Relevé alignment */}
      <Section n={11} title="Relevé alignment">
        <Field label="Why does Relevé's mission resonate with you?"><Area name="alignment_1" /></Field>
        <Field label="What would you bring to this community?"><Area name="alignment_2" /></Field>
      </Section>

      {/* 12 — Open-to badges */}
      <Section n={12} title="Open to… (select at least one)">
        <CheckGroup name="open_to" options={openToOptions} />
      </Section>

      {/* 13 — Review & consent */}
      <Section n={13} title="Review & consent">
        <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
          {[
            ["consent_terms", "I agree to the Terms of Service."],
            ["consent_privacy", "I agree to the Privacy Policy."],
            ["consent_media_release", "I consent to Relevé using my bio, headshot, and reels on the platform and in promotion, with attribution."],
            ["consent_contact", "I consent to being contacted through Relevé."],
            ["consent_review_understanding", "I understand my application is reviewed and acceptance is not guaranteed."],
            ["consent_code_of_conduct", "I agree to the Relevé Code of Conduct."],
          ].map(([name, label]) => (
            <label key={name} className="flex cursor-pointer items-start gap-2">
              <input type="checkbox" name={name} className="mt-0.5" />
              <span className="text-neutral-700">{label}</span>
            </label>
          ))}
        </div>
      </Section>

      {error && <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="mt-6 rounded-xl border border-neutral-200 p-4">
        <p className="text-sm text-neutral-600">
          <span className="font-medium">Applying is free.</span> A member of the Relevé council
          reads every application personally, and we&apos;ll email you as soon as there&apos;s a
          decision.
        </p>
        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full rounded-lg bg-neutral-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? "Submitting…" : "Submit application"}
        </button>
      </div>
    </form>
  );
}
