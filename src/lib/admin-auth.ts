// Minimal gate for the pre-launch admin/test console.
//
// The app has no login yet, but the admin write routes use the service-role key
// (they bypass RLS), so they must NOT be open to the world. Until real admin auth
// exists, we require a shared secret: set ADMIN_TOKEN in .env.local, and the admin
// page sends it as the `x-admin-token` header. Fail CLOSED — if ADMIN_TOKEN isn't
// set on the server, every admin write is refused.

import { NextResponse } from "next/server";

export type AdminCheck =
  | { ok: true }
  | { ok: false; response: NextResponse };

export function requireAdmin(req: Request): AdminCheck {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Admin tools are locked: set ADMIN_TOKEN in .env.local first." },
        { status: 503 },
      ),
    };
  }
  const got = req.headers.get("x-admin-token");
  if (!got || got !== expected) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Wrong or missing admin token." },
        { status: 401 },
      ),
    };
  }
  return { ok: true };
}

/** Lowercase, hyphenated slug from a display name (with a short random suffix). */
export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "artist"}-${suffix}`;
}
