// One-off setup: create the six membership tiers as Stripe Products + recurring
// (yearly) Prices, in whatever mode your STRIPE_SECRET_KEY points at (TEST now).
//
// Why a script: Stripe subscription Checkout needs a Price ID per tier (you can't
// pass an inline recurring price). This creates them idempotently — it keys each
// Price with a stable `lookup_key`, so re-running it reuses the existing Price
// instead of making duplicates. It prints the STRIPE_PRICE_* lines to paste into
// .env.local.
//
// Run:  node scripts/setup-stripe-tiers.mjs
// (Reads STRIPE_SECRET_KEY from the environment or .env.local.)

import Stripe from "stripe";
import { readFileSync } from "node:fs";

// --- tiny .env.local loader (no dependency) ---------------------------------
function loadEnvLocal() {
  try {
    const txt = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env.local — rely on the real environment */
  }
}
loadEnvLocal();

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY not set (env or .env.local). Aborting.");
  process.exit(1);
}
const stripe = new Stripe(key);
const live = key.startsWith("sk_live");

// Keep in lockstep with src/lib/membership/tiers.ts.
const TIERS = [
  { slug: "live_pass", label: "Live Pass", cents: 9_900, env: "STRIPE_PRICE_LIVE_PASS" },
  { slug: "professional", label: "Professional", cents: 14_900, env: "STRIPE_PRICE_PROFESSIONAL" },
  { slug: "professional_full", label: "Professional · Full", cents: 19_900, env: "STRIPE_PRICE_PROFESSIONAL_FULL" },
  { slug: "studio_connect", label: "Studio Connect", cents: 24_900, env: "STRIPE_PRICE_STUDIO_CONNECT" },
  { slug: "studio_growth", label: "Studio Growth", cents: 49_900, env: "STRIPE_PRICE_STUDIO_GROWTH" },
  { slug: "studio_accelerator", label: "Studio Accelerator", cents: 149_900, env: "STRIPE_PRICE_STUDIO_ACCELERATOR" },
];

console.log(`\nStripe mode: ${live ? "LIVE ⚠️" : "test"} — creating ${TIERS.length} annual tiers…\n`);

const out = [];
for (const t of TIERS) {
  const lookupKey = `releve_${t.slug}_annual`;

  // Reuse an existing Price with this lookup_key if present (idempotent).
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  let price = existing.data[0];

  if (!price) {
    const product = await stripe.products.create({
      name: `Relevé — ${t.label} (annual membership)`,
      metadata: { releve_tier: t.slug },
    });
    price = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: t.cents,
      recurring: { interval: "year" },
      lookup_key: lookupKey,
      metadata: { releve_tier: t.slug },
    });
    console.log(`  created  ${t.label.padEnd(22)} ${price.id}`);
  } else {
    console.log(`  reused   ${t.label.padEnd(22)} ${price.id}`);
  }
  out.push(`${t.env}=${price.id}`);
}

console.log(`\nPaste these into .env.local:\n`);
console.log(out.join("\n"));
console.log("");
