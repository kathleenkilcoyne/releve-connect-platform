// PUBLIC "For Choreographers" — the Marketplace's editorial front door.
//
// Phase 3 scaffolding: structure and language only, no commerce. The page carries
// the ratified positioning (docs/Marketplace_Phase2_Architecture §13) — the artist
// owns the work, sets the price, and Relevé builds the infrastructure that lets it
// sell. NO prices, NO fee, NO buy/list actions here.
//
// GATE: behind GENERAL_MARKETPLACE_ENABLED. With the flag OFF (production) this route
// redirects to home, so it is invisible and unreachable — no direct-URL bypass.

import { redirect } from "next/navigation";
import Link from "next/link";
import { isGeneralMarketplaceEnabled } from "@/lib/marketplace/flags";

export const dynamic = "force-dynamic";

export default function MarketplaceForChoreographersPage() {
  if (!isGeneralMarketplaceEnabled()) redirect("/");

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
        Relevé · Marketplace
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">For Choreographers</h1>

      <p className="mt-5 text-lg text-neutral-700">
        The artist owns the work. The artist decides what they want to earn. Relevé creates the
        infrastructure that allows the work to sell.
      </p>

      <div className="mt-10 space-y-6 text-neutral-600">
        <p>
          The Relevé Marketplace is where approved professionals license original choreography —
          with discovery, terms, payment, records, and provenance handled for you. You keep
          ownership of your work; Relevé creates the record around it.
        </p>
        <p>
          Relevé earns only when your intellectual property sells through the Marketplace. It takes
          <span className="font-medium text-neutral-900"> nothing from the labor that follows</span> —
          the teaching, setting, coaching, or rehearsal a buyer may hire you for after a license is a
          separate agreement, and it is entirely yours.
        </p>
        <p>
          After the license sale, Relevé steps back.
        </p>
      </div>

      <div className="mt-10 rounded-2xl border border-[#e3d9c3] bg-[#f6f1e7] p-6">
        <p className="text-sm font-medium uppercase tracking-[0.15em] text-[#a99e86]">
          Senior Spotlight
        </p>
        <p className="mt-2 text-neutral-700">
          Our first curated collection — college-audition choreography from selected artists — is the
          Marketplace&apos;s launch collection, not its endpoint. General licensing and future creative
          commerce build on the same foundation.
        </p>
      </div>

      <Link href="/" className="mt-12 inline-block text-sm text-neutral-400 underline">
        together we rise · relevé
      </Link>
    </main>
  );
}
