/**
 * Contrat enchères : DEADLINE, tolérance zéro (règle 3.1 + amendement
 * 2026-06-10). Une soumission reçue 1 seconde après l'heure butoir est
 * REJETÉE, pas placée au tour suivant. Un tour fermé (clôture manuelle
 * admin) rejette dans tous les cas.
 *
 * Usage : ./node_modules/.bin/tsx scripts/test-encheres-deadline.ts
 */

import { acceptSubmission } from "../src/lib/auction-engine";
import { check, finish } from "./lib/test-encheres-helpers";

const deadline = new Date("2026-07-15T18:00:00.000Z");

// Cas nominal : tour ouvert, soumission avant l'heure.
check(
  "soumission avant deadline acceptée",
  acceptSubmission({ roundOpen: true, deadline, submittedAt: new Date("2026-07-15T17:59:59.000Z") }).accepted,
  true
);

// Pile à la deadline : encore à l'heure.
check(
  "soumission à la seconde exacte de la deadline acceptée",
  acceptSubmission({ roundOpen: true, deadline, submittedAt: deadline }).accepted,
  true
);

// LE cas du contrat : 1 seconde de retard = rejet.
const late = acceptSubmission({
  roundOpen: true,
  deadline,
  submittedAt: new Date("2026-07-15T18:00:01.000Z"),
});
check("soumission 1s après deadline REJETÉE", late.accepted, false);
check("motif explicite", late.reason, "Soumission après l'heure butoir");

// Clôture manuelle : tour fermé = rejet même sans deadline renseignée.
check(
  "tour fermé (clôture admin) = rejet",
  acceptSubmission({ roundOpen: false, deadline: null, submittedAt: new Date("2026-07-15T12:00:00.000Z") }).accepted,
  false
);

// Pas de deadline renseignée + tour ouvert : accepté (amendement 2026-06-10,
// la fermeture manuelle fait foi).
check(
  "tour ouvert sans deadline = accepté",
  acceptSubmission({ roundOpen: true, deadline: null, submittedAt: new Date("2026-07-15T23:59:59.000Z") }).accepted,
  true
);

// ── Sanity-check : une régression "tolérance de grâce" (ex: 60 s) aurait
// accepté la soumission à T+1s. On simule l'acceptation buguée et on vérifie
// que le détecteur la distingue du comportement conforme.
const buggyAccepted = true; // comportement bugué : accepté malgré le retard
check("sanity-check : la régression 'période de grâce' serait détectée", buggyAccepted !== late.accepted, true);

finish();
