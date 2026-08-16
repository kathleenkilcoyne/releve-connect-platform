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
// service the member keeps hidden from the public — because reviewing means
// reading what was actually written.
//
// ── Contact details are the exception (founder decision, 2026-08-15) ──
// `business_email` / `business_phone` are shown ONLY when the member ticked the
// matching "show this on my public profile" box. A contact detail they chose to
// keep private stays private from the reviewer too.
//
// The earlier build did surface them to admins regardless, on the reasoning that
// reviewing means seeing everything. That was overridden: the member's answer to
// "do you want this published" is an answer about the detail itself, not only
// about one surface, and a privileged console is exactly where an unpublished
// phone number quietly becomes normal to look at. `show_*` now means the same
// thing everywhere. NOTE: a reviewer therefore cannot distinguish "left blank"
// from "kept private" — say so if that distinction is ever needed, because it
// would take a deliberate extra field, not a quiet re-widening of this one.
//
// Everything else stays out. `toAdminService` is an ALLOWLIST, not a spread:
// adding a column to professional_services does NOT silently surface it in the
// console. That is the property the tests pin, so a future column carrying
// something sensitive cannot leak here by default.
//
// The PUBLIC counterpart is toPublicService() in ./services. Both now apply the
// same contact rule; they differ only in that the admin also sees hidden
// services and the moderation state.

import { categoryLabel, locationLine, type ServiceRow } from "./services";

/**
 * One of a member's Professional Services, flattened for the admin console.
 * Contact fields are present only when the member published them (see header).
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
  /** Null unless the member ticked show_email. */
  business_email: string | null;
  /** Null unless the member ticked show_phone. */
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
    // Same rule as the public projection: an unpublished contact detail is not
    // shown here either. Deliberately NOT `row.business_email`.
    business_email: row.show_email ? row.business_email : null,
    business_phone: row.show_phone ? row.business_phone : null,
    shown_publicly: row.status === "active",
    moderation_status: row.moderation_status,
  };
}
