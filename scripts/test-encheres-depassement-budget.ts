/**
 * Wrapper CLI — cas "dépassement de budget" du contrat enchères.
 * La source de vérité est src/lib/auction-engine.test.ts (vitest).
 *
 * Usage : ./node_modules/.bin/tsx scripts/test-encheres-depassement-budget.ts
 */
import { execSync } from "child_process";
execSync(
  "./node_modules/.bin/vitest run --reporter=verbose src/lib/auction-engine.test.ts -t \"^dépassement de budget : retrait d'1 joueur \\\\(la plus grosse acquisition\\\\)\"",
  { stdio: "inherit" }
);
