/**
 * Wrapper CLI — cas "report des points" du contrat enchères.
 * La source de vérité est src/lib/auction-engine.test.ts (vitest).
 *
 * Usage : ./node_modules/.bin/tsx scripts/test-encheres-report-points.ts
 */
import { execSync } from "child_process";
execSync(
  "./node_modules/.bin/vitest run --reporter=verbose src/lib/auction-engine.test.ts -t \"^report des points : mises perdues récupérées au tour suivant\"",
  { stdio: "inherit" }
);
