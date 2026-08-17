// Profile V2 — the activation SERVICE. The one and only place a professional
// profile comes into existence.
//
// The pure rules live in ./activation.ts (who is eligible, what the seed is).
// This module does the I/O around them: load, decide, insert once, stamp the
// Relevé-controlled trust signals, write the join rows.
//
// ── The rule it enforces (founder decisions 2026-08-17) ──
//   Apply → Relevé accepts → activate/pay → Relevé creates the DRAFT profile
//   → member reviews/completes → member publishes
//
// Nobody gets a profile for applying, or for being approved. Both halves are
// required: approved AND an active profile-bearing membership (paid, or an
// authorized comp/founding grant).
//
// ── Three invariants, all tested ──
//   1. STAMP ONCE. Trust signals are written at creation and never recomputed.
//   2. NEVER DOWNGRADE. An existing profile is returned untouched — no re-seed,
//      no re-stamp, no clearing. This is what protects marks granted by hand
//      before Profile V2 existed.
//   3. RACE-SAFE. The unique index on talent_profiles.user_id is the authority;
//      a unique violation means someone else won and is treated as SUCCESS.
//
// Called from four places: the Stripe webhook (membership goes active), the
// admin approve route (complimentary membership granted), the founding-grant
// sign-in claim, and a catch-up check in the /profile/edit gate.

import {
  resolveActivationBasis,
  buildProfileSeed,
  buildFoundingSeed,
  ACTIVATION_PROFILE_STATUS,
  type ApplicationAnswers,
  type MembershipRow,
  type ProfileSeed,
} from "./activation";
import { resolveUniqueSlug } from "./slug";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = { from: (table: string) => any };

/** Postgres unique-violation. Emitted when two callers race the insert. */
const UNIQUE_VIOLATION = "23505";

export type ActivationResult =
  | { created: true; profileId: string; slug: string }
  | {
      created: false;
      reason: "not_eligible" | "already_exists" | "raced" | "no_user" | "error";
      detail?: string;
    };

type ApplicationRow = {
  application_id: string;
  state: string;
  honorifics: string[] | null;
  approved_tier: string | null;
  answers: ApplicationAnswers | null;
};

/**
 * Create this user's professional profile if — and only if — they are activated.
 *
 * Safe to call repeatedly, from anywhere, concurrently. Never throws: every
 * caller is a webhook, a sign-in, or an admin action that must not fail because
 * profile creation did.
 */
export async function activateProfessionalProfile(
  admin: SupabaseLike,
  userId: string,
): Promise<ActivationResult> {
  try {
    // ── 1. Does a profile already exist? ──
    // Checked first and cheaply. The unique index is the real guarantee (§3);
    // this just avoids the work in the overwhelmingly common repeat call.
    const { data: existing } = await admin
      .from("talent_profiles")
      .select("profile_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) return { created: false, reason: "already_exists" };

    // ── 2. Load everything the decision needs ──
    const [{ data: userRow }, { data: appRows }, { data: memRows }] = await Promise.all([
      admin.from("users").select("email, display_name").eq("user_id", userId).maybeSingle(),
      admin
        .from("applications")
        .select("application_id, state, honorifics, approved_tier, answers")
        .eq("user_id", userId)
        .eq("state", "approved")
        .order("reviewed_at", { ascending: false, nullsFirst: false })
        .limit(1),
      admin.from("memberships").select("tier, membership_status").eq("user_id", userId),
    ]);

    const user = userRow as { email: string | null; display_name: string | null } | null;
    if (!user) return { created: false, reason: "no_user" };

    const application = ((appRows ?? []) as ApplicationRow[])[0] ?? null;
    const memberships = (memRows ?? []) as MembershipRow[];

    // A Founding Professional is matched on their VERIFIED email, never on
    // anything a link or a form supplied.
    const email = (user.email ?? "").toLowerCase();
    let hasFoundingGrant = false;
    if (email) {
      const { data: grant } = await admin
        .from("founding_professional_grants")
        .select("id")
        .eq("email", email)
        .is("revoked_at", null)
        .maybeSingle();
      hasFoundingGrant = Boolean(grant);
    }

    // ── 3. The gate ──
    const basis = resolveActivationBasis({
      application: application
        ? { application_id: application.application_id, state: application.state }
        : null,
      hasFoundingGrant,
      membershipRows: memberships,
    });
    if (!basis) return { created: false, reason: "not_eligible" };

    // ── 4. The one-time seed ──
    const displayName = user.display_name?.trim() || email || "Relevé Professional";
    const seed: ProfileSeed =
      basis.kind === "approved_application"
        ? buildProfileSeed(application?.answers ?? null, { displayName })
        : buildFoundingSeed(displayName);

    const slug = await resolveUniqueSlug(admin, seed.profile.display_name);

    // ── 5. The row, including the Relevé-controlled trust signals ──
    // STAMPED ONCE, here, and never recomputed anywhere. Members can never write
    // any of these: they are absent from saveProfile's payload entirely.
    const row: Record<string, unknown> = {
      user_id: userId,
      public_slug: slug,
      ...seed.profile,

      // Created as a DRAFT, always. Creation and publication are separate acts —
      // activation gives someone a professional identity to review; only the
      // member makes it live.
      profile_status: ACTIVATION_PROFILE_STATUS,

      // Provenance (slice 1). NULL for a Founding Professional, who never applied.
      prefilled_from_application_id:
        basis.kind === "approved_application" ? basis.applicationId : null,
      prefilled_at: new Date().toISOString(),

      // Verified Member: vetting is complete by definition here — reaching this
      // line required approval AND an active membership.
      verification_flag: true,
      certified_eligible_at: new Date().toISOString(),

      // Editorial honorifics, conferred by Relevé on the APPLICATION. Copied, not
      // derived. An applicant awarded nothing gets nothing.
      honorifics: application?.honorifics ?? [],
    };

    // Only set when actually awarded, so the database defaults ('emerging' /
    // 'none') apply otherwise. An ordinary approved member never inherits a
    // distinction or a tier they were not given.
    if (application?.approved_tier) row.choreographer_tier = application.approved_tier;
    if (hasFoundingGrant) row.founder_distinction = "founding_professional";

    // ── 6. Insert. The unique index decides who wins. ──
    const { data: created, error } = await admin
      .from("talent_profiles")
      .insert(row)
      .select("profile_id, public_slug")
      .single();

    if (error) {
      // Another caller created it a moment ago. That is success, not failure.
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        return { created: false, reason: "raced" };
      }
      console.error("[activation] profile insert failed:", error.message);
      return { created: false, reason: "error", detail: error.message };
    }

    const profile = created as { profile_id: string; public_slug: string };

    // ── 7. Join rows — only after a successful create ──
    await writeSeedJoins(admin, profile.profile_id, seed);

    return { created: true, profileId: profile.profile_id, slug: profile.public_slug };
  } catch (err) {
    // Never throw into a webhook, a sign-in, or an admin action.
    console.error("[activation] unexpected failure:", err);
    return { created: false, reason: "error", detail: String(err) };
  }
}

/**
 * Write the seed's controlled-vocabulary rows. Each is best-effort and
 * independent: a missing taxonomy term must not cost the member their whole
 * profile. The slug→id lookups mirror saveProfile's replaceJoin.
 */
async function writeSeedJoins(
  admin: SupabaseLike,
  profileId: string,
  seed: ProfileSeed,
): Promise<void> {
  const links: Array<{ join: string; fk: string; tax: string; slugs: string[] }> = [
    { join: "profile_roles", fk: "role_id", tax: "role_types", slugs: seed.roles },
    { join: "profile_styles", fk: "style_id", tax: "styles", slugs: seed.styles },
    { join: "profile_levels", fk: "level_id", tax: "levels", slugs: seed.levels },
    { join: "profile_focus_areas", fk: "focus_area_id", tax: "focus_areas", slugs: seed.focusAreas },
    { join: "profile_open_to_badges", fk: "badge_id", tax: "open_to_badges", slugs: seed.openTo },
  ];

  for (const l of links) {
    if (l.slugs.length === 0) continue;
    const { data: rows } = await admin.from(l.tax).select("id, slug").in("slug", l.slugs);
    const inserts = ((rows ?? []) as Array<{ id: string }>).map((r) => ({
      profile_id: profileId,
      [l.fk]: r.id,
    }));
    if (inserts.length) await admin.from(l.join).insert(inserts);
  }

  // Credential badges rendered from evidence — the table built for degrees and
  // union affiliations in the original schema and never wired up until now.
  if (seed.credentials.length) {
    await admin.from("profile_credentials").insert(
      seed.credentials.map((c) => ({ profile_id: profileId, kind: c.kind, value: c.value })),
    );
  }
}
