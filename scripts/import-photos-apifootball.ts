/**
 * Import player photos from API-Football into the DB.
 * Complements TheSportsDB import (fills the gaps).
 *
 * Usage:
 *   npx tsx scripts/import-photos-apifootball.ts          # import missing photos
 *   npx tsx scripts/import-photos-apifootball.ts --force   # re-import all
 *
 * Free tier: 100 req/day, season 2024 only. 46 pages = 46 requests.
 */

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const prisma = new PrismaClient();
const API_KEY = process.env.API_FOOTBALL_KEY!;

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[- ']/g, "");
}

async function main() {
  const force = process.argv.includes("--force");

  // Get DB players without photos
  const dbPlayers = await prisma.$queryRawUnsafe<
    { ID_PLAYER: number; FNAME: string; LNAME: string; ID_CLUB: number; PHOTO_URL: string | null }[]
  >(
    force
      ? "SELECT ID_PLAYER, FNAME, LNAME, ID_CLUB, PHOTO_URL FROM PLAYER WHERE ID_CLUB > 0"
      : "SELECT ID_PLAYER, FNAME, LNAME, ID_CLUB, PHOTO_URL FROM PLAYER WHERE ID_CLUB > 0 AND (PHOTO_URL IS NULL OR PHOTO_URL = '')"
  );

  console.log(`DB players to process: ${dbPlayers.length}${force ? " (force)" : " (missing photos only)"}`);

  // Build lookup by normalized name
  const dbLookup = new Map<string, { id: number; fname: string; lname: string }[]>();
  dbPlayers.forEach((p) => {
    const keys = [
      normalize(p.LNAME),
      normalize(p.FNAME + p.LNAME),
      normalize(p.FNAME),
    ];
    keys.forEach((k) => {
      const arr = dbLookup.get(k) ?? [];
      arr.push({ id: p.ID_PLAYER, fname: p.FNAME, lname: p.LNAME });
      dbLookup.set(k, arr);
    });
  });

  // Fetch all L1 players from API-Football (season 2024, 20 per page)
  let page = 1;
  let totalPages = 1;
  let matched = 0;
  let apiPlayers = 0;
  let requests = 0;

  while (page <= totalPages && requests < 95) { // stay under 100/day limit
    console.log(`\nFetching page ${page}/${totalPages}...`);
    const res = await fetch(
      `https://v3.football.api-sports.io/players?league=61&season=2024&page=${page}`,
      { headers: { "x-apisports-key": API_KEY } }
    );
    const data = await res.json();
    requests++;

    if (data.paging) totalPages = data.paging.total;
    if (!data.response) { page++; continue; }

    for (const entry of data.response) {
      const apiPlayer = entry.player;
      apiPlayers++;
      const photo = apiPlayer.photo;
      if (!photo) continue;

      const apiName = normalize(apiPlayer.name ?? "");
      const apiFirst = normalize(apiPlayer.firstname ?? "");
      const apiLast = normalize(apiPlayer.lastname ?? "");

      // Try matching against DB
      const candidates = [
        ...(dbLookup.get(apiLast) ?? []),
        ...(dbLookup.get(apiName) ?? []),
        ...(dbLookup.get(apiFirst + apiLast) ?? []),
      ];

      // Deduplicate candidates by ID
      const seen = new Set<number>();
      const unique = candidates.filter((c) => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });

      if (unique.length === 1) {
        // Exact match
        await prisma.$executeRawUnsafe(
          "UPDATE PLAYER SET PHOTO_URL = ? WHERE ID_PLAYER = ?",
          photo, unique[0].id
        );
        matched++;
      } else if (unique.length > 1) {
        // Multiple matches — try to narrow down with first name
        const exact = unique.find((c) => normalize(c.fname) === apiFirst);
        if (exact) {
          await prisma.$executeRawUnsafe(
            "UPDATE PLAYER SET PHOTO_URL = ? WHERE ID_PLAYER = ?",
            photo, exact.id
          );
          matched++;
        }
      }
    }

    console.log(`  API players: ${apiPlayers} | Matched: ${matched} | Requests: ${requests}/${95}`);
    page++;

    // Rate limit: ~2 req/sec is fine
    await new Promise((r) => setTimeout(r, 500));
  }

  // Count final stats
  const withPhoto = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
    "SELECT COUNT(*) as c FROM PLAYER WHERE PHOTO_URL IS NOT NULL AND PHOTO_URL != ''"
  );
  const totalWithClub = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
    "SELECT COUNT(*) as c FROM PLAYER WHERE ID_CLUB > 0"
  );

  console.log(`\n=== SUMMARY ===`);
  console.log(`  API requests used: ${requests}`);
  console.log(`  New photos matched: ${matched}`);
  console.log(`  Total photos in DB: ${Number(withPhoto[0].c)} / ${Number(totalWithClub[0].c)} players`);

  await prisma.$disconnect();
}

main().catch(console.error);
