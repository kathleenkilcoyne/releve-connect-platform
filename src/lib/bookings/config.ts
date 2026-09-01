// The Professional Services platform-fee rate — SERVER ONLY (reads via the
// service-role/admin Supabase client, same trust level as the Stripe secret key).
//
// Reads the EXISTING public.service_platform_fee_bps() Postgres function
// (created 2026-08-15, mirrors the swing_hourly_rate_cents pattern: the number
// lives in app_config, never in code, so changing it later is a config edit,
// not a deploy). Ratified at 300 bps (3%) on 2026-09-01 — see migration
// 20260901140100_set_service_platform_fee_bps.sql.
//
// The function returns NULL when unset. This accessor preserves that — it does
// NOT default to 300 or any other number in code, because the whole point of
// the app_config indirection is that Postgres is the single source of truth.
// A caller (the checkout route) MUST treat null as "refuse to charge."

import type { SupabaseClient } from "@supabase/supabase-js";

/** The current Relevé booking fee on a Professional Service, in basis points
 *  (300 = 3%), or null if unset — in which case checkout MUST refuse to charge. */
export async function getServicePlatformFeeBps(
  db: SupabaseClient,
): Promise<number | null> {
  const { data, error } = await db.rpc("service_platform_fee_bps");
  if (error) {
    console.error("[bookings] could not read service_platform_fee_bps:", error.message);
    return null;
  }
  return typeof data === "number" ? data : null;
}
