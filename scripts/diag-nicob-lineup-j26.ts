import { prisma } from "../src/lib/prisma";

async function main() {
  const user = await prisma.user.findFirst({ where: { name: "Nico B" } });
  if (!user) throw new Error("Nico B not found");

  const lineup = await prisma.teamDay.findMany({
    where: { userId: user.id, day: 26 },
    orderBy: { indx: "asc" },
  });

  const players = await prisma.player.findMany({
    where: { id: { in: lineup.map((l) => l.playerId) } },
  });
  const clubs = await prisma.club.findMany({
    where: { id: { in: players.map((p) => p.clubId) } },
  });
  const pMap = new Map(players.map((p) => [p.id, p]));
  const cMap = new Map(clubs.map((c) => [c.id, c.name]));

  console.log(`\nLineup Nico B j26 (11 titulaires):\n`);
  for (const l of lineup) {
    const p = pMap.get(l.playerId);
    const name = p ? `${p.fname} ${p.lname}`.trim() : `Player ${l.playerId}`;
    const club = p ? cMap.get(p.clubId) ?? "?" : "?";
    console.log(`  ${String(l.indx).padStart(2)}. ${name.padEnd(28)} (${club}) — ${p?.position ?? "?"}`);
  }

  // Check if Marquinhos is in the squad (TEAM) but not in lineup
  const team = await prisma.team.findMany({
    where: { userId: user.id, dayFirst: { lte: 26 }, dayLast: { gte: 26 } },
  });
  const benched = team.filter((t) => !lineup.find((l) => l.playerId === t.playerId));
  const benchPlayers = await prisma.player.findMany({
    where: { id: { in: benched.map((b) => b.playerId) } },
  });
  console.log(`\nBanc (squad non-aligné) Nico B j26:`);
  for (const b of benchPlayers) {
    console.log(`  - ${b.fname} ${b.lname} (${cMap.get(b.clubId) ?? "?"})`);
  }

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
