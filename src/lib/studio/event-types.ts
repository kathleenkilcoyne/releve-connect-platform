// Smart Calendar — the nine event TYPES the studio picks from (Slice 2).
//
// "What are you scheduling?" — the type the studio picks sets the family-facing
// label AND drives the target-picker, so the studio never thinks about
// "assignment targets" in the abstract. Storage never changes: the type is one
// `event_type` string on studio_classes; targeting is `enrollments` (the selected
// dancers) except the whole-studio types, which set `studio_wide`.
//
// Pure config — safe in both the client editor and the server routes.

import type { CompCollegeKind } from "./schedule";

/** How the type's target-picker behaves. */
export type TargetMode =
  | "dancers" // pick specific dancers from the roster (class / team / duet / trio / private / comp / audition / performance)
  | "studio_wide" // no picker — the whole studio (Full Studio Event)
  | "choice"; // whole studio OR a picked group (Parent Meeting)

export interface EventTypeDef {
  /** Stored in studio_classes.event_type. */
  slug: string;
  /** What the studio sees in the "What are you scheduling?" menu. */
  studioLabel: string;
  /** The family-facing label (default title). Duet/Trio refines this by count. */
  familyLabel: string;
  /** One-line studio-facing helper under the type. */
  hint: string;
  target: TargetMode;
  /** For `dancers`: how many the picker expects (guidance, softly enforced). */
  minDancers?: number;
  maxDancers?: number;
  /** May this type be targeted at reusable GROUPS (as well as individual dancers)?
   *  A class/team/comp yes; a duet/trio/private is inherently an individual pick. */
  groupsAllowed?: boolean;
  /** Maps onto the existing studio_classes.kind so This Week colours it sensibly. */
  kind: CompCollegeKind;
}

export const EVENT_TYPES: EventTypeDef[] = [
  {
    slug: "class",
    studioLabel: "Class",
    familyLabel: "Class",
    hint: "A class — pick its group, or dancers.",
    target: "dancers",
    groupsAllowed: true,
    kind: "rehearsal",
  },
  {
    slug: "company_rehearsal",
    studioLabel: "Company / Team Rehearsal",
    familyLabel: "Company Rehearsal",
    hint: "Your team rehearses — pick the team (a group).",
    target: "dancers",
    groupsAllowed: true,
    kind: "rehearsal",
  },
  {
    slug: "duet_trio",
    studioLabel: "Duet / Trio Rehearsal",
    familyLabel: "Trio Rehearsal",
    hint: "Pick 2–3 dancers; only those families get it.",
    target: "dancers",
    minDancers: 2,
    maxDancers: 3,
    kind: "rehearsal",
  },
  {
    slug: "solo_private",
    studioLabel: "Solo / Private",
    familyLabel: "Solo Private",
    hint: "Pick one dancer; only that family gets it.",
    target: "dancers",
    minDancers: 1,
    maxDancers: 1,
    kind: "rehearsal",
  },
  {
    slug: "full_studio_event",
    studioLabel: "Full Studio Event",
    familyLabel: "Full Studio Event",
    hint: "Everyone at your studio sees this — no need to pick dancers.",
    target: "studio_wide",
    kind: "performance",
  },
  {
    slug: "parent_meeting",
    studioLabel: "Parent Meeting",
    familyLabel: "Parent Meeting",
    hint: "The whole studio, or just a specific group.",
    target: "choice",
    groupsAllowed: true,
    kind: "deadline",
  },
  {
    slug: "competition",
    studioLabel: "Competition",
    familyLabel: "Competition",
    hint: "A team/class (group) or selected dancers.",
    target: "dancers",
    groupsAllowed: true,
    kind: "competition",
  },
  {
    slug: "audition",
    studioLabel: "Audition",
    familyLabel: "Audition",
    hint: "A team/class (group) or selected dancers.",
    target: "dancers",
    groupsAllowed: true,
    kind: "audition",
  },
  {
    slug: "performance",
    studioLabel: "Performance",
    familyLabel: "Performance",
    hint: "A team/class (group) or selected dancers.",
    target: "dancers",
    groupsAllowed: true,
    kind: "performance",
  },
];

export const EVENT_TYPE_BY_SLUG: Record<string, EventTypeDef> = Object.fromEntries(
  EVENT_TYPES.map((t) => [t.slug, t]),
);

/** The family-facing label for a saved event — Duet/Trio refines by dancer count. */
export function familyLabelFor(eventType: string | null, dancerCount = 0): string {
  const def = eventType ? EVENT_TYPE_BY_SLUG[eventType] : undefined;
  if (!def) return "Event";
  if (def.slug === "duet_trio") {
    if (dancerCount === 2) return "Duet Rehearsal";
    if (dancerCount === 3) return "Trio Rehearsal";
    return "Group Rehearsal";
  }
  return def.familyLabel;
}

/** Best-effort event_type for a legacy row that only has a kind. */
export function eventTypeFromKind(kind: string | null): string {
  switch (kind) {
    case "competition":
      return "competition";
    case "audition":
      return "audition";
    case "performance":
      return "performance";
    case "deadline":
      return "parent_meeting";
    default:
      return "company_rehearsal";
  }
}
