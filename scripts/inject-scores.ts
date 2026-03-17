/**
 * Inject scraped ratings into the SCORE table.
 *
 * Usage:
 *   npx tsx scripts/inject-scores.ts 26                    # inject J26 from combined ratings
 *   npx tsx scripts/inject-scores.ts 26 --file ratings.json # custom file
 *   npx tsx scripts/inject-scores.ts 26 --dry-run           # preview without writing
 *
 * Flow:
 *   1. Load scraped ratings JSON
 *   2. Match player names to DB PLAYER table (by last name + club)
 *   3. Validate scores against TheSportsDB
 *   4. Upsert into SCORE table
 *   5. Report: matched, unmatched, warnings
 */

import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const prisma = new PrismaClient();

// Club abbreviation (from scraper) → DB club name
const CLUB_MAP: Record<string, string> = {
  LOSC: "LILLE", SRFC: "RENNES", FCM: "METZ", HAC: "LE HAVRE",
  OL: "LYON (OL)", TFC: "TOULOUSE", RCSA: "STRASBOURG", PFC: "PARIS FC",
  FCL: "LORIENT", RCL: "LENS", ASM: "MONACO (ASM)", OM: "MARSEILLE (OM)",
  PSG: "PSG", SB29: "BREST", SCO: "ANGERS", OGCN: "NICE",
  AJA: "AUXERRE", FCN: "NANTES",
};

// TheSportsDB reference scores for validation
async function getApiScores(matchday: number): Promise<Map<string, { home: string; away: string; h: number; a: number }>> {
  const res = await fetch(
    `https://www.thesportsdb.com/api/v1/json/3/eventsround.php?id=4334&r=${matchday}&s=2025-2026`
  );
  const data = await res.json();
  const scores = new Map<string, { home: string; away: string; h: number; a: number }>();

  if (data.events) {
    for (const e of data.events) {
      if (e.intHomeScore !== null) {
        const key = e.strHomeTeam.toLowerCase();
        scores.set(key, {
          home: e.strHomeTeam,
          away: e.strAwayTeam,
          h: parseInt(e.intHomeScore),
          a: parseInt(e.intAwayScore),
        });
      }
    }
  }
  return scores;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[- ']/g, "");
}

interface ScrapedRating {
  playerName: string;
  club: string;
  rating: number | null;
  confidence?: string;
  goals: number;
  assists: number;
  ownGoals: number;
  redCard: boolean;
  match: string;
}

async function main() {
  const args = process.argv.slice(2);
  const matchday = parseInt(args[0]);
  if (!matchday) {
    console.log("Usage: npx tsx scripts/inject-scores.ts <matchday> [--file path] [--dry-run]");
    process.exit(0);
  }

  const dryRun = args.includes("--dry-run");
  const fileIdx = args.indexOf("--file");
  const inputFile = fileIdx >= 0 && args[fileIdx + 1]
    ? args[fileIdx + 1]
    : path.join(__dirname, "..", "tmp/kiosque-ratings-combined.json");

  console.log(`Inject scores for J${matchday}`);
  console.log(`Source: ${inputFile}`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log("---\n");

  // 1. Load scraped data
  const scraped: ScrapedRating[] = JSON.parse(fs.readFileSync(inputFile, "utf-8"));
  console.log(`Loaded ${scraped.length} scraped ratings`);

  // 2. Validate scores against TheSportsDB
  const apiScores = await getApiScores(matchday);
  console.log(`TheSportsDB: ${apiScores.size} matches with scores\n`);

  const validScraped = scraped.filter((s) => {
    if (!s.match || s.rating === null) return false;
    // Check if the scraped match score matches TheSportsDB
    const m = s.match.match(/^(.+?)\s+(\d+)-(\d+)\s+(.+)$/);
    if (!m) return false;
    const homeTeam = m[1].toLowerCase();
    const scrapedH = parseInt(m[2]);
    const scrapedA = parseInt(m[3]);

    for (const [key, api] of Array.from(apiScores.entries())) {
      if (homeTeam.includes(key) || key.includes(homeTeam)) {
        return scrapedH === api.h && scrapedA === api.a;
      }
    }
    return false; // match not found in API = skip
  });

  console.log(`After score validation: ${validScraped.length} ratings (filtered ${scraped.length - validScraped.length} bad scores)\n`);

  // 3. Build DB player lookup: normalize(lname)|clubName → playerId
  const players = await prisma.player.findMany();
  const clubs = await prisma.club.findMany();
  const clubMap = new Map(clubs.map((c) => [c.id, c.name]));
  const clubIdByName = new Map(clubs.map((c) => [c.name, c.id]));

  const playerLookup = new Map<string, { id: number; name: string; clubName: string }>();
  players.forEach((pl) => {
    const clubName = clubMap.get(pl.clubId) ?? "";
    const keys = [
      normalize(pl.lname) + "|" + clubName,
      normalize(pl.fname + pl.lname) + "|" + clubName,
    ];
    keys.forEach((k) => playerLookup.set(k, { id: pl.id, name: `${pl.fname} ${pl.lname}`.trim(), clubName }));
  });

  // 4. Match and inject
  let matched = 0, unmatched = 0, skipped = 0, warnings = 0;
  const toInject: { playerId: number; playerName: string; rating: number; goals: number; passes: number; confidence: string }[] = [];
  const warningList: string[] = [];

  validScraped.forEach((s) => {
    const dbClubName = CLUB_MAP[s.club];
    if (!dbClubName) { unmatched++; return; }

    const sName = normalize(s.playerName);

    // Try exact match
    let db = playerLookup.get(sName + "|" + dbClubName);

    // Try partial match within same club
    if (!db) {
      for (const [key, val] of playerLookup.entries()) {
        if (!key.endsWith("|" + dbClubName)) continue;
        const dbName = key.split("|")[0];
        if (
          (sName.length > 3 && dbName.includes(sName)) ||
          (dbName.length > 3 && sName.includes(dbName))
        ) {
          db = val;
          break;
        }
      }
    }

    if (!db) { unmatched++; return; }

    // Check confidence
    if (s.confidence === "low") {
      warningList.push(`⚠️  ${s.playerName} (${s.club}): ${s.rating} [low confidence] → ${db.name}`);
      warnings++;
    }

    // Check if already exists with different value
    const existing = toInject.find((e) => e.playerId === db!.id);
    if (existing) {
      // Keep the one with higher confidence or skip
      skipped++;
      return;
    }

    toInject.push({
      playerId: db.id,
      playerName: db.name,
      rating: s.rating!,
      goals: s.goals ?? 0,
      passes: s.assists ?? 0,
      confidence: s.confidence ?? "high",
    });
    matched++;
  });

  console.log(`=== MATCHING RESULTS ===`);
  console.log(`  Matched:   ${matched}`);
  console.log(`  Unmatched: ${unmatched} (not in fantasy roster — normal)`);
  console.log(`  Skipped:   ${skipped} (duplicates)`);
  console.log(`  Warnings:  ${warnings}`);

  if (warningList.length > 0) {
    console.log(`\n=== WARNINGS (admin review needed) ===`);
    warningList.forEach((w) => console.log(`  ${w}`));
  }

  console.log(`\n=== TO INJECT (${toInject.length} scores) ===`);
  toInject.forEach((s) => {
    const extras = [];
    if (s.goals > 0) extras.push(`${s.goals}g`);
    if (s.passes > 0) extras.push(`${s.passes}a`);
    console.log(`  ${s.playerName.padEnd(25)} ${s.rating}${extras.length ? " [" + extras.join(",") + "]" : ""}${s.confidence !== "high" ? " ⚠️" : ""}`);
  });

  // 5. Inject into DB
  if (dryRun) {
    console.log(`\n--- DRY RUN: nothing written to DB ---`);
  } else {
    console.log(`\nWriting ${toInject.length} scores to DB...`);
    for (const s of toInject) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO SCORE (ID_PLAYER, DAY, USED, POINTS, GOALS, PASSES)
         VALUES (?, ?, 1, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           USED = 1,
           POINTS = VALUES(POINTS),
           GOALS = VALUES(GOALS),
           PASSES = VALUES(PASSES)`,
        s.playerId, matchday, s.rating, s.goals, s.passes
      );
    }
    console.log(`Done! ${toInject.length} scores injected for J${matchday}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
