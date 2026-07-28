// /studio/edit → /studio/setup (2026-07-28).
//
// The studio builder is now the invite-gated /studio/setup (spec:
// STUDIO-ONBOARDING-ONE-FLOW-FROM-KATHLEEN.md). This old route stays only so
// existing links and bookmarks land somewhere sensible — it forwards into the
// single door, which applies the invite/ownership gate. A visitor who isn't a
// bound studio owner gets the "you need an invitation" notice there, never the
// builder.

import { redirect } from "next/navigation";

export default function StudioEditRedirect() {
  redirect("/studio/setup");
}
