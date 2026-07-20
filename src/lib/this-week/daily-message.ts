// "You Matter Here" — the daily message.
//
// One short line, chosen by day-of-year so it is STABLE ALL DAY (the same line
// every time you open the app on a given day) and cycles about once a month.
//
// Display-only by design: a plain array, no table, no admin screen. These are
// Kathleen's own words, and they change roughly never — a data model here would
// be machinery around a constant.
//
// Adding or reordering lines shifts which line lands on which day. That is
// harmless; nothing references a line by index.

/** Kathleen's message bank — her words, verbatim. */
export const DAILY_MESSAGES: readonly string[] = [
  "Deep down, you already know what to do.",
  "Just breathe. It will work itself out.",
  "We don't rise to the level of our goals — we fall to the level of our standards.",
  "You matter, so does today. Make it count.",
  "Your life is unwritten. Make today's page beautiful.",
  "Your gift is meant to be shared. So do it.",
  "There is no one else quite like you.",
  "Today, you will be someone's blessing.",
  "There is nothing wrong with you because it hasn't happened yet — there is only ripening.",
  "Sometimes the wait is the work.",
  "You were meant to flow, not force.",
  "You owe no one your journey.",
  "Your life is always speaking to you — are you available to listen?",
  "Gratitude is a game-changer — so start with yourself.",
  "Be mindful of the energy you bring to any space; that part is your responsibility.",
  "Lean into the part of you that is drawn to hope.",
  "All you have is this precious, present moment.",
  "Do not let fear be your guiding light. You already know, deep down, what to do.",
  "Awakening is simply you listening to your inner voice. Once you're aware, you are conscious.",
  "Move from the truest sense of who you are. The rest is just noise.",
  "Define your intention. It will determine your cause and effect.",
  "Choose you every time. It's the only one you're competing with anyway.",
  "You are the author of your story. Write it the way you truly want it to go.",
  "Everything you want is just on the other side of a decision. So make it.",
  "Time stops for no one. Nor should you.",
  "Offer yourself the grace you would bestow upon someone else.",
  "Your body is the greatest instrument you will ever own.",
  "Yesterday has no place here. Today is your best shot — take it.",
  "You are worthy. Period.",
  "The best predictor of your future outcome is your past behavior. Decide if you want to make a change.",
];

/**
 * Which day of the year `date` falls on, as seen in `timeZone` (1 = Jan 1).
 *
 * Computed from the ZONE'S OWN calendar date rather than from a UTC timestamp:
 * at 11pm in New York it is already tomorrow in UTC, and the message must not
 * flip over while someone is still having their evening.
 */
function dayOfYearInZone(timeZone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");

  const year = get("year");
  const start = Date.UTC(year, 0, 1);
  const today = Date.UTC(year, get("month") - 1, get("day"));
  return Math.floor((today - start) / 86_400_000) + 1;
}

/**
 * Today's line. The same for everyone in a timezone, all day.
 *
 * `now` is injectable so tests can pin a date instead of reading the clock.
 */
export function messageForDay(
  timeZone = "America/New_York",
  now: Date = new Date(),
): string {
  const index = (dayOfYearInZone(timeZone, now) - 1) % DAILY_MESSAGES.length;
  return DAILY_MESSAGES[index];
}
