// Legacy alias. The public profile now lives at the ROOT of the domain
// (releveconnect.com/<handle>, build spec §6). Anything that still points at the
// old /talent/<slug> path is redirected there so existing links keep working.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LegacyTalentRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/${slug}`);
}
