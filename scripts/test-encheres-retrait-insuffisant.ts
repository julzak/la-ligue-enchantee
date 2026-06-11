/**
 * Wrapper CLI — cas "retrait insuffisant" du contrat enchères.
 * La source de vérité est src/lib/auction-engine.test.ts (vitest).
 *
 * Usage : ./node_modules/.bin/tsx scripts/test-encheres-retrait-insuffisant.ts
 */
import { execSync } from "child_process";
execSync(
  './node_modules/.bin/vitest run --reporter=verbose src/lib/auction-engine.test.ts -t "insuffisant"',
  { stdio: "inherit" }
);
