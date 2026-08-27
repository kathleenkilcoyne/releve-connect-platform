// A slim, site-wide "Admin Console" link shown ONLY to authenticated admins.
//
// Server-gated: it resolves the session server-side and reads
// users.account_type === 'admin'. For a regular user, a signed-out visitor, or
// the public it renders NOTHING (returns null) — the markup is never sent, so
// this is real authorization, not a CSS hide. The link only points to
// /admin/studios, which is itself requireAdminPage-gated, so nothing here
// weakens admin security.

import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminConsoleLink() {
  let isAdmin = false;
  try {
    // Memoized per-request (see server.ts) — this renders on EVERY page, so
    // without the shared cache it was one more redundant getUser() network
    // call on top of ProfessionalNav's and the page's own.
    const user = await getUser();
    if (user) {
      // Read the role with the service-role client (same as the admin gates), so
      // it can't drift with an RLS policy change elsewhere.
      const db = createAdminClient();
      const { data } = await db
        .from("users")
        .select("account_type")
        .eq("user_id", user.id)
        .maybeSingle();
      isAdmin = (data as { account_type?: string } | null)?.account_type === "admin";
    }
  } catch {
    isAdmin = false;
  }

  if (!isAdmin) return null;

  return (
    <div className="flex items-center justify-end gap-3 border-b border-neutral-800 bg-neutral-900 px-4 py-1.5 text-xs text-neutral-300">
      <span className="uppercase tracking-[0.2em] text-neutral-500">Relevé Admin</span>
      <Link href="/admin/studios" className="font-medium text-white underline">
        Admin Console
      </Link>
    </div>
  );
}
