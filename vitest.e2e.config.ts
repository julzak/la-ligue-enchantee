import { defineConfig } from "vitest/config";
import path from "path";

// Config E2E SÉPARÉE de la gate unitaire : ne tourne QUE via `npm run test:e2e`
// (jamais dans `npm test`, qui doit rester sans DB ni app). Les fichiers `.e2e.ts`
// ne matchent pas le glob par défaut (`.test.ts`), donc la gate les ignore.
export default defineConfig({
  test: {
    globals: true,
    include: ["tests/e2e/**/*.e2e.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false, // les fichiers partagent l'état de l'enchère : séquentiel
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
