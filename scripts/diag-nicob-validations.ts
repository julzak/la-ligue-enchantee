import { prisma } from "../src/lib/prisma";

async function main() {
  const user = await prisma.user.findFirst({ where: { name: "Nico B" } });
  if (!user) throw new Error("Nico B not found");

  // Dernière TEAM_DAY sauvée/validée par Nico B (toutes journées confondues)
  const lastSave = await prisma.teamDay.findFirst({
    where: { userId: user.id },
    orderBy: { dtSave: "desc" },
  });
  const lastValid = await prisma.teamDay.findFirst({
    where: { userId: user.id, isValid: 1 },
    orderBy: { dtValid: "desc" },
  });

  console.log(`\nNico B (userId=${user.id}) — dernière activité lineup:`);
  console.log(`  Dernière ligne TEAM_DAY sauvée: day=${lastSave?.day} dtSave=${lastSave?.dtSave} isValid=${lastSave?.isValid}`);
  console.log(`  Dernière ligne TEAM_DAY validée: day=${lastValid?.day} dtValid=${lastValid?.dtValid}`);

  // Détail par journée (5 dernières)
  const recentDays = await prisma.$queryRawUnsafe<{ DAY: number; nb: bigint; MAX_SAVE: Date; MAX_VALID: Date; any_invalid: number }[]>(
    `SELECT DAY, COUNT(*) as nb, MAX(DT_SAVE) as MAX_SAVE, MAX(DT_VALID) as MAX_VALID,
            SUM(CASE WHEN IS_VALID = 0 THEN 1 ELSE 0 END) as any_invalid
       FROM TEAM_DAY
      WHERE ID_USER = ?
      GROUP BY DAY
      ORDER BY DAY DESC
      LIMIT 5`,
    user.id
  );
  console.log(`\nDétail par journée (5 plus récentes):`);
  for (const r of recentDays) {
    console.log(`  j${r.DAY} — ${r.nb} joueurs — dernière save: ${r.MAX_SAVE} — dernière valid: ${r.MAX_VALID} — non-valid: ${r.any_invalid}`);
  }

  // Focus j26: horodatage complet du lineup + état isValid
  console.log(`\nLineup j26 — horodatages ligne par ligne:`);
  const j26 = await prisma.teamDay.findMany({
    where: { userId: user.id, day: 26 },
    orderBy: { indx: "asc" },
  });
  const players = await prisma.player.findMany({ where: { id: { in: j26.map((l) => l.playerId) } } });
  const pMap = new Map(players.map((p) => [p.id, p]));
  for (const l of j26) {
    const p = pMap.get(l.playerId);
    const name = p ? `${p.fname} ${p.lname}`.trim() : `Player ${l.playerId}`;
    console.log(`  indx=${String(l.indx).padStart(2)}  ${name.padEnd(30)}  isValid=${l.isValid}  dtSave=${l.dtSave}  dtValid=${l.dtValid}`);
  }

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
