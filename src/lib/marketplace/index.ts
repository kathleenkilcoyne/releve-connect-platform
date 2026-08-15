// Barrel for the Marketplace lib (mirrors @/lib/offerings). Phase 3 exposes only
// the feature flag and the pure domain types — no economics, no persistence.
export { isGeneralMarketplaceEnabled } from "./flags";
export * from "./types";
