// Variantes de noms utilisées par le pipeline de scraping L'Équipe
// (scripts/scrape-notes-web.ts, scripts/process-matchday.ts) : termes de
// recherche et fragments d'URL par club. AVANT le 2026-08-17, ces tables
// vivaient dans les scripts, keyées par le libellé exact TheSportsDB
// ("Paris SG", "LOSC Lille") : le passage des données de matchs à
// football-data.org ("Paris Saint-Germain FC", "Lille OSC") les aurait toutes
// fait rater. Ici tout est keyé par la clé CANONIQUE d'assets.ts, robuste aux
// variantes de n'importe quel fournisseur.
//
// Les valeurs reprennent celles éprouvées en 2025-2026 (saison complète de
// scraping OK) + les promus 2026-2027.

import { canonicalClubKey } from "./assets";

interface ScrapeNames {
  // Termes pour la recherche lequipe.fr, du plus discriminant au plus long.
  search: string[];
  // Fragments (minuscules) attendus dans l'URL d'un article de notes.
  frags: string[];
}

const BY_CANONICAL: Record<string, ScrapeNames> = {
  "MARSEILLE": { search: ["OM", "Marseille"], frags: ["om", "marseille"] },
  "PARIS SG": { search: ["PSG", "Paris SG"], frags: ["psg"] },
  "PARIS FC": { search: ["PFC", "Paris FC"], frags: ["pfc", "paris-fc"] },
  "LYON": { search: ["OL", "Lyon"], frags: ["ol", "lyon"] },
  "LE HAVRE": { search: ["HAC", "Le Havre"], frags: ["havre", "hac"] },
  "MONACO": { search: ["ASM", "Monaco"], frags: ["monaco"] },
  "LILLE": { search: ["Lille", "LOSC"], frags: ["lille"] },
  "LORIENT": { search: ["FCL", "Lorient"], frags: ["lorient"] },
  "NANTES": { search: ["FCN", "Nantes"], frags: ["nantes"] },
  "STRASBOURG": { search: ["RCSA", "Strasbourg", "Racing"], frags: ["strasbourg", "racing"] },
  "RENNES": { search: ["SRFC", "Rennes", "Stade Rennais"], frags: ["rennes"] },
  "LENS": { search: ["RCL", "Lens", "RC Lens"], frags: ["lens"] },
  "BREST": { search: ["SB29", "Brest", "Stade Brestois"], frags: ["brest"] },
  "NICE": { search: ["OGCN", "Nice", "OGC Nice"], frags: ["nice"] },
  "ANGERS": { search: ["SCO", "Angers"], frags: ["angers"] },
  "AUXERRE": { search: ["AJA", "Auxerre"], frags: ["auxerre"] },
  "METZ": { search: ["FCM", "Metz", "FC Metz"], frags: ["metz"] },
  "TOULOUSE": { search: ["TFC", "Toulouse"], frags: ["toulouse"] },
  "TROYES": { search: ["ESTAC", "Troyes"], frags: ["troyes", "estac"] },
  "LE MANS": { search: ["Le Mans"], frags: ["mans", "le-mans"] },
};

/** Termes de recherche lequipe.fr pour un nom de club, toute variante. */
export function getClubSearchNames(name: string): string[] {
  return BY_CANONICAL[canonicalClubKey(name)]?.search ?? [name];
}

/** Fragments d'URL (minuscules) pour un nom de club, toute variante. */
export function getClubUrlFrags(name: string): string[] {
  const known = BY_CANONICAL[canonicalClubKey(name)]?.frags;
  if (known) return known;
  // Repli historique : dernier mot du nom. Suffisant pour un club inconnu
  // au nom simple, à compléter dans BY_CANONICAL sinon.
  return [name.split(" ").pop()!.toLowerCase()];
}
