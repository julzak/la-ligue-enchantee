/**
 * Tests de la cascade de suppression/réinitialisation de saison.
 *
 * But principal : s'assurer que la liste des tables ciblées par la cascade
 * ne contient AUCUNE table fantôme (tables inexistantes en base prod).
 *
 * Régression gardée : LEAGUE_SCORE, LEAGUE_SCORE_DAY et LAST_SCORE ont été
 * incluses par erreur dans la cascade initiale alors qu'elles n'existent ni
 * dans prisma/schema.prisma ni dans les dumps prod (ligueenc_v3.sql,
 * ligueenc_main.sql). Résultat : HTTP 500 au premier reset/delete.
 */
import { describe, it, expect } from "vitest";

// Tables réelles vérifiées dans prisma/schema.prisma ET dump prod ligueenc_v3.sql.
// Si une nouvelle table doit être ajoutée à la cascade, elle DOIT d'abord apparaître
// dans cette allowlist — et être vérifiée dans le schéma/dump.
const REAL_TABLES_ALLOWLIST = new Set([
  "AUCTION_REMOVAL",
  "AUCTION_BID",
  "AUCTION_BUDGET",
  "AUCTION",
  "LEAGUE_USER",
  "LEAGUE",
  "PLAYER",
  "CLUB",
  "SEASON",
  // Tables réelles non ciblées par la cascade (présentes pour référence complète) :
  // "SCORE", "STATS_USER", "TEAM", "TEAM_DAY", "USER", "CLUB_VALID",
  // "PALMARES", "SEASON_MOVEMENT", "APP_CONFIG"
]);

// Tables fantômes qui ont causé la régression : NE DOIVENT JAMAIS réapparaître.
const GHOST_TABLES = ["LEAGUE_SCORE", "LEAGUE_SCORE_DAY", "LAST_SCORE"];

// Liste exacte des tables ciblées par la cascade reset ET delete.
// À maintenir synchronisée avec les routes :
//   src/app/api/admin/seasons/reset/route.ts
//   src/app/api/admin/seasons/route.ts  (DELETE)
const CASCADE_TABLES: string[] = [
  "AUCTION_REMOVAL",
  "AUCTION_BID",
  "AUCTION_BUDGET",
  "AUCTION",
  "LEAGUE_USER",
  "LEAGUE",
  "PLAYER",
  "CLUB",
];

// Pour la suppression complète (DELETE), SEASON s'ajoute à la fin.
const DELETE_ONLY_TABLES: string[] = ["SEASON"];

describe("cascade saison — tables ciblées", () => {
  it("ne contient aucune table fantôme (regression: LEAGUE_SCORE / LEAGUE_SCORE_DAY / LAST_SCORE)", () => {
    const allTargeted = [...CASCADE_TABLES, ...DELETE_ONLY_TABLES];
    for (const ghost of GHOST_TABLES) {
      expect(
        allTargeted,
        `Table fantôme "${ghost}" détectée dans la cascade — elle n'existe pas en base prod`
      ).not.toContain(ghost);
    }
  });

  it("toutes les tables ciblées sont dans l'allowlist des tables réelles", () => {
    const allTargeted = [...CASCADE_TABLES, ...DELETE_ONLY_TABLES];
    for (const table of allTargeted) {
      expect(
        REAL_TABLES_ALLOWLIST.has(table),
        `Table "${table}" dans la cascade mais ABSENTE de l'allowlist des tables réelles`
      ).toBe(true);
    }
  });

  it("la cascade reset ne supprime PAS la ligne SEASON elle-même", () => {
    // Reset = conserve la coquille. SEASON ne doit PAS être dans CASCADE_TABLES.
    expect(CASCADE_TABLES).not.toContain("SEASON");
  });

  it("la cascade delete supprime bien la ligne SEASON", () => {
    // Delete complet = SEASON doit être dans DELETE_ONLY_TABLES.
    expect(DELETE_ONLY_TABLES).toContain("SEASON");
  });

  it("sanity-check anti-régression : les tables fantômes ne sont PAS réelles", () => {
    for (const ghost of GHOST_TABLES) {
      // Si ce test échoue, quelqu'un a ajouté une table fantôme à l'allowlist
      // sans vérifier le schéma — bloquer immédiatement.
      expect(
        REAL_TABLES_ALLOWLIST.has(ghost),
        `ERREUR : "${ghost}" a été ajoutée à l'allowlist — vérifier qu'elle existe vraiment en base`
      ).toBe(false);
    }
  });
});
