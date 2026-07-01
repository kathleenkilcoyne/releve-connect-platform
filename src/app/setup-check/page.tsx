// A friendly "is the database connected?" page. Visit http://localhost:3000/setup-check
// after you've added your Supabase keys and run schema.sql + seed.sql.
//
// It tries to read the category lists from your database and reports what it found.
// Green = working. Red = something's not set up yet, with a plain-English hint.

import { createClient } from "@/lib/supabase/server";

// Always run fresh (don't cache) so the check reflects the live database.
export const dynamic = "force-dynamic";

async function checkDatabase() {
  try {
    const supabase = await createClient();

    // Count rows in each pick-list table to confirm schema + seed both ran.
    const checks = await Promise.all(
      (["styles", "levels", "focus_areas", "role_types", "open_to_badges"] as const).map(
        async (table) => {
          const { count, error } = await supabase
            .from(table)
            .select("*", { count: "exact", head: true });
          return { table, count: count ?? 0, error: error?.message ?? null };
        },
      ),
    );

    return { ok: true as const, checks };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

export default async function SetupCheckPage() {
  const result = await checkDatabase();

  return (
    <main className="mx-auto flex max-w-xl flex-1 flex-col justify-center px-6 py-24">
      <h1 className="text-2xl font-semibold text-neutral-900">Setup check</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Confirms the app can reach your Supabase database and that the category
        lists loaded.
      </p>

      {!result.ok ? (
        <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="font-medium text-red-800">✗ Not connected yet</p>
          <p className="mt-2 text-sm text-red-700">{result.message}</p>
          <p className="mt-3 text-sm text-red-700">
            Next: follow{" "}
            <span className="font-mono">docs/SETUP-SUPABASE.md</span>, then reload
            this page.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-2">
          {result.checks.map(({ table, count, error }) => {
            const good = !error && count > 0;
            return (
              <div
                key={table}
                className={`flex items-center justify-between rounded-lg border p-3 ${
                  good
                    ? "border-green-200 bg-green-50"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                <span className="font-mono text-sm text-neutral-700">{table}</span>
                <span
                  className={`text-sm ${good ? "text-green-800" : "text-amber-800"}`}
                >
                  {error
                    ? `✗ ${error}`
                    : count > 0
                      ? `✓ ${count} items`
                      : "⚠ 0 items — did seed.sql run?"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
