// Intro requests received on my profile (the talent side of the Roster hiring
// rail). Gated to the profile owner. Shows each requester's NAME + note and lets
// me Accept / Decline — no contact is exchanged (Open Decision 2: private by
// default; a real messaging rail comes later).

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import RequestActions from "./RequestActions";

export const dynamic = "force-dynamic";

type Conn = {
  connection_id: string;
  from_user_id: string;
  message: string | null;
  status: string;
  created_at: string;
};

function whenLabel(iso: string): string {
  // Stable, locale-agnostic date (no Date.now needed — just format the stored ts).
  return iso.slice(0, 10);
}

export default async function RequestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // My profile (own row via RLS).
  const { data: mine } = await supabase
    .from("talent_profiles")
    .select("profile_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const profileId = (mine as { profile_id: string } | null)?.profile_id ?? null;

  // Incoming intro requests (RLS lets the profile owner read these).
  let requests: Conn[] = [];
  const requesterName = new Map<string, string>();
  if (profileId) {
    const { data } = await supabase
      .from("connections")
      .select("connection_id, from_user_id, message, status, created_at")
      .eq("to_profile_id", profileId)
      .eq("type", "message-request")
      .order("created_at", { ascending: false });
    requests = (data as Conn[] | null) ?? [];

    // Requester NAMES only (never their contact details) — load via admin.
    const senderIds = [...new Set(requests.map((r) => r.from_user_id))];
    if (senderIds.length) {
      const admin = createAdminClient();
      const { data: users } = await admin
        .from("users")
        .select("user_id, display_name")
        .in("user_id", senderIds);
      for (const u of (users as Array<{ user_id: string; display_name: string | null }> | null) ?? []) {
        requesterName.set(u.user_id, u.display_name || "A Relevé member");
      }
    }
  }

  const pending = requests.filter((r) => r.status === "open");

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
          Relevé · Intro requests
        </p>
        <Link href="/profile/edit" className="text-sm text-neutral-500 underline">
          ← My profile
        </Link>
      </div>
      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">Intro requests</h1>
      <p className="mt-2 text-neutral-600">
        Members who&apos;d like to connect with you. Your contact details stay private — accept to
        signal you&apos;re open, or decline.
        {pending.length > 0 && (
          <span className="ml-1 font-medium text-neutral-900">{pending.length} new.</span>
        )}
      </p>

      {requests.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-neutral-300 px-6 py-16 text-center">
          <p className="text-neutral-600">No intro requests yet.</p>
          {!profileId && (
            <p className="mt-2 text-sm text-neutral-400">
              Publish your profile so members can find and reach you.
            </p>
          )}
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {requests.map((r) => (
            <li key={r.connection_id} className="rounded-xl border border-neutral-200 p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-neutral-900">
                  {requesterName.get(r.from_user_id) ?? "A Relevé member"}
                </span>
                <span className="shrink-0 text-xs text-neutral-400">{whenLabel(r.created_at)}</span>
              </div>
              {r.message && <p className="mt-2 whitespace-pre-line text-neutral-700">{r.message}</p>}
              <div className="mt-4">
                <RequestActions connectionId={r.connection_id} initialStatus={r.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
