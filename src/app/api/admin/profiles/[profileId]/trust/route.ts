// Admin — confer, correct, or withdraw a Relevé trust signal on a PROFILE.
//
// PATCH /api/admin/profiles/<profileId>/trust
//   body: { honorifics?: string[], founder_distinction?: string,
//           choreographer_tier?: string, reason?: string }
//
// ── Why this route exists ──
// Slice 2 removed these fields from the member's own form: a member may describe
// their career, but may not award themselves Verified, a founding distinction, an
// honorific, or a marketplace tier. Slice 2 also seeded them once at activation,
// from the approved application.
//
// But an honorific is a STANDING endorsement, not something frozen forever from
// the application (founder decision A). Before this route, conferring an honorific
// on someone who already had a profile did nothing at all — the admin console
// wrote to `applications`, and only profile CREATION ever read it. This is the
// missing path.
//
// It is also the only way Founding 25 can be awarded. That distinction is
// conferred explicitly here and is never inferred from `applications.is_founding_25`,
// which controls the $30 fee waiver and nothing else (founder decision B).
//
// Gated on a signed-in admin (`users.account_type = 'admin'`) and written with the
// service role. Every change is recorded in profile_trust_events with the acting
// admin, the before/after values, and a stated reason.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolveTrustUpdate,
  diffTrustSignals,
  isFounderDistinction,
  isChoreographerTier,
  type TrustSignals,
  type FounderDistinction,
  type ChoreographerTier,
} from "@/lib/profile/trust";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  honorifics?: unknown;
  founder_distinction?: unknown;
  choreographer_tier?: unknown;
  reason?: unknown;
};

export async function PATCH(req: Request, ctx: { params: Promise<{ profileId: string }> }) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.response;

  const { profileId } = await ctx.params;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const db = createAdminClient();

  // Current standing. Loaded rather than trusted from the client, so the audit
  // row's "previous" value is what was actually in the database.
  const { data: row, error: loadErr } = await db
    .from("talent_profiles")
    .select("profile_id, display_name, honorifics, founder_distinction, choreographer_tier")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  const profile = row as {
    profile_id: string;
    display_name: string | null;
    honorifics: string[] | null;
    founder_distinction: string | null;
    choreographer_tier: string | null;
  };

  const current: TrustSignals = {
    honorifics: profile.honorifics ?? [],
    founder_distinction: isFounderDistinction(profile.founder_distinction)
      ? profile.founder_distinction
      : ("none" as FounderDistinction),
    choreographer_tier: isChoreographerTier(profile.choreographer_tier)
      ? profile.choreographer_tier
      : ("emerging" as ChoreographerTier),
  };

  // Anything missing or unrecognised falls back to the CURRENT value, so a
  // malformed request leaves a member's standing exactly as it was rather than
  // quietly resetting a conferred distinction to 'none'.
  const next = resolveTrustUpdate(current, body);
  const changes = diffTrustSignals(current, next);

  // Nothing actually changed — write nothing, log nothing. An audit trail full of
  // no-op entries is worse than none.
  if (changes.length === 0) {
    return NextResponse.json({ ok: true, changed: false, signals: next });
  }

  const reason = typeof body.reason === "string" ? body.reason.trim() || null : null;
  const now = new Date().toISOString();

  const { error: updateErr } = await db
    .from("talent_profiles")
    .update({
      honorifics: next.honorifics,
      founder_distinction: next.founder_distinction,
      choreographer_tier: next.choreographer_tier,
      updated_at: now,
    })
    .eq("profile_id", profileId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // The audit trail. Best-effort BY DESIGN: if profile_trust_events has not been
  // migrated yet, the conferral still stands and the failure is logged loudly
  // rather than rolling back a legitimate admin decision. Once the table exists
  // this always succeeds.
  const { error: auditErr } = await db.from("profile_trust_events").insert(
    changes.map((c) => ({
      profile_id: profileId,
      actor_user_id: gate.userId,
      field: c.field,
      previous_value: c.previous,
      new_value: c.next,
      reason,
    })),
  );
  if (auditErr) {
    console.error(
      `[admin/trust] signals updated for ${profileId} but the audit row FAILED:`,
      auditErr.message,
    );
  }

  return NextResponse.json({
    ok: true,
    changed: true,
    signals: next,
    changes,
    audited: !auditErr,
  });
}
