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

// Les alias couvrent les trois sources de noms rencontrées : la DB legacy, les
// libellés TheSportsDB (calendrier des saisons passées) et ceux de
// football-data.org (import des clubs depuis 2026-2027, forme longue et
// officielle : "AS Monaco FC", "Racing Club de Lens").
const CLUB_ASSETS: ClubAsset[] = [
  { canonical: "ANGERS", short: "SCO", logo: "/clubs/angers.png", aliases: ["ANGERS SCO"] },
  { canonical: "AUXERRE", short: "AJA", logo: "/clubs/auxerre.png", aliases: ["AJ AUXERRE"] },
  { canonical: "BREST", short: "SB29", logo: "/clubs/brest.png", aliases: ["STADE BRESTOIS", "STADE BRESTOIS 29"] },
  { canonical: "LE HAVRE", short: "HAC", logo: "/clubs/le-havre.png", aliases: ["LE HAVRE AC"] },
  { canonical: "LE MANS", short: "LMFC", logo: "/clubs/le-mans.png", aliases: ["LE MANS FC"] },
  { canonical: "LEGION ETRANGERE", short: "LEG", logo: "/clubs/legion-etrangere.png" },
  { canonical: "LENS", short: "RCL", logo: "/clubs/lens.png", aliases: ["RC LENS", "RACING CLUB DE LENS"] },
  { canonical: "LILLE", short: "LOSC", logo: "/clubs/lille.png", aliases: ["LOSC LILLE", "LILLE OSC"] },
  { canonical: "LORIENT", short: "FCL", logo: "/clubs/lorient.png", aliases: ["FC LORIENT"] },
  { canonical: "LYON", short: "OL", logo: "/clubs/lyon.png", aliases: ["OLYMPIQUE LYONNAIS"] },
  { canonical: "MARSEILLE", short: "OM", logo: "/clubs/marseille.png", aliases: ["OLYMPIQUE MARSEILLE", "OLYMPIQUE DE MARSEILLE"] },
  { canonical: "METZ", short: "FCM", logo: "/clubs/metz.png", aliases: ["FC METZ"] },
  { canonical: "MONACO", short: "ASM", logo: "/clubs/monaco.png", aliases: ["AS MONACO", "AS MONACO FC"] },
  { canonical: "NANTES", short: "FCN", logo: "/clubs/nantes.png", aliases: ["FC NANTES"] },
  { canonical: "NICE", short: "OGCN", logo: "/clubs/nice.png", aliases: ["OGC NICE"] },
  { canonical: "PARIS FC", short: "PFC", logo: "/clubs/parisfc.png", aliases: ["PARIS"] },
  { canonical: "PARIS SG", short: "PSG", logo: "/clubs/psg.png", aliases: ["PSG", "PARIS SAINT GERMAIN", "PARIS SAINT GERMAIN FC"] },
  { canonical: "RENNES", short: "SRFC", logo: "/clubs/rennes.png", aliases: ["STADE RENNAIS", "STADE RENNAIS FC 1901"] },
  { canonical: "STRASBOURG", short: "RCSA", logo: "/clubs/strasbourg.png", aliases: ["RC STRASBOURG ALSACE", "RC STRASBOURG"] },
  { canonical: "TOULOUSE", short: "TFC", logo: "/clubs/toulouse.png", aliases: ["TOULOUSE FC"] },
  { canonical: "TROYES", short: "ESTAC", logo: "/clubs/troyes.png", aliases: ["ES TROYES AC", "ESTAC TROYES"] },
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

// Tokens de forme (statut juridique, mots génériques) : non discriminants pour
// identifier un club. Ils ne sont retirés qu'en dernier recours, si ni le nom
// normalisé ni un alias ne correspond. C'est le filet qui évite qu'un nouveau
// fournisseur de données fasse disparaître les logos en silence : en 2026-2027,
// l'import est passé sur football-data.org, qui écrit "AS Monaco FC" là où la
// table attendait "AS Monaco", et 13 clubs sur 19 se sont retrouvés sans logo.
const FORM_TOKENS = new Set([
  "FC", "AC", "SC", "SCO", "OSC", "OGC", "RC", "AS", "AJ", "ES", "SM", "US", "CS",
  "CLUB", "RACING", "OLYMPIQUE", "STADE", "SPORTING", "SPORTIVE", "ASSOCIATION",
  "FOOTBALL", "DE",
]);

function coreClubKey(normalized: string): string {
  return normalized
    .split(" ")
    .filter((t) => t && !FORM_TOKENS.has(t) && !/^\d+$/.test(t))
    .join(" ");
}

// Index de repli. Une clé réclamée par deux clubs distincts est écartée : un
// mauvais logo est plus trompeur qu'un logo absent.
const byCore = new Map<string, ClubAsset>();
const ambiguousCores = new Set<string>();
for (const asset of CLUB_ASSETS) {
  for (const name of [asset.canonical, ...(asset.aliases ?? [])]) {
    const core = coreClubKey(name);
    if (!core) continue;
    // Ambigu si un autre club réclame le même repli, ou si ce repli est le nom
    // exact d'un autre club (byKey primant, le repli enverrait ailleurs).
    const claimed = byCore.get(core) ?? byKey.get(core);
    if (claimed && claimed !== asset) ambiguousCores.add(core);
    else byCore.set(core, asset);
  }
}
ambiguousCores.forEach((core) => byCore.delete(core));

function resolveClubAsset(name: string): ClubAsset | undefined {
  const normalized = normalizeClubName(name);
  return byKey.get(normalized) ?? byCore.get(coreClubKey(normalized));
}

// Clé canonique d'un nom de club, quelle que soit sa variante d'origine
// (nom DB legacy, nom TheSportsDB, MATCH_SCHEDULE). Deux noms du même club
// donnent la même clé : sert à apparier MATCH_SCHEDULE avec la table CLUB.
export function canonicalClubKey(name: string): string {
  return resolveClubAsset(name)?.canonical ?? normalizeClubName(name);
}

export function getClubLogoUrlByName(name: string | null | undefined): string | null {
  if (!name) return null;
  return resolveClubAsset(name)?.logo ?? null;
}

export function getClubShortNameByName(
  name: string | null | undefined,
  fallback?: string
): string {
  if (!name) return fallback ?? "";
  return resolveClubAsset(name)?.short ?? fallback ?? name;
}
