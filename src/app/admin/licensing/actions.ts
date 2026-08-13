"use server";

// Admin review actions for licensing works. Gated to signed-in admins
// (`users.account_type='admin'`, the same rule as requireAdminPage) and writing
// through the service-role client, exactly like the other admin consoles. The
// status machine is enforced here — an illegal transition is refused, never
// guessed.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  adminTransition,
  WORK_SELECT,
  type AdminAction,
  type WorkRecord,
  type WorkStatus,
} from "@/lib/professional/licensing";

async function callerIsAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const admin = createAdminClient();
  const { data } = await admin
    .from("users")
    .select("account_type")
    .eq("user_id", user.id)
    .maybeSingle();
  return (data as { account_type?: string } | null)?.account_type === "admin";
}

export interface ReviewResult {
  ok: boolean;
  work?: WorkRecord;
  error?: string;
}

/**
 * Move a work through the review lifecycle: start_review · approve · return ·
 * decline. `note` is recorded on return/decline so the artist knows why.
 */
export async function reviewWork(
  workId: string,
  action: AdminAction,
  note?: string,
): Promise<ReviewResult> {
  if (!(await callerIsAdmin())) return { ok: false, error: "forbidden" };

  const admin = createAdminClient();
  const { data: current } = await admin
    .from("works")
    .select("status")
    .eq("work_id", workId)
    .maybeSingle();
  const status = (current as { status: WorkStatus } | null)?.status;
  if (!status) return { ok: false, error: "not_found" };

  const next = adminTransition(status, action);
  if (!next) return { ok: false, error: "illegal_transition" };

  const patch: Record<string, unknown> = {
    status: next,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (action === "return" || action === "decline") {
    patch.review_notes = (note ?? "").trim() || null;
  }

  const { data, error } = await admin
    .from("works")
    .update(patch)
    .eq("work_id", workId)
    .select(WORK_SELECT)
    .single();

  if (error || !data) return { ok: false, error: "update_failed" };
  revalidatePath("/admin/licensing");
  return { ok: true, work: data as unknown as WorkRecord };
}
