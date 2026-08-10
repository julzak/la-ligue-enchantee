// Garde-fou FERME à la soumission (décision Julien 2026-08-10, après le cas
// réel « 14 joueurs / 131 pts » du tour 1 L2, amendé le même jour pour les
// maxima de ligne).
//
// L'acceptation des mises non conformes (pénalité au dépouillement, règle
// 3.2.c) datait du monde asynchrone/xls. Sur la plateforme, ces cas sont
// désormais REFUSÉS à la soumission :
//   - acquis conservés + joueurs de la mise > 13 ;
//   - total de la mise > budget restant (report des mises perdues/égalités
//     inclus : le budget restant transmis ici est déjà net des acquisitions) ;
//   - maxima de ligne, acquis compris : DEF > 6, MIL > 6, ATT > 4.
// L'excès de gardiens (GK > 1) reste porté par la garde B2-GK existante
// (checkGoalkeeperLimit), il n'est PAS revérifié ici.
//
// Les MINIMA de ligne (≥3 DEF, ≥3 MIL, ≥1 ATT) et la mise incomplète (<13)
// restent des avertissements non bloquants : un effectif se construit
// progressivement, ils ne sont exigibles qu'en fin de phase (règle 4).
//
// Module PUR (zéro DB, zéro React) : importé par la validation serveur
// partagée (src/lib/auction-validation.ts, donc participant ET saisie admin)
// et par l'UI participant (mêmes messages, bouton désactivé).

import type { Line } from "./auction-engine";

export interface HardLimitInput {
  ownedLines: Line[]; // lignes des acquis conservés (reportés, règle 3.1)
  bidLines: Line[]; // lignes des joueurs de la mise du tour
  bidTotal: number; // total des points misés ce tour
  budgetLeft: number; // budget restant (130 - points des acquisitions)
}

/**
 * Retourne la liste des refus fermes (vide = soumission autorisée).
 * Les messages sont affichés tels quels côté UI et renvoyés tels quels
 * par l'API (400) : ils doivent rester explicites et en français.
 */
export function findHardLimitErrors(input: HardLimitInput): string[] {
  const errors: string[] = [];
  const total = input.ownedLines.length + input.bidLines.length;
  const count = (line: Line) =>
    input.ownedLines.filter((l) => l === line).length +
    input.bidLines.filter((l) => l === line).length;

  if (total > 13) {
    errors.push(
      `Soumission refusée : ${total} joueurs (acquis conservés + mise) pour un maximum de 13. Retirez ${total - 13} joueur(s) de votre mise.`
    );
  }
  if (input.bidTotal > input.budgetLeft) {
    errors.push(
      `Soumission refusée : total des mises (${input.bidTotal} pts) supérieur à votre budget restant (${input.budgetLeft} pts, acquisitions déduites).`
    );
  }
  const maxima: { line: Line; max: number; label: string }[] = [
    { line: "DEF", max: 6, label: "défenseurs" },
    { line: "MID", max: 6, label: "milieux" },
    { line: "ATT", max: 4, label: "attaquants" },
  ];
  for (const m of maxima) {
    const c = count(m.line);
    if (c > m.max) {
      errors.push(
        `Soumission refusée : ${c} ${m.label} (acquis compris) pour un maximum de ${m.max}.`
      );
    }
  }
  return errors;
}
