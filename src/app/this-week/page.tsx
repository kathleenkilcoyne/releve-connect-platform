// Route: /this-week
//
// Pass-one static prototype of the "This Week" calendar. This server component
// is intentionally thin: it pulls in the feature-scoped design tokens and mounts
// the client screen. When there's a real per-role dashboard shell, this screen
// drops into it unchanged (it's plain React + Tailwind, no route coupling).

import { ThisWeekScreen } from "@/components/this-week/ThisWeekScreen";
import "@/components/this-week/tokens.css";

export const metadata = {
  title: "This Week · Relevé Connect",
  description: "One calendar, every role — your week on Relevé Connect.",
};

export default function ThisWeekPage() {
  return <ThisWeekScreen />;
}
