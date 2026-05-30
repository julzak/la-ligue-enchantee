// Clôture de saison (chantier 3 + 4) : fige le palmarès et calcule les
// montées/descentes. AUCUNE saisie manuelle. Idempotent : relancer la clôture
// efface puis recrée les lignes PALMARES + SEASON_MOVEMENT de la saison.
//
// Dépend du modèle Season (migration sql/2026-05-machine-saisons.sql appliquée).
// Le classement final = somme cumulée de STATS_USER.ptsTot (même logique que
// getLeagueStandings, src/lib/db.ts), réutilisée ici.

import { prisma } from "./prisma";
import { getLeagueStandings } from "./db";
import { computeMovement } from "./season-movement";

export interface CloseSeasonResult {
  seasonLabel: string;
  podiumCount: number;
  movementCount: number;
  cupWinner: string | null;
  cupFinalist: string | null;
  warnings: string[];
}

const clean = (n: string) => n.replace(/<[^>]*>/g, "").trim();

// Récupère vainqueur + finaliste de la coupe de la saison (match CUP.season =
// season.label). Retourne null si pas de coupe rattachée ou finale non jouée.
async function getCupFinal(
  seasonLabel: string
): Promise<{ winner: string | null; finalist: string | null }> {
  const cups = await prisma.$queryRawUnsafe<{ id: number }[]>(
    "SELECT id FROM CUP WHERE season = ? ORDER BY id DESC LIMIT 1",
    seasonLabel
  );
  if (cups.length === 0) return { winner: null, finalist: null };
  const cupId = cups[0].id;

  const finals = await prisma.$queryRawUnsafe<{
    user1_id: number | null;
    user2_id: number | null;
    winner_id: number | null;
  }[]>(
    "SELECT user1_id, user2_id, winner_id FROM CUP_MATCH WHERE cup_id = ? AND round = 'Finale' LIMIT 1",
    cupId
  );
  if (finals.length === 0 || !finals[0].winner_id) return { winner: null, finalist: null };

  const f = finals[0];
  const winnerId = Number(f.winner_id);
  const finalistId =
    winnerId === Number(f.user1_id) ? Number(f.user2_id) : Number(f.user1_id);

  const ids = [winnerId, finalistId].filter((x) => x && !Number.isNaN(x));
  const names = ids.length
    ? await prisma.$queryRawUnsafe<{ ID_USER: number; NAME: string }[]>(
        `SELECT ID_USER, NAME FROM USER WHERE ID_USER IN (${ids.map(() => "?").join(",")})`,
        ...ids
      )
    : [];
  const nameOf = (id: number) => {
    const row = names.find((n) => Number(n.ID_USER) === id);
    return row ? clean(row.NAME) || `#${id}` : null;
  };

  return { winner: nameOf(winnerId), finalist: finalistId ? nameOf(finalistId) : null };
}

export async function closeSeason(seasonId: number): Promise<CloseSeasonResult> {
  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) throw new Error("Saison introuvable");
  if (season.status === "SETUP" || season.status === "AUCTION") {
    throw new Error(`Clôture impossible en statut ${season.status} (saison pas encore jouée)`);
  }

  const warnings: string[] = [];

  // Ligues de la saison, triées par tier (1 = plus haut).
  const leagues = await prisma.league.findMany({
    where: { seasonId },
    orderBy: { tier: "asc" },
  });
  if (leagues.length === 0) {
    warnings.push("Aucune ligue rattachée à cette saison : palmarès et mouvements vides.");
  }

  const tiers = leagues.map((l) => l.tier).filter((t): t is number => t != null);
  const minTier = tiers.length ? Math.min(...tiers) : 1;
  const maxTier = tiers.length ? Math.max(...tiers) : 1;

  type PalmaresInsert = { seasonId: number; divisionLabel: string; position: string; pseudo: string };
  type MovementInsert = {
    seasonId: number; userId: number; fromLeagueId: number;
    fromTier: number; toTier: number; type: "PROMOTION" | "RELEGATION" | "STAY";
    rankFinal: number; pseudo: string;
  };

  const palmares: PalmaresInsert[] = [];
  const movements: MovementInsert[] = [];

  for (const league of leagues) {
    const divisionLabel = league.divisionLabel || league.name;
    const tier = league.tier;
    const { standings } = await getLeagueStandings(league.id);
    const n = standings.length;
    if (n === 0) {
      warnings.push(`Ligue "${divisionLabel}" sans classement (aucune stat) : ignorée.`);
      continue;
    }

    // Podium 1/2/3 -> PALMARES.
    standings.slice(0, 3).forEach((s) => {
      palmares.push({
        seasonId,
        divisionLabel,
        position: String(s.rank),
        pseudo: s.userName,
      });
    });

    // Mouvements : top 3 montent (tier-1), bottom 3 descendent (tier+1).
    // Bornés aux tiers existants ; promotion prioritaire si chevauchement
    // (petite ligue). STAY sinon.
    if (tier == null) {
      warnings.push(`Ligue "${divisionLabel}" sans tier : mouvements non calculés.`);
      continue;
    }
    standings.forEach((s) => {
      const { type, toTier } = computeMovement(s.rank, n, tier, minTier, maxTier);
      movements.push({
        seasonId,
        userId: s.userId,
        fromLeagueId: league.id,
        fromTier: tier,
        toTier,
        type,
        rankFinal: s.rank,
        pseudo: s.userName,
      });
    });
  }

  // Coupe -> PALMARES (Vainqueur + Finaliste).
  const cup = await getCupFinal(season.label);
  if (cup.winner) {
    palmares.push({ seasonId, divisionLabel: "Coupe", position: "Vainqueur", pseudo: cup.winner });
    if (cup.finalist) {
      palmares.push({ seasonId, divisionLabel: "Coupe", position: "Finaliste", pseudo: cup.finalist });
    }
  } else {
    warnings.push("Pas de coupe clôturée pour cette saison (finale non jouée ou CUP.season ne correspond pas au label).");
  }

  // Écriture transactionnelle idempotente.
  await prisma.$transaction(async (tx) => {
    await tx.palmares.deleteMany({ where: { seasonId } });
    await tx.seasonMovement.deleteMany({ where: { seasonId } });
    if (palmares.length) await tx.palmares.createMany({ data: palmares });
    if (movements.length) await tx.seasonMovement.createMany({ data: movements });
    await tx.season.update({
      where: { id: seasonId },
      data: { status: "CLOSED", closedAt: new Date(), isCurrent: false },
    });
  });

  return {
    seasonLabel: season.label,
    podiumCount: palmares.filter((p) => p.divisionLabel !== "Coupe").length,
    movementCount: movements.length,
    cupWinner: cup.winner,
    cupFinalist: cup.finalist,
    warnings,
  };
}
