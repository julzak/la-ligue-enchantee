import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Les tests tournent en environnement node par défaut (modules purs de
  // src/lib). Un test qui monte un composant React déclare
  // `// @vitest-environment jsdom` en tête de fichier.
  // Le tsconfig Next est en `jsx: preserve` (Next transforme lui-même) : hors
  // Next, esbuild doit être explicite pour compiler le TSX des tests.
  oxc: { jsx: { runtime: "automatic" } },
});
