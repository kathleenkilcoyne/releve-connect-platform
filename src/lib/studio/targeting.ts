// Smart Calendar — the PURE core of event targeting (Slice 4).
//
// The audience math that decides "who is enrolled in this event" and "what
// changes when the audience changes" is pulled out of the DB-bound helpers
// (groups.ts / team-enrollments.ts) into these two pure functions so the three
// family-safe safeguards can be PROVEN without a database:
//
//   · unionTargetedDancers — an event's roster = distinct(union of its targeted
//     groups' members ∪ individually-added dancers). De-dupe is inherent, so a
//     dancer in two targeted groups (or added twice) resolves to ONE enrollment.
//     (Family-safe safeguard #1, at the enrollment-set level.)
//
//   · diffEnrollments — given who is enrolled NOW and who SHOULD be, split into
//     add / remove / keep. This is what makes "change the audience" reach only
//     the affected families: removed dancers' families stop seeing the event,
//     added ones start, and everyone already enrolled and still targeted is left
//     exactly as they were. (Family-safe safeguard #3.)
//
// No Supabase, no I/O — the DB helpers call these, then apply the result.

/**
 * The distinct set of dancers an event targets: the union of every targeted
 * group's members and any individually-added dancers, de-duplicated. Order is
 * stable (first appearance wins) so callers and tests are deterministic.
 */
export function unionTargetedDancers(
  groupMemberLists: string[][],
  addedDancers: string[] = [],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of groupMemberLists) {
    for (const id of list) {
      if (!seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  }
  for (const id of addedDancers) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/** The three-way split between the current roster and the desired roster. */
export type EnrollmentDiff = {
  /** Newly targeted — their families START seeing the event. */
  toAdd: string[];
  /** No longer targeted — their families STOP seeing the event. */
  toRemove: string[];
  /** Already enrolled and still targeted — left exactly as they were. */
  unchanged: string[];
};

/**
 * Compare the current enrollment set to the desired one. Inputs are de-duped
 * defensively (a duplicate in either list never produces a duplicate action),
 * so the result is the minimal set of writes that moves `existing` to `desired`.
 * The unchanged set is what guarantees "everyone else untouched".
 */
export function diffEnrollments(existing: string[], desired: string[]): EnrollmentDiff {
  const existingSet = new Set(existing);
  const desiredSet = new Set(desired);

  const toAdd: string[] = [];
  for (const id of desiredSet) {
    if (!existingSet.has(id)) toAdd.push(id);
  }
  const toRemove: string[] = [];
  const unchanged: string[] = [];
  for (const id of existingSet) {
    if (desiredSet.has(id)) unchanged.push(id);
    else toRemove.push(id);
  }
  return { toAdd, toRemove, unchanged };
}
