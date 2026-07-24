// The old "/studio" landing page now REDIRECTS to "/studios" (the V1 Studios
// path — the "Become a Founding Studio" interest form).
//
// Why the redirect and not a delete: the studio TOOLS at /studio/edit are still
// live (Kathleen's white-glove flow once a studio is onboarded), and old links
// or bookmarks to /studio should land somewhere sensible rather than 404. The
// public front door for studios is now the interest form, so that's where this
// goes. /studio/edit is a separate route and is unaffected.

import { redirect } from "next/navigation";

export default function StudioLandingRedirect() {
  redirect("/studios");
}
