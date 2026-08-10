import { describe, it, expect } from "vitest";
import { buildPlayerSearchQuery } from "./admin-player-search";

// Non-régression du cas « 3 Gauthier Hein » (2026-08-10) : la recherche de
// l'écran Admin → Joueurs renvoyait les fiches de toutes les saisons, que les
// admins prenaient pour des doublons à supprimer.

describe("recherche admin joueurs : scoping saison", () => {
  it("saison courante par défaut : filtre ID_SEASON présent avec le bon paramètre", () => {
    const { sql, params } = buildPlayerSearchQuery("Hein", 4, false);
    expect(sql).toContain("AND p.ID_SEASON = ?");
    expect(params).toEqual(["%Hein%", "%Hein%", 4]);
  });

  it("mode toutes saisons : aucun filtre saison, mais label de saison joint pour le badge", () => {
    const { sql, params } = buildPlayerSearchQuery("Hein", 4, true);
    expect(sql).not.toContain("AND p.ID_SEASON = ?");
    expect(sql).toContain("LEFT JOIN SEASON s ON p.ID_SEASON = s.ID_SEASON");
    expect(sql).toContain("seasonLabel");
    expect(params).toEqual(["%Hein%", "%Hein%"]);
  });

  it("fallback legacy (aucune saison courante) : aucun filtre saison", () => {
    const { sql, params } = buildPlayerSearchQuery("Hein", null, false);
    expect(sql).not.toContain("AND p.ID_SEASON = ?");
    expect(params).toEqual(["%Hein%", "%Hein%"]);
  });

  it("la recherche par prénom et par nom est conservée", () => {
    const { sql } = buildPlayerSearchQuery("Gauthier", 4, false);
    expect(sql).toContain("p.LNAME LIKE ? OR p.FNAME LIKE ?");
    expect(sql).toContain("LIMIT 50");
  });

  it("sanity-check : la requête historique (non scopée) échoue bien au critère du filtre saison", () => {
    // Requête telle qu'elle existait avant le fix : si quelqu'un régresse vers
    // cette forme, l'assertion du premier test doit la rejeter.
    const legacySql =
      "SELECT p.ID_PLAYER, p.FNAME, p.LNAME, p.POSITION, p.ID_CLUB, COALESCE(c.NAME, '') as clubName " +
      "FROM PLAYER p LEFT JOIN CLUB c ON p.ID_CLUB = c.ID_CLUB " +
      "WHERE p.LNAME LIKE ? OR p.FNAME LIKE ? ORDER BY p.LNAME ASC LIMIT 50";
    expect(legacySql).not.toContain("AND p.ID_SEASON = ?");
  });
});
