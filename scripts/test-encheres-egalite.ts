/**
 * Wrapper CLI — cas "égalité de mise" du contrat enchères.
 * La source de vérité est src/lib/auction-engine.test.ts (vitest).
 * Ce script lance vitest en mode run sur le filtre correspondant pour
 * permettre l'exécution ad-hoc depuis la CLI sans installer les dépendances
 * de test dans l'env de prod.
 *
 * Usage : ./node_modules/.bin/tsx scripts/test-encheres-egalite.ts
 */
import { execSync } from "child_process";
execSync(
  './node_modules/.bin/vitest run --reporter=verbose src/lib/auction-engine.test.ts -t "égalité"',
  { stdio: "inherit" }
);
