// Slice 0b — always-reachable professional account access.
//
// A slim, site-wide bar giving a signed-in PROFESSIONAL one-click access to their
// four account surfaces from ANY page: My Profile · Edit Profile · Messages ·
// Notifications. Principle: never hunt for your own URL.
//
// Server-gated exactly like AdminConsoleLink: it resolves the session server-side
// and renders NOTHING (returns null) unless the caller is a professional (has a
// `talent_profiles` row). That scoping is deliberate — it keeps this bar OFF the
// founding-studio pilot surfaces (families/guardians and studio-only owners never
// see it), so the pilot is untouched. Studio-side messaging access comes later,
// on its own surface, without changing the pilot now.
//
// The links are the four the architecture requires; /profile and the public-
// profile "View/Share" actions inside it are built in Slice 1, /messages and
// /notifications in Slices 2–3. Minimal placeholder pages exist so every link
// resolves today.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveProfessionalActor, type ProfessionalActor } from "@/lib/professional/actor";

const linkCls = "font-medium text-[var(--rc-ink,#17130d)] underline-offset-2 hover:underline";

export default async function ProfessionalNav() {
  let actor: ProfessionalActor | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      // Service-role read (same as AdminConsoleLink) so the gate can't drift with
      // an RLS change elsewhere.
      actor = await resolveProfessionalActor(createAdminClient(), user.id);
    }
  } catch {
    actor = null;
  }

  // Professionals only — this is what keeps the bar off the family/studio pilot.
  if (!actor || !actor.isProfessional) return null;

  return (
    <nav
      aria-label="Your Relevé account"
      className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-[#e3d9c3] bg-[#f6f1e7] px-4 py-1.5 text-xs text-[#6f6656]"
    >
      <span className="uppercase tracking-[0.2em] text-[#a99e86]">Relevé</span>
      <Link href="/profile" className={linkCls}>
        My Profile
      </Link>
      <Link href="/profile/edit" className={linkCls}>
        Edit Profile
      </Link>
      <Link href="/messages" className={linkCls}>
        Messages
      </Link>
      <Link href="/notifications" className={linkCls}>
        Notifications
      </Link>
    </nav>
  );
}
