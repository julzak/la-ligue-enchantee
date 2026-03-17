/**
 * Import player photos from TheSportsDB into the DB PLAYER table.
 *
 * Usage:
 *   npx tsx scripts/import-player-photos-db.ts           # all players with a club
 *   npx tsx scripts/import-player-photos-db.ts --force    # re-import even if photo exists
 *
 * Searches TheSportsDB by player name, saves strCutout (or strThumb) URL to PHOTO_URL column.
 */

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const prisma = new PrismaClient();

async function searchPlayer(name: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(name)}`
    );
    const data = await res.json();
    if (!data.player || data.player.length === 0) return null;
    // Prefer cutout (transparent PNG), fallback to thumb
    return data.player[0].strCutout || data.player[0].strThumb || null;
  } catch {
    return null;
  }
}

async function main() {
  const force = process.argv.includes("--force");

  // Get all players with a valid club (skip clubId 0 and "Légion étrangère")
  const players = await prisma.$queryRawUnsafe<
    { ID_PLAYER: number; FNAME: string; LNAME: string; ID_CLUB: number; PHOTO_URL: string | null }[]
  >(
    force
      ? "SELECT ID_PLAYER, FNAME, LNAME, ID_CLUB, PHOTO_URL FROM PLAYER WHERE ID_CLUB > 0"
      : "SELECT ID_PLAYER, FNAME, LNAME, ID_CLUB, PHOTO_URL FROM PLAYER WHERE ID_CLUB > 0 AND (PHOTO_URL IS NULL OR PHOTO_URL = '')"
  );

  console.log(`Players to process: ${players.length}${force ? " (force mode)" : ""}\n`);

  let found = 0, notFound = 0, errors = 0;

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const fullName = `${p.FNAME} ${p.LNAME}`.trim();

    // Try full name first, then last name only
    let photoUrl = await searchPlayer(fullName);
    if (!photoUrl && p.LNAME.length > 3) {
      photoUrl = await searchPlayer(p.LNAME);
    }

    if (photoUrl) {
      await prisma.$executeRawUnsafe(
        "UPDATE PLAYER SET PHOTO_URL = ? WHERE ID_PLAYER = ?",
        photoUrl, p.ID_PLAYER
      );
      found++;
    } else {
      notFound++;
    }

    if ((i + 1) % 20 === 0) {
      console.log(`  ${i + 1}/${players.length} — ${found} found, ${notFound} not found`);
    }

    // Rate limit: 500ms between calls
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`  Total:     ${players.length}`);
  console.log(`  Found:     ${found} (${(found / players.length * 100).toFixed(0)}%)`);
  console.log(`  Not found: ${notFound}`);
  console.log(`  Errors:    ${errors}`);

  await prisma.$disconnect();
}

main().catch(console.error);
