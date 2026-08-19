// Vitest configuration.
//
// Only reason this file exists: resolve the `@/…` path alias that tsconfig
// defines. Every earlier test in this repo is a pure function imported by
// relative path, so the alias never came up. The Professional Services action
// tests exercise real server actions, and those import `@/lib/supabase/server`
// and friends — without this mapping Vitest cannot resolve them.
//
// No test-behavior settings are configured here on purpose: the default include
// pattern, environment, and reporters are unchanged, so `npm test` runs exactly
// the same suite it did before.

import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Mirrors "paths": { "@/*": ["./src/*"] } in tsconfig.json.
      "@": path.resolve(process.cwd(), "src"),
    },
  },
});
