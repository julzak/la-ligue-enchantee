import { prisma } from "../src/lib/prisma";

async function main() {
  const day = 32;

  const cups = await prisma.$queryRawUnsafe<{ id: number; name: string; status: string; season: string }[]>(
    "SELECT id, name, status, season FROM CUP ORDER BY id DESC LIMIT 5"
  );
  console.log("\nCUP table (top 5 by id):");
  for (const c of cups) console.log(`  #${c.id}  ${c.name}  status=${c.status}  season=${c.season}`);

  const matches = await prisma.$queryRawUnsafe<{
    id: number; cup_id: number; round: string; position: number; matchday: number;
    user1_id: number | null; user2_id: number | null;
    score1: number | null; score2: number | null; winner_id: number | null;
  }[]>(
    "SELECT id, cup_id, round, position, matchday, user1_id, user2_id, score1, score2, winner_id FROM CUP_MATCH WHERE matchday = ? ORDER BY cup_id DESC, position",
    day
  );
  console.log(`\nCUP_MATCH where matchday=${day} (${matches.length} rows):`);
  for (const m of matches) {
    console.log(`  cup#${m.cup_id} ${m.round} pos${m.position}  user1=${m.user1_id}  user2=${m.user2_id}  score=${m.score1}-${m.score2}  winner=${m.winner_id}`);
  }

  const userIds = Array.from(new Set(
    matches.flatMap((m) => [m.user1_id, m.user2_id, m.winner_id].filter((x): x is number => x !== null))
  ));
  if (userIds.length > 0) {
    const placeholders = userIds.map(() => "?").join(",");
    const users = await prisma.$queryRawUnsafe<{ ID_USER: number; NAME: string }[]>(
      `SELECT ID_USER, NAME FROM USER WHERE ID_USER IN (${placeholders})`,
      ...userIds
    );
    const nameOf = new Map(users.map((u) => [Number(u.ID_USER), (u.NAME ?? "").replace(/<[^>]*>/g, "").trim()]));

    console.log(`\nHuman-readable matches J${day}:`);
    for (const m of matches) {
      const n1 = m.user1_id ? nameOf.get(m.user1_id) ?? `#${m.user1_id}` : "—";
      const n2 = m.user2_id ? nameOf.get(m.user2_id) ?? `#${m.user2_id}` : "—";
      const winner = m.winner_id ? nameOf.get(m.winner_id) ?? `#${m.winner_id}` : "(pas de winner)";
      console.log(`  cup#${m.cup_id} ${m.round}: ${n1} ${m.score1 ?? "?"} - ${m.score2 ?? "?"} ${n2}  → ${winner}`);
    }
  }

  const benhijk = await prisma.$queryRawUnsafe<{ ID_USER: number; NAME: string }[]>(
    "SELECT ID_USER, NAME FROM USER WHERE NAME LIKE ? OR NAME LIKE ?",
    "%Benhijk%", "%enhijk%"
  );
  console.log(`\nBenhijk search (${benhijk.length} matches):`);
  for (const b of benhijk) console.log(`  #${b.ID_USER}  ${(b.NAME ?? "").replace(/<[^>]*>/g, "").trim()}`);

  // For each Benhijk-like, list ALL their cup matches in the active cup
  const activeCup = cups.find((c) => c.status === "active");
  if (activeCup && benhijk.length > 0) {
    for (const b of benhijk) {
      const allMatches = await prisma.$queryRawUnsafe<{
        round: string; matchday: number; user1_id: number | null; user2_id: number | null;
        score1: number | null; score2: number | null; winner_id: number | null;
      }[]>(
        "SELECT round, matchday, user1_id, user2_id, score1, score2, winner_id FROM CUP_MATCH WHERE cup_id = ? AND (user1_id = ? OR user2_id = ?) ORDER BY matchday",
        activeCup.id, b.ID_USER, b.ID_USER
      );
      console.log(`\nAll cup matches for ${(b.NAME ?? "").replace(/<[^>]*>/g, "").trim()} in active cup #${activeCup.id}:`);
      for (const m of allMatches) {
        const win = m.winner_id === Number(b.ID_USER) ? "WIN" : m.winner_id === null ? "—" : `lost to #${m.winner_id}`;
        console.log(`  J${m.matchday} ${m.round}: ${m.user1_id} ${m.score1 ?? "?"} - ${m.score2 ?? "?"} ${m.user2_id}  [${win}]`);
      }
    }
  }

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
