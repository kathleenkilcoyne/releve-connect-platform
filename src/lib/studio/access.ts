// Gate for the STUDIO self-serve area (its own owner/staff — NOT admin).
//
// A studio owner/staff manages their own comp calendar and roster at
// /studio/schedule. This resolves which studio the signed-in user administers —
// the owner (`employer_profiles.owner_user_id`) or an explicit studio_staff
// 'admin' — and nothing else. It never grants access to another studio: every
// caller resolves to their OWN employer_id, so one studio can't reach another's.
//
// This does NOT weaken RLS. It uses the service-role client only to LOOK UP the
// owner/staff mapping (the authorization fact), then callers scope every read and
// write to the resolved employer_id. Families/guardians and talent administer no
// studio, so they resolve to null and get no write path — they stay read-only.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** The employer_id the given user administers (owner first, then staff admin), or null. */
export async function resolveStudioForUser(userId: string): Promise<string | null> {
  const db = createAdminClient();

  const { data: owned } = await db
    .from("employer_profiles")
    .select("employer_id")
    .eq("owner_user_id", userId)
    .limit(1)
    .maybeSingle();
  if (owned) return (owned as { employer_id: string }).employer_id;

  const { data: staff } = await db
    .from("studio_staff")
    .select("employer_id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  if (staff) return (staff as { employer_id: string }).employer_id;

  return null;
}

export type StudioCheck =
  | { ok: true; userId: string; employerId: string }
  | { ok: false; response: NextResponse };

function deny(status: number, error: string): StudioCheck {
  return { ok: false, response: NextResponse.json({ error }, { status }) };
}

/**
 * Allow only a signed-in studio owner/staff to act, scoped to THEIR studio.
 * Mirrors requireAdmin: same CSRF/origin defence, fails closed, and returns the
 * caller's own employer_id so a route never trusts a studio id from the URL/body.
 */
export async function requireStudioAccess(req: Request): Promise<StudioCheck> {
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(req.url).host) {
        return deny(403, "Cross-origin studio request refused.");
      }
    } catch {
      return deny(403, "Malformed origin.");
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return deny(401, "Sign in to manage your organization.");

  const employerId = await resolveStudioForUser(user.id);
  if (!employerId) return deny(403, "You don't manage a studio or dance team.");

  return { ok: true, userId: user.id, employerId };
}
