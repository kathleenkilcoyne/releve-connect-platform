import type { SupabaseClient } from "@supabase/supabase-js";
import { setEventTargets } from "./team-enrollments";

// Reusable groups + the derive-and-recompute engine for the Smart Calendar
// (Slice C). Groups are persistent named rosters scoped to one studio. An event
// remembers the GROUPS it targets (studio_class_groups) plus any individually-
// added dancers (studio_class_dancers) plus studio_wide. `enrollments` — the
// roster This Week reads — is DERIVED from those:
//
//   enrollments(event) = distinct( members of targeted groups ∪ added dancers )
//
// Recompute it when the event's targets change OR a targeted group's membership
// changes — that is what makes "edit the group once → every event using it
// updates." De-dupe is inherent: distinct() on resolve + the unique
// (student_id, class_id) on enrollments.
//
// Everything is scoped to `employerId` (the caller's own studio, already
// verified by the route), and only groups of that studio / dancers affiliated to
// it are ever stored — a studio can't reach another's groups or dancers.

/** Group ids of this employer, filtered from a requested set. */
async function ownGroupIds(
  admin: SupabaseClient,
  employerId: string,
  groupIds: string[],
): Promise<string[]> {
  if (!groupIds.length) return [];
  const { data } = await admin
    .from("studio_groups")
    .select("group_id")
    .eq("employer_id", employerId)
    .in("group_id", [...new Set(groupIds)]);
  return ((data ?? []) as { group_id: string }[]).map((r) => r.group_id);
}

/** Student ids affiliated (active) to this studio, filtered from a requested set. */
async function affiliatedStudentIds(
  admin: SupabaseClient,
  employerId: string,
  studentIds: string[],
): Promise<string[]> {
  if (!studentIds.length) return [];
  const { data } = await admin
    .from("affiliations")
    .select("subject_id")
    .eq("employer_id", employerId)
    .eq("subject_kind", "student")
    .eq("status", "active")
    .in("subject_id", [...new Set(studentIds)]);
  return ((data ?? []) as { subject_id: string }[]).map((r) => r.subject_id);
}

/** Recompute one event's enrollments from its stored targets. */
export async function resolveEventEnrollments(
  admin: SupabaseClient,
  employerId: string,
  classId: string,
): Promise<void> {
  const { data: cls } = await admin
    .from("studio_classes")
    .select("studio_wide")
    .eq("class_id", classId)
    .maybeSingle();
  const studioWide = (cls as { studio_wide?: boolean } | null)?.studio_wide ?? false;

  // Whole-studio events carry no enrollments — they're resolved against
  // affiliations at read time (family-delivery slice). Clear any enrollments.
  if (studioWide) {
    await setEventTargets(admin, employerId, classId, []);
    return;
  }

  // Union of the targeted groups' members and the individually-added dancers.
  const { data: grpRows } = await admin
    .from("studio_class_groups")
    .select("group_id")
    .eq("class_id", classId);
  const groupIds = ((grpRows ?? []) as { group_id: string }[]).map((r) => r.group_id);

  const union = new Set<string>();
  if (groupIds.length) {
    const { data: memRows } = await admin
      .from("studio_group_members")
      .select("student_id")
      .in("group_id", groupIds);
    for (const m of (memRows ?? []) as { student_id: string }[]) union.add(m.student_id);
  }
  const { data: dancerRows } = await admin
    .from("studio_class_dancers")
    .select("student_id")
    .eq("class_id", classId);
  for (const d of (dancerRows ?? []) as { student_id: string }[]) union.add(d.student_id);

  // setEventTargets sets enrollments to exactly this set (and re-filters to
  // affiliated dancers), de-duped by the enrollments unique key.
  await setEventTargets(admin, employerId, classId, [...union]);
}

/** Set an event's targets (groups + individually-added dancers + studio_wide),
 *  then recompute its enrollments. Used by event create/edit. */
export async function setEventTargeting(
  admin: SupabaseClient,
  employerId: string,
  classId: string,
  targets: { studio_wide: boolean; group_ids: string[]; student_ids: string[] },
): Promise<void> {
  const validGroups = targets.studio_wide ? [] : await ownGroupIds(admin, employerId, targets.group_ids);
  const validDancers = targets.studio_wide
    ? []
    : await affiliatedStudentIds(admin, employerId, targets.student_ids);

  // Replace the event's group targets.
  await admin.from("studio_class_groups").delete().eq("class_id", classId);
  if (validGroups.length) {
    await admin
      .from("studio_class_groups")
      .insert(validGroups.map((group_id) => ({ class_id: classId, group_id })));
  }

  // Replace the event's individually-added dancers.
  await admin.from("studio_class_dancers").delete().eq("class_id", classId);
  if (validDancers.length) {
    await admin
      .from("studio_class_dancers")
      .insert(validDancers.map((student_id) => ({ class_id: classId, student_id })));
  }

  await resolveEventEnrollments(admin, employerId, classId);
}

/** Recompute every event that targets a given group (after its membership changes). */
export async function resolveEventsForGroup(
  admin: SupabaseClient,
  employerId: string,
  groupId: string,
): Promise<void> {
  const { data } = await admin
    .from("studio_class_groups")
    .select("class_id")
    .eq("group_id", groupId);
  const classIds = ((data ?? []) as { class_id: string }[]).map((r) => r.class_id);
  for (const classId of classIds) {
    await resolveEventEnrollments(admin, employerId, classId);
  }
}

/* ─────────────────────────────  Group CRUD  ───────────────────────────────── */

export type GroupResult = { ok: true; group_id?: string } | { ok: false; error: string };

/** Confirm a group belongs to this studio. */
async function groupBelongs(admin: SupabaseClient, employerId: string, groupId: string): Promise<boolean> {
  const { data } = await admin
    .from("studio_groups")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("employer_id", employerId)
    .maybeSingle();
  return Boolean(data);
}

export async function createGroup(
  admin: SupabaseClient,
  employerId: string,
  name: string,
): Promise<GroupResult> {
  const clean = name.trim();
  if (!clean) return { ok: false, error: "Give the group a name." };
  if (clean.length > 100) return { ok: false, error: "That group name is too long." };
  const { data, error } = await admin
    .from("studio_groups")
    .insert({ employer_id: employerId, name: clean })
    .select("group_id")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, error: "You already have a group with that name." };
    return { ok: false, error: error.message };
  }
  return { ok: true, group_id: (data as { group_id: string }).group_id };
}

/** Rename and/or replace a group's members; recompute events using it. */
export async function updateGroup(
  admin: SupabaseClient,
  employerId: string,
  groupId: string,
  patch: { name?: string; member_ids?: string[] },
): Promise<GroupResult> {
  if (!(await groupBelongs(admin, employerId, groupId))) {
    return { ok: false, error: "Group not found for your studio." };
  }

  if (patch.name !== undefined) {
    const clean = patch.name.trim();
    if (!clean) return { ok: false, error: "Give the group a name." };
    const { error } = await admin
      .from("studio_groups")
      .update({ name: clean, updated_at: new Date().toISOString() })
      .eq("group_id", groupId);
    if (error) {
      if (error.code === "23505") return { ok: false, error: "You already have a group with that name." };
      return { ok: false, error: error.message };
    }
  }

  if (patch.member_ids !== undefined) {
    const valid = await affiliatedStudentIds(admin, employerId, patch.member_ids);
    const validSet = new Set(valid);

    const { data: existing } = await admin
      .from("studio_group_members")
      .select("student_id")
      .eq("group_id", groupId);
    const existingSet = new Set(((existing ?? []) as { student_id: string }[]).map((r) => r.student_id));

    const toRemove = [...existingSet].filter((s) => !validSet.has(s));
    if (toRemove.length) {
      await admin.from("studio_group_members").delete().eq("group_id", groupId).in("student_id", toRemove);
    }
    const toAdd = valid.filter((s) => !existingSet.has(s));
    if (toAdd.length) {
      await admin
        .from("studio_group_members")
        .insert(toAdd.map((student_id) => ({ group_id: groupId, student_id })));
    }

    // Edit the group once → every event using it updates.
    await resolveEventsForGroup(admin, employerId, groupId);
  }

  return { ok: true, group_id: groupId };
}

export async function deleteGroup(
  admin: SupabaseClient,
  employerId: string,
  groupId: string,
): Promise<GroupResult> {
  if (!(await groupBelongs(admin, employerId, groupId))) {
    return { ok: false, error: "Group not found for your studio." };
  }
  // Which events targeted it? Capture BEFORE the cascade removes the links.
  const { data: affected } = await admin
    .from("studio_class_groups")
    .select("class_id")
    .eq("group_id", groupId);
  const classIds = ((affected ?? []) as { class_id: string }[]).map((r) => r.class_id);

  const { error } = await admin.from("studio_groups").delete().eq("group_id", groupId);
  if (error) return { ok: false, error: error.message };

  // Those events lose this group's members — recompute them.
  for (const classId of classIds) {
    await resolveEventEnrollments(admin, employerId, classId);
  }
  return { ok: true, group_id: groupId };
}
