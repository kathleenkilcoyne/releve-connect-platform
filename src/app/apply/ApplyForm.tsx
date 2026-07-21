"use client";

// The role-branched intake (CLAUDE.md §3A). Full form + consents. No word counts:
// nobody is told how many words their own story is short by.
//
// AUTO-SAVE (the fast-follow DECISIONS.md called a launch blocker) is now here:
// the form saves a flat snapshot of itself a couple of seconds after you stop
// typing, and restores it exactly when you come back. See ./draft.ts.
//
// Restoring is done by writing values back into the DOM once, on mount, rather
// than by converting the whole form to controlled inputs. The form is
// deliberately uncontrolled — forty-odd fields of React state would be a lot of
// machinery, and re-rendering the tree on every keystroke of a 250-word essay is
// exactly the wrong trade. The three values that DO drive rendering (roles,
// primary role, story word count) are seeded from the draft up front so the
// role-branched sections exist before the rest is restored into them.

import { useCallback, useEffect, useRef, useState } from "react";
import { submitApplication } from "./actions";
import { saveApplicationDraft } from "./draft";

type Option = { slug: string; label: string };
type DraftFields = Record<string, string | string[]>;

/** Draft values may be scalars or arrays; callers usually want an array. */
function toArray(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

/** How long after the last keystroke we save. Long enough not to spam. */
// Long enough that the status line never flickers mid-sentence. A shorter delay
// made the form feel like it was interrupting you while you were still typing.
const AUTOSAVE_DEBOUNCE_MS = 6_000;

/**
 * Write a saved draft back into the live form.
 *
 * Handles every control type in one pass — text, textarea, select, checkbox,
 * radio — so adding a field to the form needs no change here. Dispatches `input`
 * so anything listening (the story word counter) stays in sync.
 */
function hydrateForm(form: HTMLFormElement, draft: DraftFields) {
  for (const [name, raw] of Object.entries(draft)) {
    const values = toArray(raw);
    const nodes = form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      `[name="${CSS.escape(name)}"]`,
    );
    if (nodes.length === 0) continue;

    nodes.forEach((node) => {
      if (node instanceof HTMLInputElement && (node.type === "checkbox" || node.type === "radio")) {
        node.checked = values.includes(node.value);
      } else {
        node.value = values[0] ?? "";
      }
      node.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
}

/** The employer role slug — the one path that is NOT an artist. */
const STUDIO_ROLE = "studio_owner";
type ApplicantPath = "artist" | "studio" | null;
const AGE_RANGES = ["18-24", "25-34", "35-50", "50+"];
const YEARS_BANDS = ["1-2", "3-5", "6-10", "11-20", "20+"];
const UNIONS = ["AEA", "SAG-AFTRA", "AGMA", "None", "Other"];
const DEGREES = ["BA", "BFA", "MA", "MFA", "Doctorate"];
const AUDITION_FOR = [
  "Commercial", "Backup/Concert Tour", "Musical Theatre", "Event",
  "Cruise/Theme Park", "Industrial", "Film/TV", "Other",
];


// Small building blocks that match the app's neutral styling.
// Deliberately unnumbered. Numbered steps advertised a length ("6 of 13") and,
// because whole sections are role-branched, the numbers skipped — which read as
// "you missed something." The form is long enough without counting at people.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 border-t border-neutral-200 pt-8">
      <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
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
// bg-white and text are stated explicitly, not inherited: a transparent field
// over an OS-darkened page is how the questions became invisible on a phone.
const inputCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none";

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

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: Date }
  | { kind: "error"; message: string };

/**
 * The auto-save status line.
 *
 * `aria-live="polite"` so a screen-reader user hears "Saved" without being
 * interrupted mid-sentence. A save FAILURE is stated plainly rather than shown
 * as a colour change — if their work isn't safe, they need to know in words.
 */
function SaveIndicator({ state }: { state: SaveState }) {
  if (state.kind === "idle") {
    return (
      <span className="text-xs text-neutral-400" aria-live="polite">
        Your progress saves automatically
      </span>
    );
  }
  if (state.kind === "saving") {
    return (
      <span className="text-xs text-neutral-500" aria-live="polite">
        Saving…
      </span>
    );
  }
  if (state.kind === "saved") {
    return (
      <span className="text-xs text-green-700" aria-live="polite">
        ✓ Saved{" "}
        {state.at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
      </span>
    );
  }
  return (
    <span className="text-xs font-medium text-red-600" aria-live="polite">
      Not saved — {state.message} Keep this tab open.
    </span>
  );
}

export default function ApplyForm({
  email,
  initial,
  roleOptions,
  styleOptions,
  levelOptions,
  focusOptions,
  openToOptions,
}: {
  email: string;
  /** A previously auto-saved draft, restored on mount. */
  initial?: DraftFields | null;
  roleOptions: Option[];
  styleOptions: Option[];
  levelOptions: Option[];
  focusOptions: Option[];
  openToOptions: Option[];
}) {
  // Seeded from the draft so the role-branched sections are already rendered
  // when hydrateForm() runs — otherwise their fields wouldn't exist yet to fill.
  const [roles, setRoles] = useState<Set<string>>(() => new Set(toArray(initial?.roles)));
  const [primaryRole, setPrimaryRole] = useState(() => String(initial?.primary_role ?? ""));
  // Which of the two paths they're on. Derived from a restored draft so someone
  // returning mid-application lands back in the right branch.
  const [path, setPath] = useState<ApplicantPath>(() =>
    toArray(initial?.roles).includes(STUDIO_ROLE)
      ? "studio"
      : toArray(initial?.roles).length > 0
        ? "artist"
        : null,
  );
  const [story, setStory] = useState(() => String(initial?.story_bio ?? ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });

  const formRef = useRef<HTMLFormElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Set once the form is submitted, so a queued autosave can't fire afterwards. */
  const submitted = useRef(false);

  const has = (slug: string) => roles.has(slug);

  // ---- Restore a saved draft, once ----------------------------------------
  useEffect(() => {
    if (initial && formRef.current) hydrateForm(formRef.current, initial);
    // Intentionally mount-only: re-running would stamp over live typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Auto-save -----------------------------------------------------------
  /**
   * @param leaving true only when the applicant is walking away (tab hidden or
   *   closed). The server sends the save-and-resume email on that signal alone —
   *   see the note in draft.ts. Routine saves while they type stay silent.
   */
  const persist = useCallback(async (leaving = false) => {
    const form = formRef.current;
    if (!form || submitted.current) return;

    const data = new FormData(form);
    if (leaving) data.append("__leaving", "1");

    // Don't create a draft (and don't email a resume link) for someone who has
    // merely opened the page. Wait until they've actually written something.
    //
    // The bar is deliberately higher than "any one field has a character in it":
    // saving on the first letter of a first name made the form feel like it was
    // watching you type. Wait for a whole name, or for real narrative text.
    const field = (f: string) => String(data.get(f) ?? "").trim();
    const meaningful =
      Boolean(field("story_bio")) || Boolean(field("first_name") && field("last_name"));
    if (!meaningful) return;

    setSaveState({ kind: "saving" });
    try {
      const res = await saveApplicationDraft(data);
      if (res.ok) setSaveState({ kind: "saved", at: new Date(res.savedAt) });
      else setSaveState({ kind: "error", message: res.message });
    } catch {
      // Offline or a dropped connection — say so rather than showing "Saved".
      setSaveState({ kind: "error", message: "Couldn't reach the server." });
    }
  }, []);

  const scheduleSave = useCallback(() => {
    if (submitted.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(persist, AUTOSAVE_DEBOUNCE_MS);
  }, [persist]);

  // Flush a pending save when the tab is hidden or closed — the exact moments
  // someone walks away mid-sentence.
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden") {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        // `leaving` — this is the one moment a resume link is worth emailing.
        void persist(true);
      }
    };
    document.addEventListener("visibilitychange", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [persist]);

  /**
   * Switching paths clears the other side's roles outright. Leaving a stale
   * `studio_owner` behind is exactly how someone ended up facing required
   * Studio Owner questions while applying as a teacher.
   */
  function choosePath(next: Exclude<ApplicantPath, null>) {
    setPath(next);
    if (next === "studio") {
      setRoles(new Set([STUDIO_ROLE]));
      setPrimaryRole(STUDIO_ROLE);
    } else {
      setRoles((prev) => {
        const kept = new Set(prev);
        kept.delete(STUDIO_ROLE);
        return kept;
      });
      if (primaryRole === STUDIO_ROLE) setPrimaryRole("");
    }
  }

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

    if (!story.trim()) {
      // The ONLY story requirement: that they wrote something. No word counts
      // anywhere (founder decision 2026-07-21) — counting words at a dancer
      // telling you their life story is the opposite of the invitation.
      setError("Please tell us a little about your journey before submitting.");
      return;
    }
    setBusy(true);
    // Stop autosave: a queued draft save landing after submit would try to write
    // to an application that is no longer editable.
    submitted.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      const formData = new FormData(e.currentTarget);
      const res = await submitApplication({ ok: false, message: "" }, formData);
      if (!res.ok || !res.applicationId) {
        setError(res.message || "Something went wrong. Please try again.");
        setBusy(false);
        submitted.current = false; // let autosave resume; their work is still live
        return;
      }
      // FREE FOUNDING PERIOD: no application fee, so a saved application goes
      // straight to the thank-you page. (When the fee returns, POST to
      // /api/applications/<id>/fee-checkout here and redirect to `url`.)
      window.location.href = "/apply/submitted";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
      submitted.current = false;
    }
  }

  const selectedRoles = roleOptions.filter((r) => roles.has(r.slug));
  /** The three artist roles — everything that isn't the employer side. */
  const artistRoleOptions = roleOptions.filter((r) => r.slug !== STUDIO_ROLE);

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      onInput={scheduleSave}
      onChange={scheduleSave}
      className="mt-8"
    >
      {/* Auto-save status. Sticks to the top so it's visible from any section —
          the reassurance is worth more the further down the form you are. */}
      <div className="sticky top-0 z-10 -mx-1 mb-2 flex justify-end bg-white/90 px-1 py-2 backdrop-blur">
        <SaveIndicator state={saveState} />
      </div>
      {/* 1 — Identity & Contact */}
      <Section title="Identity & contact">
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
      {/*
        Two paths, not four checkboxes. Asking "select every role that applies"
        made artists tick three boxes and then face three required sections;
        studio owners are the employer side entirely. One choice up front means
        nobody is ever asked to answer for a role they don't hold.
      */}
      <Section title="How are you joining Relevé Connect?">
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              { key: "artist", label: "Dance Professional", hint: "You dance, teach, or choreograph." },
              { key: "studio", label: "Studio Owner", hint: "You hire and run a studio." },
            ] as const
          ).map((p) => (
            <label
              key={p.key}
              className={`cursor-pointer rounded-xl border px-4 py-3 text-sm ${
                path === p.key ? "border-neutral-900 bg-neutral-50" : "border-neutral-300"
              }`}
            >
              <input
                type="radio"
                name="applicant_path"
                value={p.key}
                checked={path === p.key}
                onChange={() => choosePath(p.key)}
                className="mr-2"
              />
              <span className="font-medium text-neutral-900">{p.label}</span>
              <span className="mt-1 block text-xs text-neutral-500">{p.hint}</span>
            </label>
          ))}
        </div>

        {path === "artist" && (
          <>
            <p className="text-sm text-neutral-500">
              Tick everything you do — many artists wear more than one hat.
            </p>
            <div className="flex flex-wrap gap-2">
              {artistRoleOptions.map((r) => (
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
            {selectedRoles.length > 1 && (
              <Field label="Which comes first for you?">
                <select
                  name="primary_role"
                  className={inputCls}
                  value={primaryRole}
                  onChange={(e) => setPrimaryRole(e.target.value)}
                >
                  <option value="">Choose…</option>
                  {selectedRoles.map((r) => <option key={r.slug} value={r.slug}>{r.label}</option>)}
                </select>
              </Field>
            )}
          </>
        )}

        {path === "studio" && (
          <input type="hidden" name="roles" value={STUDIO_ROLE} />
        )}
      </Section>

      {/* 3 — Your story */}
      <Section title="Your story">
        <Field
          label="Tell us about your journey, and what you hope to contribute to Relevé"
          hint="However much or little you want to say."
        >
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
      <Section title="Industry experience">
        <Field label="Studios / companies you've worked with"><Area name="studios_companies" /></Field>
        <Field label="Notable credits"><Area name="notable_credits" /></Field>
        <Field label="Union affiliations"><CheckGroup name="unions" options={UNIONS.map((u) => ({ slug: u, label: u }))} /></Field>
        <Field label="Certifications & specializations" hint="e.g. ABT NTC, RAD, Cecchetti, Acrobatic Arts…"><Area name="certifications" /></Field>
        <Field label="Degrees held"><CheckGroup name="degrees" options={DEGREES.map((d) => ({ slug: d, label: d }))} /></Field>
      </Section>

      {/* 5 — Teaching philosophy (Teacher) */}
      {has("teacher") && (
        <Section title="Teaching">
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
        <Section title="Your studio">
          <Field label="Tell us about your studio" hint="Name, location, size, what you're known for."><Area name="studio_owner_details" /></Field>
        </Section>
      )}

      {/* 7 — Choreographer */}
      {has("choreographer") && (
        <Section title="Choreography">
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
        <Section title="Performing">
          <Field label="Training summary"><Area name="dancer_training" /></Field>
          <Field label="Performance experience"><Area name="dancer_performance" /></Field>
          <Field label="Currently auditioning for"><CheckGroup name="auditioning_for" options={AUDITION_FOR.map((a) => ({ slug: a, label: a }))} /></Field>
        </Section>
      )}

      {/*
        References removed 2026-07-21 (founder decision). Asking a stranger to
        hand over two colleagues' names and contact details before we've told
        them anything is invasive, and we don't need it to vet.
      */}
      <Section title="Work authorization">
        <Field label="Work authorization (US)">
          <select name="work_authorization" className={inputCls} defaultValue=""><option value="">—</option><option>Authorized to work in the US</option><option>Not authorized / other</option></select>
        </Field>
      </Section>

      {/* 10 — Digital presence */}
      <Section title="Digital presence (all optional)">
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
      <Section title="Relevé alignment">
        <Field label="Why does Relevé's mission resonate with you?"><Area name="alignment_1" /></Field>
        <Field label="What would you bring to this community?"><Area name="alignment_2" /></Field>
      </Section>

      {/* 12 — Open-to badges */}
      <Section title="Open to… (select at least one)">
        <CheckGroup name="open_to" options={openToOptions} />
      </Section>

      {/* 13 — Review & consent */}
      <Section title="Review & consent">
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
          A member of the Relevé council reads every application personally, and we&apos;ll email
          you as soon as there&apos;s a decision.
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
