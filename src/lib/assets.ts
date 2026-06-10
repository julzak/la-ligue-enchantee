// ── Club assets (logos, shortnames) keyés par NOM de club ─────────────────
// Les IDs de clubs changent à chaque saison (réimport) : le nom est la seule
// clé stable. On normalise (majuscules, sans accents, sans parenthèses) et on
// gère les alias TheSportsDB ("Olympique Marseille") vers le nom canonique.
//
// Pour ajouter un logo manquant : télécharger le PNG manuellement (Google
// Images), le placer dans public/clubs/[nom].png puis ajouter l'entrée ici.

interface ClubAsset {
  canonical: string; // nom normalisé de référence (forme DB : "MARSEILLE")
  short: string;
  logo: string | null;
  aliases?: string[]; // variantes TheSportsDB / MATCH_SCHEDULE, normalisées
}

const CLUB_ASSETS: ClubAsset[] = [
  { canonical: "ANGERS", short: "SCO", logo: "/clubs/angers.png", aliases: ["ANGERS SCO"] },
  { canonical: "AUXERRE", short: "AJA", logo: "/clubs/auxerre.png", aliases: ["AJ AUXERRE"] },
  { canonical: "BREST", short: "SB29", logo: "/clubs/brest.png", aliases: ["STADE BRESTOIS"] },
  { canonical: "LE HAVRE", short: "HAC", logo: "/clubs/le-havre.png" },
  { canonical: "LEGION ETRANGERE", short: "LEG", logo: "/clubs/legion-etrangere.png" },
  { canonical: "LENS", short: "RCL", logo: "/clubs/lens.png", aliases: ["RC LENS"] },
  { canonical: "LILLE", short: "LOSC", logo: "/clubs/lille.png", aliases: ["LOSC LILLE"] },
  { canonical: "LORIENT", short: "FCL", logo: "/clubs/lorient.png" },
  { canonical: "LYON", short: "OL", logo: "/clubs/lyon.png", aliases: ["OLYMPIQUE LYONNAIS"] },
  { canonical: "MARSEILLE", short: "OM", logo: "/clubs/marseille.png", aliases: ["OLYMPIQUE MARSEILLE"] },
  { canonical: "METZ", short: "FCM", logo: "/clubs/metz.png" },
  { canonical: "MONACO", short: "ASM", logo: "/clubs/monaco.png", aliases: ["AS MONACO"] },
  { canonical: "NANTES", short: "FCN", logo: "/clubs/nantes.png" },
  { canonical: "NICE", short: "OGCN", logo: "/clubs/nice.png", aliases: ["OGC NICE"] },
  { canonical: "PARIS FC", short: "PFC", logo: "/clubs/parisfc.png", aliases: ["PARIS"] },
  { canonical: "PARIS SG", short: "PSG", logo: "/clubs/psg.png", aliases: ["PSG", "PARIS SAINT GERMAIN"] },
  { canonical: "RENNES", short: "SRFC", logo: "/clubs/rennes.png", aliases: ["STADE RENNAIS"] },
  { canonical: "STRASBOURG", short: "RCSA", logo: "/clubs/strasbourg.png" },
  { canonical: "TOULOUSE", short: "TFC", logo: "/clubs/toulouse.png" },
];

// "PARIS-SG (PSG)" -> "PARIS SG" ; "Légion étrangère" -> "LEGION ETRANGERE"
export function normalizeClubName(name: string): string {
  return name
    .replace(/\([^)]*\)/g, " ") // retire les parenthèses ("MARSEILLE (OM)")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diacritiques décomposés par NFD
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

const byKey = new Map<string, ClubAsset>();
for (const asset of CLUB_ASSETS) {
  byKey.set(asset.canonical, asset);
  for (const alias of asset.aliases ?? []) byKey.set(alias, asset);
}

// Clé canonique d'un nom de club, quelle que soit sa variante d'origine
// (nom DB legacy, nom TheSportsDB, MATCH_SCHEDULE). Deux noms du même club
// donnent la même clé : sert à apparier MATCH_SCHEDULE avec la table CLUB.
export function canonicalClubKey(name: string): string {
  const normalized = normalizeClubName(name);
  return byKey.get(normalized)?.canonical ?? normalized;
}

export function getClubLogoUrlByName(name: string | null | undefined): string | null {
  if (!name) return null;
  return byKey.get(normalizeClubName(name))?.logo ?? null;
}

export function getClubShortNameByName(
  name: string | null | undefined,
  fallback?: string
): string {
  if (!name) return fallback ?? "";
  return byKey.get(normalizeClubName(name))?.short ?? fallback ?? name;
}
