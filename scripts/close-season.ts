/**
 * Clôture d'une saison en CLI (sans passer par la route HTTP, donc sans session
 * admin, et sans `db.ts` qui dépend de react.cache et plante hors RSC).
 *
 * Réimplémente EXACTEMENT la logique de src/lib/season-close.ts en SQL direct :
 *   - classement final = somme de STATS_USER.PTS_TOT par participant
 *   - rang de compétition (ex-aequo => même rang : 1,2,3,3,5)
 *   - podium (rang <= 3) + coupe (vainqueur/finaliste via CUP_MATCH Finale)
 *   - montées/descentes (3 montent, 3 descendent, bornes de tier)
 *   - écriture transactionnelle idempotente dans PALMARES + SEASON_MOVEMENT
 *   - passe la saison en CLOSED
 *
 * Usage : ./node_modules/.bin/tsx scripts/close-season.ts <seasonId> [--dry]
 *   --dry : calcule et affiche le résultat SANS rien écrire en base.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const clean = (n: string) => n.replace(/<[^>]*>/g, "").trim();

type Kind = "PROMOTION" | "RELEGATION" | "STAY";

function computeMovement(rank: number, n: number, tier: number, minTier: number, maxTier: number): { type: Kind; toTier: number } {
  const isTop3 = rank <= 3;
  const isBottom3 = rank > n - 3;
  if (isTop3 && tier > minTier) return { type: "PROMOTION", toTier: tier - 1 };
  if (isBottom3 && tier < maxTier) return { type: "RELEGATION", toTier: tier + 1 };
  return { type: "STAY", toTier: tier };
}

async function getCupFinal(seasonLabel: string): Promise<{ winner: string | null; finalist: string | null }> {
  const year = seasonLabel.split(/[-/]/).map((s) => s.trim()).filter(Boolean).pop() || seasonLabel;
  const cups = await prisma.$queryRawUnsafe<{ id: number }[]>(
    "SELECT id FROM CUP WHERE season = ? OR season LIKE ? OR season = ? ORDER BY id DESC LIMIT 1",
    seasonLabel, `%${year}%`, year
  );
  if (cups.length === 0) return { winner: null, finalist: null };
  const cupId = cups[0].id;
  const finals = await prisma.$queryRawUnsafe<{ user1_id: number | null; user2_id: number | null; winner_id: number | null }[]>(
    "SELECT user1_id, user2_id, winner_id FROM CUP_MATCH WHERE cup_id = ? AND round = 'Finale' LIMIT 1", cupId
  );
  if (finals.length === 0 || !finals[0].winner_id) return { winner: null, finalist: null };
  const f = finals[0];
  const winnerId = Number(f.winner_id);
  const finalistId = winnerId === Number(f.user1_id) ? Number(f.user2_id) : Number(f.user1_id);
  const ids = [winnerId, finalistId].filter((x) => x && !Number.isNaN(x));
  const names = ids.length
    ? await prisma.$queryRawUnsafe<{ ID_USER: number; NAME: string }[]>(
        `SELECT ID_USER, NAME FROM USER WHERE ID_USER IN (${ids.map(() => "?").join(",")})`, ...ids)
    : [];
  const nameOf = (id: number) => {
    const row = names.find((n) => Number(n.ID_USER) === id);
    return row ? clean(row.NAME) || `#${id}` : null;
  };
  return { winner: nameOf(winnerId), finalist: finalistId ? nameOf(finalistId) : null };
}

async function main() {
  const seasonId = Number(process.argv[2]);
  const dry = process.argv.includes("--dry");
  if (!seasonId) { console.error("Usage: tsx scripts/close-season.ts <seasonId> [--dry]"); process.exit(1); }

  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) throw new Error("Saison introuvable");
  console.log(`Saison ${season.label} (statut ${season.status})${dry ? " [DRY RUN]" : ""}`);

  const leagues = await prisma.league.findMany({ where: { seasonId }, orderBy: { tier: "asc" } });
  if (leagues.length === 0) throw new Error("Aucune ligue rattachée à cette saison");
  const tiers = leagues.map((l) => l.tier).filter((t): t is number => t != null);
  const minTier = Math.min(...tiers), maxTier = Math.max(...tiers);

  const warnings: string[] = [];
  const palmares: { seasonId: number; divisionLabel: string; position: string; pseudo: string }[] = [];
  const movements: { seasonId: number; userId: number; fromLeagueId: number; fromTier: number; toTier: number; type: Kind; rankFinal: number; pseudo: string }[] = [];

  for (const league of leagues) {
    const divisionLabel = league.divisionLabel || league.name;
    const tier = league.tier;
    // Classement = somme PTS_TOT par user, trié décroissant.
    const rows = await prisma.$queryRawUnsafe<{ ID_USER: number; nm: string; tot: number }[]>(
      `SELECT s.ID_USER, u.NAME nm, SUM(s.PTS_TOT) tot
       FROM STATS_USER s JOIN USER u ON u.ID_USER = s.ID_USER
       WHERE s.ID_LEAGUE = ? GROUP BY s.ID_USER, u.NAME ORDER BY tot DESC`,
      league.id
    );
    const n = rows.length;
    if (n === 0) { warnings.push(`Ligue "${divisionLabel}" sans classement.`); continue; }

    // Rang de compétition (ex-aequo => même rang).
    const ranked = rows.map((r, i) => ({ userId: Number(r.ID_USER), pseudo: clean(r.nm), total: Number(r.tot), finalRank: i + 1 }));
    for (let i = 1; i < ranked.length; i++) {
      if (ranked[i].total === ranked[i - 1].total) ranked[i].finalRank = ranked[i - 1].finalRank;
    }

    ranked.filter((s) => s.finalRank <= 3).forEach((s) =>
      palmares.push({ seasonId, divisionLabel, position: String(s.finalRank), pseudo: s.pseudo }));

    if (tier == null) { warnings.push(`Ligue "${divisionLabel}" sans tier.`); continue; }
    ranked.forEach((s) => {
      const { type, toTier } = computeMovement(s.finalRank, n, tier, minTier, maxTier);
      movements.push({ seasonId, userId: s.userId, fromLeagueId: league.id, fromTier: tier, toTier, type, rankFinal: s.finalRank, pseudo: s.pseudo });
    });
  }

  const cup = await getCupFinal(season.label);
  if (cup.winner) {
    palmares.push({ seasonId, divisionLabel: "Coupe", position: "Vainqueur", pseudo: cup.winner });
    if (cup.finalist) palmares.push({ seasonId, divisionLabel: "Coupe", position: "Finaliste", pseudo: cup.finalist });
  } else warnings.push("Pas de coupe trouvée pour cette saison.");

  console.log("\n=== PODIUMS ===");
  for (const p of palmares) console.log(`  ${p.divisionLabel.padEnd(10)} ${p.position.padEnd(10)} ${p.pseudo}`);
  console.log(`\n=== MOUVEMENTS (${movements.length}) ===`);
  const summary = movements.reduce((a, m) => { a[m.type] = (a[m.type] || 0) + 1; return a; }, {} as Record<string, number>);
  console.log("  ", JSON.stringify(summary));
  for (const m of movements.filter((x) => x.type !== "STAY")) console.log(`  ${m.type.padEnd(11)} ${m.pseudo} (rang ${m.rankFinal}, tier ${m.fromTier}->${m.toTier})`);
  if (warnings.length) { console.log("\n=== WARNINGS ==="); warnings.forEach((w) => console.log("  ⚠", w)); }

  if (dry) { console.log("\n[DRY RUN] rien écrit."); await prisma.$disconnect(); return; }

  await prisma.$transaction(async (tx) => {
    await tx.palmares.deleteMany({ where: { seasonId } });
    await tx.seasonMovement.deleteMany({ where: { seasonId } });
    if (palmares.length) await tx.palmares.createMany({ data: palmares });
    if (movements.length) await tx.seasonMovement.createMany({ data: movements });
    await tx.season.update({ where: { id: seasonId }, data: { status: "CLOSED", closedAt: new Date(), isCurrent: false } });
  });
  console.log(`\nClôture écrite : ${palmares.length} lignes palmarès, ${movements.length} mouvements. Saison -> CLOSED.`);
}

main().catch((e) => { console.error("Erreur:", e); process.exit(1); }).finally(() => prisma.$disconnect());
