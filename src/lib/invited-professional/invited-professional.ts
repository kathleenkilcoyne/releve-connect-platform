// Private Invited Professional — a second, INDEPENDENT invited cohort.
//
// Deliberately structurally separate from Founding Professional
// (@/lib/founding/founding-professional), not merely logically separate behind
// a flag. This module imports NOTHING from that one, and vice versa. The two
// share a proven shape (grant → claim-on-sign-in → materialize billing → stamp
// a trust signal) because that shape works, not because the cohorts are related.
//
// What a privately invited professional receives, and nothing else:
//   · a complimentary Professional membership (admin-selected: permanent or
//     12-month) — billing only, via its OWN distinctly-named membership
//     sources (see below).
//   · the Verified Member mark (talent_profiles.verification_flag).
//
// What they NEVER receive from this pathway:
//   · founder_distinction is never set. Not 'founding_professional', not
//     'founding_25', not anything else. It stays at its database default
//     ('none') unless some OTHER system sets it later.
//   · Founding 25 is unreachable from here by construction — that distinction
//     lives on `applications.is_founding_25`, a column this module never
//     touches, reads, or writes.
//
// The conferral/audit ledger `private_invitations` is a wholly separate table
// from `founding_professional_grants` — see the migration for why a second
// table, not a shared column, is the "smallest safe" design here. It is
// written ONLY through the admin (service-role) client — there is no
// self-select path.

import type { SupabaseClient } from "@supabase/supabase-js";
import { activateProfessionalProfile } from "@/lib/profile/activate";

// ---- Billing axis -----------------------------------------------------------

/** Permanent complimentary: never billed, never expires (renewal_date NULL). */
export const INVITED_PROFESSIONAL_PERMANENT_SOURCE = "invited_professional_permanent";
/** Timed complimentary: complimentary until renewal_date, then the ordinary model. */
export const INVITED_PROFESSIONAL_TERM_SOURCE = "invited_professional_term";
/** The complimentary term length, in months. Same length as Founding Professional's
 *  12-month flavor by deliberate parallel design — not a shared constant. */
export const INVITED_PROFESSIONAL_TERM_MONTHS = 12;
/** The membership `source` values that mark THIS cohort's complimentary billing.
 *  Distinct from FOUNDER_COMP_SOURCES on purpose — see the migration header —
 *  so the two cohorts' billing is reportable apart without joining back to
 *  either grants table. */
export const INVITED_PROFESSIONAL_COMP_SOURCES = [
  INVITED_PROFESSIONAL_PERMANENT_SOURCE,
  INVITED_PROFESSIONAL_TERM_SOURCE,
] as const;

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
 *   · permanent → { invited_professional_permanent, renewalDate: null }
 *   · comp_12mo → { invited_professional_term,      renewalDate: +12mo }
 */
export function entitlementTerms(kind: EntitlementKind, from: Date = new Date()): EntitlementTerms {
  if (kind === "permanent") return { source: INVITED_PROFESSIONAL_PERMANENT_SOURCE, renewalDate: null };
  const end = new Date(from);
  end.setMonth(end.getMonth() + INVITED_PROFESSIONAL_TERM_MONTHS);
  return { source: INVITED_PROFESSIONAL_TERM_SOURCE, renewalDate: end.toISOString() };
}

/** Normalize an email for storage + matching (Supabase Auth stores lower-case). */
export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

// ---- DB helpers (admin/service-role client ONLY) ---------------------------

// A loose client shape, to avoid Supabase's deeply-generic types tripping TS.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

/**
 * Ensure a public.users row exists for this account. A privately invited
 * professional is INVITED — they never applied and haven't saved a profile —
 * so on their first sign-in there is NO public.users row yet. Mirrors
 * ensureUserRow in the Founding Professional module (duplicated deliberately,
 * not imported, to keep the two modules independent).
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
 * Professional membership for a user, in the chosen flavor. Idempotent on this
 * module's OWN source family (INVITED_PROFESSIONAL_COMP_SOURCES) — a user has
 * at most ONE private-invitation complimentary row. Scoping the idempotent
 * lookup to these sources, rather than to all complimentary sources, is what
 * guarantees this can never find and silently overwrite a Founding
 * Professional's membership row (or vice versa) if the same person somehow
 * appears in both grant tables.
 *
 * Returns true only if the row was actually written.
 */
export async function materializeInvitedProfessionalEntitlement(
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
    .in("source", INVITED_PROFESSIONAL_COMP_SOURCES)
    .limit(1)
    .maybeSingle();

  const row = {
    user_id: userId,
    tier: "professional",
    price_cents: 0, // never revenue
    term: "annual",
    membership_status: "active",
    source: terms.source,
    renewal_date: terms.renewalDate, // NULL = permanent, date = complimentary-until
    updated_at: now,
  };

  const { error } = existing
    ? await db.from("memberships").update(row).eq("membership_id", (existing as { membership_id: string }).membership_id)
    : await db.from("memberships").insert(row);

  if (error) {
    console.error("[invited-professional] complimentary membership write failed:", error.message);
    return false;
  }
  return true;
}

/**
 * Stamp the Verified Member mark ONLY. Deliberately does NOT touch
 * founder_distinction — not conditionally, not ever. This is the entire
 * difference from Founding Professional's stampFounderIdentity, and it is the
 * one thing this module exists to guarantee.
 */
export async function stampVerifiedMemberOnly(db: Db, userId: string): Promise<void> {
  const { data: profile } = await db
    .from("talent_profiles")
    .select("profile_id, verification_flag, certified_eligible_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile) return; // no profile yet — stamped at profile creation instead

  const p = profile as {
    profile_id: string;
    verification_flag: boolean | null;
    certified_eligible_at: string | null;
  };
  if (p.verification_flag) return; // already Verified — nothing to do

  const now = new Date().toISOString();
  await db
    .from("talent_profiles")
    .update({
      verification_flag: true,
      certified_eligible_at: p.certified_eligible_at ?? now,
      updated_at: now,
    })
    .eq("profile_id", p.profile_id);
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
 * Confer a private invitation on a person, BY EMAIL (the account may not exist
 * yet). Writes the audit row; if an account already exists, also materializes
 * the membership + stamps Verified Member immediately. Otherwise the grant
 * waits and is claimed on that person's first sign-in.
 */
export async function grantPrivateInvitation(db: Db, input: GrantInput): Promise<GrantOutcome> {
  const email = normalizeEmail(input.email);
  if (!email || !email.includes("@")) return { ok: false, error: "Enter a valid email address." };
  if (!isEntitlementKind(input.entitlementKind)) {
    return { ok: false, error: "Choose Permanent or 12-month complimentary." };
  }

  // One active (non-revoked) invitation per email.
  const { data: dupe } = await db
    .from("private_invitations")
    .select("id")
    .eq("email", email)
    .is("revoked_at", null)
    .maybeSingle();
  if (dupe) return { ok: false, error: "That email already has an active private invitation." };

  // Does an account already exist for this email? (Supabase Auth lower-cases.)
  const { data: userRow } = await db.from("users").select("user_id").eq("email", email).maybeSingle();
  const userId = (userRow as { user_id: string } | null)?.user_id ?? null;

  const { data: ins, error: insErr } = await db
    .from("private_invitations")
    .insert({
      email,
      entitlement_kind: input.entitlementKind,
      granted_by: input.grantedBy,
      note: input.note?.trim() || null,
      user_id: userId,
    })
    .select("id")
    .single();
  if (insErr || !ins) return { ok: false, error: insErr?.message ?? "Could not save the invitation." };
  const grantId = (ins as { id: string }).id;

  let materialized = false;
  if (userId) {
    await ensureUserRow(db, userId, email);
    if (await materializeInvitedProfessionalEntitlement(db, userId, input.entitlementKind)) {
      await stampVerifiedMemberOnly(db, userId);
      await db
        .from("private_invitations")
        .update({ claimed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", grantId);
      materialized = true;
    }
  }

  return { ok: true, grantId, materialized };
}

/**
 * Best-effort claim on first sign-in: if the signed-in email matches an
 * unclaimed, non-revoked private invitation, materialize the membership +
 * stamp Verified Member (never founder_distinction). Called from the shared
 * post-sign-in resolver; must never throw into the sign-in path.
 */
export async function claimPrivateInvitationOnSignIn(
  db: Db,
  userId: string,
  email: string,
): Promise<void> {
  const e = normalizeEmail(email);
  if (!e) return;

  const { data: grant } = await db
    .from("private_invitations")
    .select("id, entitlement_kind, claimed_at")
    .eq("email", e)
    .is("revoked_at", null)
    .maybeSingle();
  if (!grant) return;

  const g = grant as { id: string; entitlement_kind: string; claimed_at: string | null };
  if (g.claimed_at) return; // already materialized
  if (!isEntitlementKind(g.entitlement_kind)) return;

  // Invitees never applied, so their public.users row may not exist yet — the
  // membership FK requires it. Create it BEFORE materializing.
  await ensureUserRow(db, userId, e);

  const materialized = await materializeInvitedProfessionalEntitlement(db, userId, g.entitlement_kind);
  // Leave the invitation UNCLAIMED if billing didn't land, so the next sign-in
  // retries instead of getting stuck "claimed" with no membership.
  if (!materialized) return;

  // ── PROFILE V2 — activation ──
  // The invitation IS this person's activation: they were invited rather than
  // vetted through the queue, and the complimentary membership was just
  // materialized above. Create their DRAFT profile now — no founder_distinction,
  // Verified Member only. They never applied, so there is nothing to prefill.
  //
  // Ordered BEFORE stampVerifiedMemberOnly deliberately, mirroring the Founding
  // Professional module: activation creates the row already stamped (Verified
  // Member is set unconditionally for every activation basis in activate.ts),
  // and the stamp below then covers the other case — an invitee who already had
  // a profile before their invitation was conferred.
  await activateProfessionalProfile(db, userId);

  await stampVerifiedMemberOnly(db, userId);
  await db
    .from("private_invitations")
    .update({ user_id: userId, claimed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", g.id);
}

export type MutateOutcome = { ok: true } | { ok: false; error: string };

/**
 * Change ONLY the billing flavor of an existing invitation (permanent ↔
 * 12-month). founder_distinction is never touched — this module never sets it
 * in the first place.
 */
export async function changeEntitlement(
  db: Db,
  grantId: string,
  newKind: EntitlementKind,
): Promise<MutateOutcome> {
  if (!isEntitlementKind(newKind)) return { ok: false, error: "Invalid entitlement." };

  const { data: grant } = await db
    .from("private_invitations")
    .select("id, user_id, revoked_at")
    .eq("id", grantId)
    .maybeSingle();
  const g = grant as { id: string; user_id: string | null; revoked_at: string | null } | null;
  if (!g) return { ok: false, error: "Invitation not found." };
  if (g.revoked_at) return { ok: false, error: "That invitation has been revoked." };

  await db
    .from("private_invitations")
    .update({ entitlement_kind: newKind, updated_at: new Date().toISOString() })
    .eq("id", grantId);

  if (g.user_id) await materializeInvitedProfessionalEntitlement(db, g.user_id, newKind);
  return { ok: true };
}

/**
 * Revoke an invitation made in error. Records who/when (audit), deactivates the
 * complimentary membership. Never touches founder_distinction or
 * verification_flag on revoke — this module confers Verified Member, and
 * revoking a billing mistake should not silently un-verify someone whose
 * identity may have been separately confirmed by then. (Founding Professional's
 * revoke DOES clear its identity stamp, because it conferred that stamp in the
 * first place; this module never did, so there is nothing analogous to clear.)
 * The invitation row is kept (never deleted) so the correction is auditable.
 */
export async function revokePrivateInvitation(
  db: Db,
  grantId: string,
  revokedBy: string,
): Promise<MutateOutcome> {
  const { data: grant } = await db
    .from("private_invitations")
    .select("id, user_id, revoked_at")
    .eq("id", grantId)
    .maybeSingle();
  const g = grant as { id: string; user_id: string | null; revoked_at: string | null } | null;
  if (!g) return { ok: false, error: "Invitation not found." };
  if (g.revoked_at) return { ok: false, error: "That invitation is already revoked." };

  const now = new Date().toISOString();
  await db
    .from("private_invitations")
    .update({ revoked_at: now, revoked_by: revokedBy, updated_at: now })
    .eq("id", grantId);

  if (g.user_id) {
    // Deactivate the complimentary membership (billing) only.
    await db
      .from("memberships")
      .update({ membership_status: "canceled", updated_at: now })
      .eq("user_id", g.user_id)
      .in("source", INVITED_PROFESSIONAL_COMP_SOURCES);
  }
  return { ok: true };
}
