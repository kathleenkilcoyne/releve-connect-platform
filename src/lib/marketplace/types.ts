// Marketplace domain TYPES — pure TypeScript only. No database, no Stripe, no
// economics, no fee percentage. These describe the SHAPE of the future Marketplace
// (per docs/Marketplace_Phase2_Architecture_2026-08-14.md) so Phase-3 UI scaffolding
// has stable vocabulary. Nothing here charges, persists, or computes money.
//
// Ring-fence reminder: `product_type` is the axis that keeps Senior Spotlight's
// fixed $499 / 80-20 economics separate from the General Marketplace's future
// configurable fee. Phase 3 introduces the vocabulary only — the economics resolver
// and any pricing math are Phase 4, behind the inactive fee config.

/**
 * Which marketplace product a listing belongs to. The economics that will later
 * attach to a sale are resolved from THIS value (Phase 4), never from artist status.
 * - `senior_spotlight`: the curated $499 / 80-20 collection (its own live system).
 * - `general_license`: the seller-priced, configurable-fee licensing marketplace.
 */
export type MarketplaceProductType = "senior_spotlight" | "general_license";

/**
 * License shapes the General Marketplace is designed to support (future controls;
 * none status-dependent). Standard/Open is the simplest; Limited caps sales;
 * Exclusive blocks everything else in scope for the term.
 */
export type LicenseType = "standard" | "limited" | "exclusive";

/** Permitted-use tags a license may carry (informational vocabulary for scaffolding). */
export type PermittedUse = "competition" | "concert" | "recital" | "education";

/** Human-readable labels for the license types (UI scaffolding copy). */
export const LICENSE_TYPE_LABEL: Record<LicenseType, string> = {
  standard: "Standard",
  limited: "Limited",
  exclusive: "Exclusive",
};

/**
 * The nested Marketplace structure from the ratified architecture:
 *   Marketplace → Senior Spotlight → General Licensing → Commissions (later) → …
 * Slugs only; a real collections table is a Phase-4 concern.
 */
export const MARKETPLACE_COLLECTION_SLUGS = [
  "senior_spotlight",
  "general_licensing",
  "commissions",
] as const;
export type MarketplaceCollectionSlug = (typeof MARKETPLACE_COLLECTION_SLUGS)[number];

/**
 * A non-persisted shape for the seller-workspace UI to reason about a listing in
 * scaffolding. NOT a database row — there is no marketplace listings table in
 * Phase 3. Money fields are intentionally absent here; pricing is Phase 4.
 */
export interface MarketplaceListingDraft {
  productType: MarketplaceProductType;
  collection: MarketplaceCollectionSlug;
  title: string;
  summary?: string;
  licenseType?: LicenseType;
  permittedUse?: PermittedUse[];
}
