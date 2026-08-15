// Server-side feature flag for the General Marketplace rollout (Phase 3+).
//
// Mirrors the Professional Offerings flag pattern EXACTLY. Defaults OFF so every
// Phase-3 addition (the public "For Choreographers" page, the seller workspace
// shell, the profile doorway) is INVISIBLE and unreachable in production until
// deliberately turned on — and turning it off is instant, no redeploy.
//
// SCOPE: this flag gates only NON-ECONOMIC scaffolding. No transaction path,
// checkout, or fee exists in Phase 3, so there is nothing to bypass even with the
// flag on. When commerce is built (Phase 4+), real General Marketplace purchasing
// is ADDITIONALLY gated by `marketplace_fee_config.active` (the fee is unratified
// and inactive). Senior Spotlight ($499) is a SEPARATE system, NOT affected here.

/**
 * The General Marketplace feature (licensing + commissions for the seller-enabled
 * membership). When OFF: the public Marketplace page, the seller workspace, and the
 * profile doorway are not rendered/reachable. Keep OFF in production until the
 * seller workflow is built AND the fee rate is ratified.
 */
export function isGeneralMarketplaceEnabled(): boolean {
  return process.env.GENERAL_MARKETPLACE_ENABLED === "true";
}
