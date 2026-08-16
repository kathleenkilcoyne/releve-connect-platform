// Professional Services — the ADMIN projection.
//
// Extracted from the admin applications console so the rule about what a
// reviewer may see can be unit-tested. Pure: no DB, no React, no env.
//
// ── The rule, stated plainly ──
// The admin console is a session-gated surface: a signed-in user whose
// `users.account_type` is 'admin' (see requireAdminPage). A signed-in NON-admin
// gets a 404, so the console's existence is not even discoverable.
//
// Within that surface the reviewer sees WHAT THE MEMBER ENTERED — including a
// service kept hidden from the public, and business contact details the member
// chose not to publish — because reviewing an application means reading what
// was actually written. This is a deliberate, admin-only allowance and is the
// ONLY place private contact fields cross out of the database.
//
// Everything else stays out. `toAdminService` is an ALLOWLIST, not a spread:
// adding a column to professional_services does NOT silently surface it in the
// console. That is the property the tests pin, so a future column carrying
// something sensitive cannot leak here by default.
//
// The PUBLIC counterpart is toPublicService() in ./services, which strips any
// contact detail the member did not explicitly opt into displaying.

import { categoryLabel, locationLine, type ServiceRow } from "./services";

/**
 * One of a member's Professional Services, flattened for the admin console.
 * Contact fields are present BY DESIGN (see the module header) and must never
 * be rendered on any non-admin surface.
 */
export type AdminService = {
  id: string;
  business_name: string;
  /** Human category label — "Other" resolves to the member's own words. */
  category: string;
  /** "New York / Mobile", or null. */
  location: string | null;
  short_description: string | null;
  website_url: string | null;
  social_url: string | null;
  /** ADMIN-ONLY. Shown regardless of show_email, for review. */
  business_email: string | null;
  /** ADMIN-ONLY. Shown regardless of show_phone, for review. */
  business_phone: string | null;
  /** Whether the member currently displays this on their public profile. */
  shown_publicly: boolean;
  moderation_status: string;
};

/**
 * The exact set of keys an AdminService carries. Exported so a test can assert
 * the projection never grows silently — if a field is added here deliberately,
 * the test fails until this list is updated too.
 */
export const ADMIN_SERVICE_KEYS = [
  "id",
  "business_name",
  "category",
  "location",
  "short_description",
  "website_url",
  "social_url",
  "business_email",
  "business_phone",
  "shown_publicly",
  "moderation_status",
] as const;

/**
 * Project one stored row into what the admin console renders. Allowlist only —
 * never a spread of the source row. Pure.
 */
export function toAdminService(row: ServiceRow): AdminService {
  return {
    id: row.id,
    business_name: row.business_name,
    category: categoryLabel(row.category, row.category_other_label),
    location: locationLine(row.location, row.service_type),
    short_description: row.short_description,
    website_url: row.website_url,
    social_url: row.social_url,
    business_email: row.business_email,
    business_phone: row.business_phone,
    shown_publicly: row.status === "active",
    moderation_status: row.moderation_status,
  };
}
