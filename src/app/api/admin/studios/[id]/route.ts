// Admin — act on a studio's lifecycle. Gated on a signed-in admin
// (lib/admin-auth); writes via the service role.
//
// PATCH /api/admin/studios/<employerId>
//   body: { action }
//     action = "approve"   → status submitted → approved   (accepts the content)
//            | "publish"    → status approved  → live        (makes it PUBLIC)
//            | "unpublish"  → status live      → approved    (pull it back private)
//            | "set_details" → correct name / pilot status directly, at ANY
//                              lifecycle stage — no status transition, no
//                              email. For fixing a bad invite (e.g. a blank
//                              org name) or recording a complimentary pilot
//                              without disturbing the org's own invite/token.
//
// `approve` and `publish` are two DISTINCT steps, both admin-only — nothing
// auto-publishes (spec rule 9). The profile's `status` is the source of truth for
// publication (the public read RLS gates on status = 'live'); the invite row's
// status is a mirror for the admin list.

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailSiteUrl } from "@/lib/email/send";
import { sendStudioLive } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: "approve" | "publish" | "unpublish" | "set_details";
  name?: string;
  pilot_status?: "complimentary" | null;
  pilot_note?: string | null;
};

/** A clean URL slug from a studio name (for /studios/<slug>). "join" is a
 *  reserved sub-path, so it's never allowed to win. */
function slugBase(name: string | null): string {
  const base = (name ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return !base || base === "join" ? "studio" : base;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const db = createAdminClient();

  const { data: profRow, error: loadErr } = await db
    .from("employer_profiles")
    .select("employer_id, name, status, owner_user_id, public_slug, org_type")
    .eq("employer_id", id)
    .single();
  if (loadErr || !profRow) {
    return NextResponse.json({ error: "Studio not found." }, { status: 404 });
  }
  const prof = profRow as unknown as {
    employer_id: string;
    name: string | null;
    status: string;
    owner_user_id: string | null;
    public_slug: string | null;
    org_type: string | null;
  };
  const now = new Date().toISOString();

  const transition = async (
    from: string[],
    to: string,
    extra: Record<string, unknown>,
  ): Promise<NextResponse | null> => {
    if (!from.includes(prof.status)) {
      return NextResponse.json(
        { error: `Cannot ${body.action} a studio that is "${prof.status}".` },
        { status: 409 },
      );
    }
    const { error } = await db
      .from("employer_profiles")
      .update({ status: to, updated_at: now, ...extra })
      .eq("employer_id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Keep the invite mirror in step (best-effort).
    await db.from("founding_studio_invites").update({ status: to }).eq("employer_id", id);
    return null;
  };

  switch (body.action) {
    case "approve": {
      const err = await transition(["submitted"], "approved", { approved_at: now });
      if (err) return err;
      return NextResponse.json({ ok: true, status: "approved" });
    }

    case "publish": {
      const err = await transition(["approved"], "live", { live_at: now });
      if (err) return err;

      // Ensure the now-live studio has a public URL slug for /studios/<slug>.
      // Generate one only if it doesn't already have it (never rewrite a slug —
      // a published URL should stay stable across unpublish/republish).
      let slug = prof.public_slug;
      if (!slug) {
        let candidate = slugBase(prof.name);
        const { data: clash } = await db
          .from("employer_profiles")
          .select("employer_id")
          .eq("public_slug", candidate)
          .maybeSingle();
        if (clash && (clash as { employer_id: string }).employer_id !== id) {
          candidate = `${candidate}-${randomBytes(2).toString("hex")}`;
        }
        const { error: slugErr } = await db
          .from("employer_profiles")
          .update({ public_slug: candidate })
          .eq("employer_id", id);
        if (!slugErr) slug = candidate;
        else console.error("[admin publish] could not set public_slug:", slugErr.message);
      }

      // Optional "you're live" note to the studio owner — links to the profile.
      if (prof.owner_user_id) {
        const { data: ownerRow } = await db
          .from("users")
          .select("email")
          .eq("user_id", prof.owner_user_id)
          .maybeSingle();
        const ownerEmail = (ownerRow as { email?: string } | null)?.email;
        if (ownerEmail) {
          await sendStudioLive({
            to: ownerEmail,
            studioName: prof.name || "Your studio",
            profileUrl: slug ? `${emailSiteUrl()}/studios/${slug}` : `${emailSiteUrl()}/studios`,
            orgType: prof.org_type,
          });
        }
      }
      return NextResponse.json({ ok: true, status: "live", slug });
    }

    case "unpublish": {
      const err = await transition(["live"], "approved", { live_at: null });
      if (err) return err;
      return NextResponse.json({ ok: true, status: "approved" });
    }

    case "set_details": {
      const patch: Record<string, unknown> = { updated_at: now };
      if (body.name !== undefined) {
        const trimmed = body.name.trim();
        if (!trimmed) {
          return NextResponse.json({ error: "Organization name can't be blank." }, { status: 400 });
        }
        patch.name = trimmed;
      }
      if (body.pilot_status !== undefined) {
        if (body.pilot_status !== null && body.pilot_status !== "complimentary") {
          return NextResponse.json({ error: "pilot_status must be null or 'complimentary'." }, { status: 400 });
        }
        patch.pilot_status = body.pilot_status;
        patch.pilot_granted_by = body.pilot_status ? gate.userId : null;
        patch.pilot_granted_at = body.pilot_status ? now : null;
      }
      if (body.pilot_note !== undefined) {
        patch.pilot_note = body.pilot_note?.trim() || null;
      }
      const { error } = await db.from("employer_profiles").update(patch).eq("employer_id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json(
        { error: "action must be one of: approve, publish, unpublish, set_details." },
        { status: 400 },
      );
  }
}
