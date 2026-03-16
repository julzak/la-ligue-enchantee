// ── Club logos (Sofascore team IDs) ───────────────────────
// Mapping DB CLUB.ID_CLUB -> Sofascore image URL
// Will be replaced by CLUB.LOGO_URL column when we evolve the DB schema
// Logos disponibles localement (public/clubs/)
// Pour ajouter un logo manquant: télécharger le PNG manuellement depuis Google Images
// et le placer dans public/clubs/[nom].png puis ajouter l'entrée ici
export const clubLogos: Record<number, string> = {
  206: "/clubs/marseille.png",    // MARSEILLE
  212: "/clubs/psg.png",          // PSG
};

// Shortnames for display
export const clubShortNames: Record<number, string> = {
  241: "SCO",
  243: "AJA",
  201: "SB29",
  242: "HAC",
  217: "LEG",
  232: "RCL",
  203: "LOSC",
  245: "FCL",
  205: "OL",
  206: "OM",
  244: "FCM",
  208: "ASM",
  210: "FCN",
  211: "OGCN",
  246: "PFC",
  212: "PSG",
  214: "SRFC",
  230: "RCSA",
  199: "TFC",
};

// ── Player photos ─────────────────────────────────────────
// For players, we can't map 1000+ IDs statically.
// Instead, we'll use a search-based approach: try Sofascore player search API
// or return a placeholder. For now, no player photos.
export function getClubLogoUrl(clubId: number): string | null {
  return clubLogos[clubId] ?? null;
}

export function getClubShortName(clubId: number, fallbackName?: string): string {
  return clubShortNames[clubId] ?? fallbackName ?? "";
}
