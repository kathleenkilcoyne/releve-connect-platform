// The home page. Right now it's a simple branded placeholder that proves the
// site runs. We'll replace it with the real product (talent profiles, employer
// search) as we build the vertical slice.

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
        Relevé Connect
      </p>

      <h1 className="max-w-2xl text-4xl font-semibold leading-tight text-neutral-900 sm:text-5xl">
        National infrastructure for the dance industry.
      </h1>

      <p className="mt-6 max-w-xl text-lg text-neutral-600">
        A searchable home for dance professionals — where studios discover the
        dancers, teachers, and choreographers this industry has always run on.
      </p>

      <p className="mt-10 text-sm italic text-neutral-500">
        together we rise · nous nous levons · relevé
      </p>

      <p className="mt-16 rounded-full border border-neutral-200 px-4 py-1.5 text-xs text-neutral-400">
        🚧 Phase 1 — foundation. The profile system is being built.
      </p>
    </main>
  );
}
