// ── Club logos (Sofascore team IDs) ───────────────────────
// Mapping DB CLUB.ID_CLUB -> Sofascore image URL
// Will be replaced by CLUB.LOGO_URL column when we evolve the DB schema
// Logos disponibles localement (public/clubs/)
// Pour ajouter un logo manquant: télécharger le PNG manuellement depuis Google Images
// et le placer dans public/clubs/[nom].png puis ajouter l'entrée ici
export const clubLogos: Record<number, string> = {
  241: "/clubs/angers.png",       // ANGERS
  243: "/clubs/auxerre.png",      // AUXERRE
  201: "/clubs/brest.png",        // BREST
  242: "/clubs/le-havre.png",     // LE HAVRE
  232: "/clubs/lens.png",         // LENS
  203: "/clubs/lille.png",        // LILLE
  245: "/clubs/lorient.png",      // LORIENT
  205: "/clubs/lyon.png",         // LYON
  206: "/clubs/marseille.png",    // MARSEILLE
  244: "/clubs/metz.png",         // METZ
  208: "/clubs/monaco.png",       // MONACO
  210: "/clubs/nantes.png",       // NANTES
  211: "/clubs/nice.png",         // NICE
  246: "/clubs/parisfc.png",      // PARIS FC
  212: "/clubs/psg.png",          // PSG
  214: "/clubs/rennes.png",       // RENNES
  230: "/clubs/strasbourg.png",   // STRASBOURG
  199: "/clubs/toulouse.png",     // TOULOUSE
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

// TheSportsDB / MATCH_SCHEDULE team name → DB club ID
const teamNameToClubId: Record<string, number> = {
  "Marseille": 206, "Olympique Marseille": 206,
  "Lyon": 205, "Olympique Lyonnais": 205,
  "Monaco": 208,
  "Lille": 203, "LOSC Lille": 203,
  "Rennes": 214,
  "Le Havre": 242,
  "Metz": 244,
  "Toulouse": 199,
  "Strasbourg": 230,
  "Paris FC": 246, "Paris": 246,
  "Lens": 232,
  "Lorient": 245,
  "Brest": 201,
  "Angers": 241, "Angers SCO": 241,
  "Nice": 211,
  "Auxerre": 243,
  "Nantes": 210,
  "Paris SG": 212, "Paris Saint Germain": 212, "PSG": 212,
};

export function getClubIdByTeamName(teamName: string): number | null {
  return teamNameToClubId[teamName] ?? null;
}

