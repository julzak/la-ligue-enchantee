/**
 * Import ALL player photos from Sportmonks into DB.
 * Uses squad endpoint per team to get every L1 player + photo.
 *
 * Usage: npx tsx scripts/import-photos-sportmonks.ts
 */

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const prisma = new PrismaClient();
const API_TOKEN = "7ltjbIObU56DdJ5mmbVWBwdieOBjQXlaS37OsMAAy2Gk6eKXRJzFPUsXVUDf";

// Sportmonks team ID → DB club name
const TEAM_MAP: Record<number, string> = {
  776: "ANGERS", 3682: "AUXERRE", 266: "BREST", 690: "LILLE",
  1055: "LE HAVRE", 271: "LENS", 9257: "LORIENT", 3513: "METZ",
  6789: "MONACO (ASM)", 59: "NANTES", 450: "NICE",
  79: "LYON (OL)", 44: "MARSEILLE (OM)", 4508: "PARIS FC",
  591: "PARIS-SG (PSG)", 598: "RENNES", 686: "STRASBOURG", 289: "TOULOUSE",
};

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[- ']/g, "");
}

async function main() {
  // Build DB player lookup: normalized(lname)|clubName → playerId
  const players = await prisma.$queryRawUnsafe<
    { ID_PLAYER: number; FNAME: string; LNAME: string; ID_CLUB: number }[]
  >("SELECT ID_PLAYER, FNAME, LNAME, ID_CLUB FROM PLAYER WHERE ID_CLUB > 0");

  const clubs = await prisma.$queryRawUnsafe<{ id: number; name: string }[]>(
    "SELECT ID_CLUB as id, NAME as name FROM CLUB"
  );
  const clubIdToName = new Map(clubs.map((c) => [c.id, c.name]));

  // Index DB players by normalized name + club
  const dbLookup = new Map<string, number>();
  players.forEach((p) => {
    const clubName = clubIdToName.get(p.ID_CLUB) ?? "";
    const keys = [
      normalize(p.LNAME) + "|" + clubName,
      normalize(p.FNAME + p.LNAME) + "|" + clubName,
      normalize(p.FNAME) + "|" + clubName,
    ];
    keys.forEach((k) => dbLookup.set(k, p.ID_PLAYER));
  });

  console.log(`DB players: ${players.length} | Clubs: ${Object.keys(TEAM_MAP).length}\n`);

  let totalMatched = 0;
  let totalApi = 0;
  let totalMissed = 0;

  for (const [teamId, dbClubName] of Object.entries(TEAM_MAP)) {
    console.log(`\n${dbClubName}...`);

    const res = await fetch(
      `https://api.sportmonks.com/v3/football/squads/teams/${teamId}?api_token=${API_TOKEN}&include=player`
    );
    const data = await res.json();

    if (!data.data) {
      console.log("  No data");
      continue;
    }

    let clubMatched = 0;
    let clubMissed = 0;

    for (const entry of data.data) {
      const pl = entry.player;
      if (!pl) continue;
      totalApi++;

      const photo = pl.image_path;
      if (!photo) continue;

      const apiName = normalize(pl.display_name ?? pl.common_name ?? pl.name ?? "");
      const apiLast = normalize(pl.lastname ?? "");
      const apiFirst = normalize(pl.firstname ?? "");

      // Try to match in DB
      const candidates = [
        dbLookup.get(apiLast + "|" + dbClubName),
        dbLookup.get(apiName + "|" + dbClubName),
        dbLookup.get(apiFirst + apiLast + "|" + dbClubName),
        dbLookup.get(apiFirst + "|" + dbClubName),
      ].filter(Boolean);

      const playerId = candidates[0];
      if (playerId) {
        await prisma.$executeRawUnsafe(
          "UPDATE PLAYER SET PHOTO_URL = ? WHERE ID_PLAYER = ?",
          photo, playerId
        );
        clubMatched++;
        totalMatched++;
      } else {
        clubMissed++;
        totalMissed++;
      }
    }

    console.log(`  ${data.data.length} players | Matched: ${clubMatched} | Missed: ${clubMissed}`);
    await new Promise((r) => setTimeout(r, 500));
  }

  // Final count
  const withPhoto = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
    "SELECT COUNT(*) as c FROM PLAYER WHERE PHOTO_URL IS NOT NULL AND PHOTO_URL != ''"
  );

  console.log(`\n=== SUMMARY ===`);
  console.log(`  API players seen: ${totalApi}`);
  console.log(`  Matched to DB: ${totalMatched}`);
  console.log(`  Not in DB: ${totalMissed}`);
  console.log(`  Total photos in DB: ${Number(withPhoto[0].c)} / ${players.length}`);

  await prisma.$disconnect();
}

main().catch(console.error);
