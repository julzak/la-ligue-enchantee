// ── Club logos (Sofascore team IDs) ───────────────────────
// Mapping DB CLUB.ID_CLUB -> Sofascore image URL
// Will be replaced by CLUB.LOGO_URL column when we evolve the DB schema
export const clubLogos: Record<number, string> = {
  241: "https://img.sofascore.com/api/v1/team/40286/image",  // ANGERS
  243: "https://img.sofascore.com/api/v1/team/1680/image",   // AUXERRE
  201: "https://img.sofascore.com/api/v1/team/1681/image",   // BREST
  242: "https://img.sofascore.com/api/v1/team/2381/image",   // LE HAVRE
  232: "https://img.sofascore.com/api/v1/team/1679/image",   // LENS
  203: "https://img.sofascore.com/api/v1/team/1648/image",   // LILLE
  245: "https://img.sofascore.com/api/v1/team/34267/image",  // LORIENT (placeholder - Clermont ID, may need correction)
  205: "https://img.sofascore.com/api/v1/team/1649/image",   // LYON
  206: "https://img.sofascore.com/api/v1/team/1641/image",   // MARSEILLE
  244: "https://img.sofascore.com/api/v1/team/2380/image",   // METZ
  208: "https://img.sofascore.com/api/v1/team/1651/image",   // MONACO
  210: "https://img.sofascore.com/api/v1/team/1646/image",   // NANTES
  211: "https://img.sofascore.com/api/v1/team/1642/image",   // NICE
  246: "https://img.sofascore.com/api/v1/team/44029/image",  // PARIS FC
  212: "https://img.sofascore.com/api/v1/team/1644/image",   // PSG
  214: "https://img.sofascore.com/api/v1/team/1647/image",   // RENNES
  230: "https://img.sofascore.com/api/v1/team/1653/image",   // STRASBOURG
  199: "https://img.sofascore.com/api/v1/team/1662/image",   // TOULOUSE
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
