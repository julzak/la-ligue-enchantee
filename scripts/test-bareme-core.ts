/**
 * Wrapper CLI — bareme de scoring (les 4 cas CLAUDE.md + config + epinglage).
 * Source de verite : src/lib/scoring-core.test.ts (vitest). Ce script lance
 * vitest en mode run sur ce fichier pour une execution ad-hoc depuis la CLI.
 *
 * Usage : ./node_modules/.bin/tsx scripts/test-bareme-core.ts
 */
import { execSync } from "child_process";
execSync(
  "./node_modules/.bin/vitest run --reporter=verbose src/lib/scoring-core.test.ts",
  { stdio: "inherit" }
);
