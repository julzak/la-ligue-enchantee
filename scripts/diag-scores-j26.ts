/**
 * Diagnostic j26: vérifie pourquoi certaines notes ne sont pas prises en compte.
 * Compare Nico B / Marquinhos (KO) vs RobertaFlamengo / Lepenant (OK).
 * Read-only.
 */

import { prisma } from "../src/lib/prisma";

const DAY = 26;

async function findUser(query: string) {
  return prisma.user.findMany({
    where: { name: { contains: query } },
    select: { id: true, name: true },
  });
}

async function findPlayer(query: string) {
  return prisma.player.findMany({
    where: { OR: [{ lname: { contains: query } }, { fname: { contains: query } }] },
    select: { id: true, fname: true, lname: true, clubId: true, position: true },
  });
}

async function inspectCase(userLabel: string, userNameQuery: string, playerLabel: string, playerNameQuery: string) {
  console.log(`\n=============================`);
  console.log(`CASE: ${userLabel} / ${playerLabel}`);
  console.log(`=============================`);

  const users = await findUser(userNameQuery);
  console.log(`Users matching "${userNameQuery}":`, users);
  const players = await findPlayer(playerNameQuery);
  console.log(`Players matching "${playerNameQuery}":`, players);

  for (const u of users) {
    for (const p of players) {
      console.log(`\n--- userId=${u.id} (${u.name})  playerId=${p.id} (${p.fname} ${p.lname})`);

      const score = await prisma.score.findFirst({ where: { day: DAY, playerId: p.id } });
      console.log(`  SCORE j${DAY}:`, score ? { points: String(score.points), goals: score.goals, passes: score.passes, used: score.used } : "ABSENT");

      const team = await prisma.team.findMany({
        where: { userId: u.id, playerId: p.id },
        select: { leagueId: true, dayFirst: true, dayLast: true, isSubs: true },
      });
      console.log(`  TEAM rows (user owns player):`, team);

      const teamDay = await prisma.teamDay.findMany({
        where: { userId: u.id, playerId: p.id, day: DAY },
        select: { leagueId: true, indx: true, isValid: true },
      });
      console.log(`  TEAM_DAY j${DAY} (starter lineup):`, teamDay);

      // Fallback check: does lineup exist at all for day DAY for this user?
      const anyLineup = await prisma.teamDay.findMany({
        where: { userId: u.id, day: DAY },
        select: { playerId: true, indx: true },
        orderBy: { indx: "asc" },
      });
      console.log(`  FULL LINEUP j${DAY} for user ${u.name}: ${anyLineup.length} rows`);
      if (anyLineup.length === 0) {
        const prev = await prisma.teamDay.findMany({
          where: { userId: u.id, day: DAY - 1 },
          select: { playerId: true, indx: true },
          orderBy: { indx: "asc" },
        });
        console.log(`  (fallback) LINEUP j${DAY - 1}: ${prev.length} rows → will be used by scoring`);
        const inPrev = prev.find((l) => l.playerId === p.id);
        console.log(`  → player ${p.id} in j${DAY - 1} lineup?`, inPrev ? `YES (indx=${inPrev.indx})` : "NO");
      }
    }
  }
}

async function main() {
  await inspectCase("Nico B (KO)", "Nico B", "Marquinhos", "Marqui");
  await inspectCase("RobertaFlamengo (OK control)", "Roberta", "Lepenant", "Lepenant");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
