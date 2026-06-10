// Helpers purs (sans prisma, sans react.cache) : importables partout,
// y compris dans les scripts CLI et les tests.

// Clé saison "YYYY-YYYY" utilisée par les tables SQL legacy (SCORING_CONFIG,
// JOKER_CONFIG, PAYMENT, CUP_MATCH) et par l'API TheSportsDB (&s=).
// Le label d'une Season peut être "2027" (année de fin, style palmarès)
// ou directement "2026-2027".
export const LEGACY_SEASON_KEY = "2025-2026";

export function seasonKeyFromLabel(label: string): string | null {
  const trimmed = label.trim();
  if (/^\d{4}-\d{4}$/.test(trimmed)) return trimmed;
  const single = trimmed.match(/^(\d{4})$/);
  if (single) {
    const endYear = Number(single[1]);
    return `${endYear - 1}-${endYear}`;
  }
  return null;
}

// Slug d'une ligue pour les URLs /ligue/[slug].
// Les 3 ligues historiques gardent leurs slugs actuels (URLs publiées) :
//   "Ligue 1 (Baudens League)" -> ligue-1
//   "National 1"               -> national-1
//   "Ligue 2"                  -> ligue-2 (via le slugify générique)
export function leagueSlug(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("baudens")) return "ligue-1";
  if (lower.includes("national")) return "national-1";
  const slug = lower
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "ligue";
}
