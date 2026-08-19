// Founding Professional — the invited founding cohort.
//
// TWO INDEPENDENT AXES, never coupled (founder decision 2026-08-13):
//
//   IDENTITY (durable, public)  — talent_profiles.founder_distinction =
//     'founding_professional' + the Verified Member mark. Conferred by Relevé,
//     never changes because of billing, and is what the public badge renders.
//
//   BILLING ENTITLEMENT (financial) — an ordinary `memberships` row (what every
//     gate already reads). Identity-agnostic on the row itself, in two flavors:
//       · permanent complimentary → source 'complimentary_permanent', no expiry
//       · 12-month complimentary   → source 'complimentary_term',      +12 months
//     No membership schema change: `source` + `renewal_date` already exist. The
//     row carries NO "founder" concept, so nothing can infer "founder ⇒ free
//     forever". The two flavors can be changed independently of identity.
//
// The conferral/audit ledger `founding_professional_grants` ties a person to BOTH
// axes at grant time (who, when, which flavor, why). It is written ONLY through
// the admin (service-role) client — there is no self-select path. The cohort is
// OPEN-ENDED: no names, emails, or fixed count live in code — every founder is a
// data row an admin creates.
//
// IMPORTANT: complimentary MEMBERSHIP is unrelated to marketplace/licensing
// transaction economics. Nothing here touches or implies those; they are a
// separate future system.

import type { SupabaseClient } from "@supabase/supabase-js";
import { activateProfessionalProfile } from "@/lib/profile/activate";

// ---- Identity axis ---------------------------------------------------------

/** The durable public distinction (mirrors the founder_distinction enum value). */
export const FOUNDING_PROFESSIONAL_DISTINCTION = "founding_professional" as const;

// ---- Billing axis (identity-agnostic complimentary membership) -------------

/** Permanent complimentary: never billed, never expires (renewal_date NULL). */
export const COMP_PERMANENT_SOURCE = "complimentary_permanent";
/** Timed complimentary: complimentary until renewal_date, then the ordinary model. */
export const COMP_TERM_SOURCE = "complimentary_term";
/** The complimentary term length, in months. */
export const COMP_TERM_MONTHS = 12;
/** The membership `source` values that mark a founder's complimentary billing. */
export const FOUNDER_COMP_SOURCES = [COMP_PERMANENT_SOURCE, COMP_TERM_SOURCE] as const;

/** The billing flavor an admin chooses PER PERSON. */
export type EntitlementKind = "permanent" | "comp_12mo";

export function isEntitlementKind(v: unknown): v is EntitlementKind {
  return v === "permanent" || v === "comp_12mo";
}

/** Human label for an entitlement kind (admin UI + audit copy). */
export function entitlementLabel(kind: EntitlementKind): string {
  return kind === "permanent" ? "Permanent complimentary" : "12-month complimentary";
}

export type EntitlementTerms = { source: string; renewalDate: string | null };

/**
 * The billing terms for an entitlement kind. PURE.
 *   · permanent → { complimentary_permanent, renewalDate: null }  (never lapses)
 *   · comp_12mo → { complimentary_term,      renewalDate: +12mo } (then ordinary)
 * This is the ONLY place the two flavors' billing is defined, so identity code
 * never has to know about expiry.
 */
export function entitlementTerms(kind: EntitlementKind, from: Date = new Date()): EntitlementTerms {
  if (kind === "permanent") return { source: COMP_PERMANENT_SOURCE, renewalDate: null };
  const end = new Date(from);
  end.setMonth(end.getMonth() + COMP_TERM_MONTHS);
  return { source: COMP_TERM_SOURCE, renewalDate: end.toISOString() };
}

/** Normalize an email for storage + matching (Supabase Auth stores lower-case). */
export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

// ---- DB helpers (admin/service-role client ONLY) ---------------------------
//
// These take a service-role SupabaseClient. They never run on a member's own
// client — members cannot read the ledger or write their own membership.

// A loose client shape, to avoid Supabase's deeply-generic types tripping TS.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

/**
 * Ensure a public.users row exists for this account. Founding Professionals are
 * INVITED — they never applied and haven't saved a profile — so on their first
 * sign-in there is NO public.users row yet. But `memberships.user_id` has a
 * foreign key to public.users, so the complimentary-membership insert would fail
 * without this. Upsert with ignoreDuplicates so we NEVER clobber an existing
 * account's type/status (mirrors ensureUserRow in the connections flow).
 */
async function ensureUserRow(db: Db, userId: string, email: string): Promise<void> {
  const e = normalizeEmail(email);
  if (!e) return;
  await db.from("users").upsert(
    { user_id: userId, email: e, account_type: "talent", status: "active" },
    { onConflict: "user_id", ignoreDuplicates: true },
  );
}

/**
 * Materialize the BILLING entitlement: create (or update) the complimentary
 * Professional membership for a user, in the chosen flavor. Idempotent on the
 * founder-source family — a user has at most ONE founder complimentary row, so
 * this doubles as "change the flavor later". Identity is NOT touched here.
 *
 * Returns true only if the row was actually written. The caller MUST ensure a
 * public.users row exists first (see ensureUserRow) or the FK insert fails.
 * Errors are surfaced (logged + false) rather than swallowed, so a silent failure
 * can never again leave a founder locked out.
 */
export async function materializeEntitlement(
  db: Db,
  userId: string,
  kind: EntitlementKind,
): Promise<boolean> {
  const terms = entitlementTerms(kind);
  const now = new Date().toISOString();

  const { data: existing } = await db
    .from("memberships")
    .select("membership_id")
    .eq("user_id", userId)
    .in("source", FOUNDER_COMP_SOURCES)
    .limit(1)
    .maybeSingle();

  const row = {
    user_id: userId,
    tier: "professional", // Founding Professionals are the Professional tier
    price_cents: 0, // never revenue
    term: "annual",
    membership_status: "active",
    source: terms.source,
    renewal_date: terms.renewalDate, // NULL = permanent, date = complimentary-until
    // stripe_customer_id / stripe_subscription_id stay NULL — no subscription.
    updated_at: now,
  };

  const { error } = existing
    ? await db.from("memberships").update(row).eq("membership_id", (existing as { membership_id: string }).membership_id)
    : await db.from("memberships").insert(row);

  if (error) {
    console.error("[founding-professional] complimentary membership write failed:", error.message);
    return false;
  }
  return true;
}

/**
 * Stamp the durable IDENTITY onto the profile, IF one exists yet: the Founding
 * Professional distinction + the Verified Member mark. Safe to call repeatedly.
 * Never downgrades a higher distinction (only stamps when currently 'none').
 * Billing is NOT touched here.
 */
export async function stampFounderIdentity(db: Db, userId: string): Promise<void> {
  const { data: profile } = await db
    .from("talent_profiles")
    .select("profile_id, founder_distinction, verification_flag, certified_eligible_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile) return; // no profile yet — stamped at profile creation instead

  const p = profile as {
    profile_id: string;
    founder_distinction: string | null;
    verification_flag: boolean | null;
    certified_eligible_at: string | null;
  };
  const now = new Date().toISOString();
  const update: Record<string, unknown> = { updated_at: now };
  if (!p.founder_distinction || p.founder_distinction === "none") {
    update.founder_distinction = FOUNDING_PROFESSIONAL_DISTINCTION;
  }
  if (!p.verification_flag) {
    update.verification_flag = true;
    update.certified_eligible_at = p.certified_eligible_at ?? now;
  }
  await db.from("talent_profiles").update(update).eq("profile_id", p.profile_id);
}

export type GrantInput = {
  email: string;
  entitlementKind: EntitlementKind;
  note?: string | null;
  grantedBy: string; // acting admin's user_id
};

export type GrantOutcome =
  | { ok: true; grantId: string; materialized: boolean }
  | { ok: false; error: string };

/**
 * Confer Founding Professional status on an invited person, BY EMAIL (the account
 * may not exist yet). Writes the audit row; if an account already exists, also
 * materializes the membership + stamps identity immediately. Otherwise the grant
 * waits and is claimed on that person's first sign-in.
 */
export async function grantFoundingProfessional(db: Db, input: GrantInput): Promise<GrantOutcome> {
  const email = normalizeEmail(input.email);
  if (!email || !email.includes("@")) return { ok: false, error: "Enter a valid email address." };
  if (!isEntitlementKind(input.entitlementKind)) {
    return { ok: false, error: "Choose Permanent or 12-month complimentary." };
  }

  // One active (non-revoked) grant per email.
  const { data: dupe } = await db
    .from("founding_professional_grants")
    .select("id")
    .eq("email", email)
    .is("revoked_at", null)
    .maybeSingle();
  if (dupe) return { ok: false, error: "That email already has an active Founding Professional grant." };

  // Does an account already exist for this email? (Supabase Auth lower-cases.)
  const { data: userRow } = await db.from("users").select("user_id").eq("email", email).maybeSingle();
  const userId = (userRow as { user_id: string } | null)?.user_id ?? null;

  const { data: ins, error: insErr } = await db
    .from("founding_professional_grants")
    .insert({
      email,
      entitlement_kind: input.entitlementKind,
      granted_by: input.grantedBy,
      note: input.note?.trim() || null,
      user_id: userId,
    })
    .select("id")
    .single();
  if (insErr || !ins) return { ok: false, error: insErr?.message ?? "Could not save the grant." };
  const grantId = (ins as { id: string }).id;

  let materialized = false;
  if (userId) {
    await ensureUserRow(db, userId, email);
    if (await materializeEntitlement(db, userId, input.entitlementKind)) {
      await stampFounderIdentity(db, userId);
      await db
        .from("founding_professional_grants")
        .update({ claimed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", grantId);
      materialized = true;
    }
  }

  return { ok: true, grantId, materialized };
}

/**
 * Best-effort claim on first sign-in: if the signed-in email matches an unclaimed,
 * non-revoked grant, materialize the membership + stamp identity. Called from the
 * shared post-sign-in resolver; must never throw into the sign-in path.
 */
export async function claimFoundingProfessionalOnSignIn(
  db: Db,
  userId: string,
  email: string,
): Promise<void> {
  const e = normalizeEmail(email);
  if (!e) return;

  const { data: grant } = await db
    .from("founding_professional_grants")
    .select("id, entitlement_kind, claimed_at")
    .eq("email", e)
    .is("revoked_at", null)
    .maybeSingle();
  if (!grant) return;

  const g = grant as { id: string; entitlement_kind: string; claimed_at: string | null };
  if (g.claimed_at) return; // already materialized
  if (!isEntitlementKind(g.entitlement_kind)) return;

  // Founders never applied, so their public.users row may not exist yet — the
  // membership FK requires it. Create it BEFORE materializing.
  await ensureUserRow(db, userId, e);

  const materialized = await materializeEntitlement(db, userId, g.entitlement_kind);
  // Leave the grant UNCLAIMED if billing didn't land, so the next sign-in retries
  // instead of getting stuck "claimed" with no membership.
  if (!materialized) return;

  // ── PROFILE V2 — activation ──
  // The grant IS this person's activation: they were invited rather than vetted
  // through the queue, and the complimentary membership was just materialized
  // above. Create their DRAFT profile now, carrying the Founding Professional
  // distinction and the Verified mark from the server-side grant. They never
  // applied, so there is nothing to prefill — only their name.
  //
  // Ordered BEFORE stampFounderIdentity deliberately: activation creates the row
  // already stamped, and the stamp below then covers the other case — a founder
  // who already had a profile before their grant was conferred.
  await activateProfessionalProfile(db, userId);

  await stampFounderIdentity(db, userId);
  await db
    .from("founding_professional_grants")
    .update({ user_id: userId, claimed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", g.id);
}

export type MutateOutcome = { ok: true } | { ok: false; error: string };

/**
 * Change ONLY the billing flavor of an existing grant (permanent ↔ 12-month).
 * Founder IDENTITY is deliberately left untouched — the badge and Verified mark
 * are unaffected. If the person has already claimed, their membership billing is
 * updated in place.
 */
export async function changeEntitlement(
  db: Db,
  grantId: string,
  newKind: EntitlementKind,
): Promise<MutateOutcome> {
  if (!isEntitlementKind(newKind)) return { ok: false, error: "Invalid entitlement." };

  const { data: grant } = await db
    .from("founding_professional_grants")
    .select("id, user_id, revoked_at")
    .eq("id", grantId)
    .maybeSingle();
  const g = grant as { id: string; user_id: string | null; revoked_at: string | null } | null;
  if (!g) return { ok: false, error: "Grant not found." };
  if (g.revoked_at) return { ok: false, error: "That grant has been revoked." };

  await db
    .from("founding_professional_grants")
    .update({ entitlement_kind: newKind, updated_at: new Date().toISOString() })
    .eq("id", grantId);

  // Billing only — identity is NOT touched.
  if (g.user_id) await materializeEntitlement(db, g.user_id, newKind);
  return { ok: true };
}

/**
 * Revoke a grant made in error. Records who/when (audit), deactivates the
 * complimentary membership, and clears the founder identity stamp (only when it
 * is the Founding Professional distinction — never clobbers another mark). The
 * grant row is kept (never deleted) so the correction is auditable.
 */
export async function revokeFoundingProfessional(
  db: Db,
  grantId: string,
  revokedBy: string,
): Promise<MutateOutcome> {
  const { data: grant } = await db
    .from("founding_professional_grants")
    .select("id, user_id, revoked_at")
    .eq("id", grantId)
    .maybeSingle();
  const g = grant as { id: string; user_id: string | null; revoked_at: string | null } | null;
  if (!g) return { ok: false, error: "Grant not found." };
  if (g.revoked_at) return { ok: false, error: "That grant is already revoked." };

  const now = new Date().toISOString();
  await db
    .from("founding_professional_grants")
    .update({ revoked_at: now, revoked_by: revokedBy, updated_at: now })
    .eq("id", grantId);

  if (g.user_id) {
    // Deactivate the complimentary membership (billing).
    await db
      .from("memberships")
      .update({ membership_status: "canceled", updated_at: now })
      .eq("user_id", g.user_id)
      .in("source", FOUNDER_COMP_SOURCES);
    // Clear the founder identity stamp — but ONLY if it is ours.
    await db
      .from("talent_profiles")
      .update({ founder_distinction: "none", verification_flag: false, updated_at: now })
      .eq("user_id", g.user_id)
      .eq("founder_distinction", FOUNDING_PROFESSIONAL_DISTINCTION);
  }
  return { ok: true };
}
