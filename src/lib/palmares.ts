// Lecture du palmarès pour la page publique. Source de vérité = table PALMARES
// (remplie par la clôture de saison + l'import CSV historique). Tant qu'une
// année+division n'existe pas en base, on retombe sur les données legacy codées
// en dur (src/lib/palmares-legacy.ts) pour ne pas régresser la page existante.
//
// Dédup : une entrée DB pour un couple (year, divisionLabel, position) masque
// l'entrée legacy correspondante.

import { prisma } from "./prisma";
import { LEGACY_PALMARES } from "./palmares-legacy";

export interface PalmaresRow {
  year: string;
  divisionLabel: string;
  position: string;
  pseudo: string;
  source: "db" | "legacy";
}

// Extrait une "année" affichable depuis un label de saison ("2026-2027" -> "2027").
function yearFromLabel(label: string): string {
  const parts = label.split(/[-/]/).map((p) => p.trim());
  return parts[parts.length - 1] || label;
}

export async function getAllPalmares(): Promise<PalmaresRow[]> {
  const dbRows = await prisma.palmares.findMany({
    include: { season: { select: { label: true } } },
  });

  const fromDb: PalmaresRow[] = dbRows.map((r) => ({
    year: yearFromLabel(r.season.label),
    divisionLabel: r.divisionLabel,
    position: r.position,
    pseudo: r.pseudo,
    source: "db",
  }));

  // Clés couvertes par la base (year|division|position) -> masquent le legacy.
  const dbKeys = new Set(fromDb.map((r) => `${r.year}|${r.divisionLabel}|${r.position}`));
  const fromLegacy: PalmaresRow[] = LEGACY_PALMARES.filter(
    (e) => !dbKeys.has(`${e.year}|${e.divisionLabel}|${e.position}`)
  ).map((e) => ({ ...e, source: "legacy" as const }));

  return [...fromDb, ...fromLegacy];
}
