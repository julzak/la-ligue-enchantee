/**
 * Full matchday processing pipeline.
 *
 * Usage: npx tsx scripts/process-matchday.ts 26 [--dry-run]
 *
 * Pipeline:
 *   1. TheSportsDB → match dates + scores
 *   2. L'Équipe web articles → infographic OCR (notes via Gemini)
 *   3. Sportmonks → goals, red cards
 *   4. L'Équipe text → assists (from article descriptions)
 *   5. Inject into DB SCORE table
 */

import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { getMatchday } from "./lib/sportsdb";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const prisma = new PrismaClient();
const PROFILE = path.join(__dirname, "..", "tmp/lequipe-profile");
const SPORTMONKS_TOKEN = "7ltjbIObU56DdJ5mmbVWBwdieOBjQXlaS37OsMAAy2Gk6eKXRJzFPUsXVUDf";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// ── Club name mapping ────────────────────────────────────
const CLUB_TO_DB: Record<string, string> = {
  "Marseille": "MARSEILLE (OM)", "OM": "MARSEILLE (OM)", "Olympique Marseille": "MARSEILLE (OM)",
  "Lyon": "LYON (OL)", "OL": "LYON (OL)", "Olympique Lyonnais": "LYON (OL)",
  "Monaco": "MONACO (ASM)", "ASM": "MONACO (ASM)",
  "Lille": "LILLE", "LOSC": "LILLE", "LOSC Lille": "LILLE",
  "Rennes": "RENNES", "SRFC": "RENNES",
  "Le Havre": "LE HAVRE", "HAC": "LE HAVRE",
  "Metz": "METZ", "FCM": "METZ",
  "Toulouse": "TOULOUSE", "TFC": "TOULOUSE",
  "Strasbourg": "STRASBOURG", "RCSA": "STRASBOURG",
  "Paris FC": "PARIS FC", "PFC": "PARIS FC", "Paris": "PARIS FC",
  "Lens": "LENS", "RCL": "LENS",
  "Lorient": "LORIENT", "FCL": "LORIENT",
  "Brest": "BREST", "SB29": "BREST",
  "Angers": "ANGERS", "SCO": "ANGERS",
  "Nice": "NICE", "OGCN": "NICE",
  "Auxerre": "AUXERRE", "AJA": "AUXERRE",
  "Nantes": "NANTES", "FCN": "NANTES",
  "PSG": "PARIS-SG (PSG)", "Paris SG": "PARIS-SG (PSG)", "Paris Saint Germain": "PARIS-SG (PSG)",
};

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[- ']/g, "");
}

// ── Step 1: Get article URLs from L'Équipe ───────────────
async function findArticleUrls(
  ctx: Awaited<ReturnType<typeof chromium.launchPersistentContext>>,
  matches: Awaited<ReturnType<typeof getMatchday>>
): Promise<Map<string, string>> {
  const page = ctx.pages()[0] || await ctx.newPage();
  const matchToUrl = new Map<string, string>();

  // Browse L1 page to find note articles
  await page.goto("https://www.lequipe.fr/Football/Ligue-1/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  try { await page.click('text="oui, j\'accepte"', { timeout: 2000 }); } catch {}
  for (let i = 0; i < 5; i++) { await page.evaluate(s => window.scrollTo(0, s * 1000), i + 1); await page.waitForTimeout(500); }

  const allLinks = await page.evaluate(() => {
    const results: { href: string; text: string }[] = [];
    document.querySelectorAll("a[href]").forEach((a) => {
      const href = (a as HTMLAnchorElement).href;
      if (href.includes("/Football/Article/") && href.toLowerCase().includes("note")) {
        results.push({ href, text: (a as HTMLElement).textContent?.trim() ?? "" });
      }
    });
    return results;
  });

  for (const match of matches) {
    if (match.homeScore === null) continue;
    const label = `${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}`;
    const homeFrags = [match.homeTeam.split(" ").pop()!.toLowerCase()];
    const awayFrags = [match.awayTeam.split(" ").pop()!.toLowerCase()];

    // Search in browse results
    const found = allLinks.find(l =>
      homeFrags.some(h => l.href.toLowerCase().includes(h)) ||
      awayFrags.some(a => l.href.toLowerCase().includes(a))
    );
    if (found) {
      matchToUrl.set(label, found.href);
    } else {
      // Try search
      for (const term of [`notes ${homeFrags[0]} ${awayFrags[0]}`, `notes ${homeFrags[0]}-${awayFrags[0]}`]) {
        await page.goto(`https://www.lequipe.fr/recherche?q=${encodeURIComponent(term)}&type=article`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(2000);
        const searchLink = await page.evaluate(() => {
          for (const a of document.querySelectorAll("a[href]")) {
            const href = (a as HTMLAnchorElement).href;
            if (href.includes("/Football/Article/") && href.toLowerCase().includes("note")) {
              const idMatch = href.match(/\/(\d+)$/);
              if (idMatch && parseInt(idMatch[1]) > 1650000) return href;
            }
          }
          return null;
        });
        if (searchLink) { matchToUrl.set(label, searchLink); break; }
      }
    }
  }

  return matchToUrl;
}

// ── Step 2: Extract notes from infographics ──────────────
async function extractNotesFromArticles(
  ctx: Awaited<ReturnType<typeof chromium.launchPersistentContext>>,
  matchToUrl: Map<string, string>
): Promise<{ playerName: string; rating: number; match: string }[]> {
  const page = ctx.pages()[0] || await ctx.newPage();
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const allRatings: { playerName: string; rating: number; match: string }[] = [];

  for (const [match, url] of Array.from(matchToUrl.entries())) {
    console.log(`\n📰 ${match}`);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    try { await page.click('text="oui, j\'accepte"', { timeout: 2000 }); } catch {}
    for (let i = 0; i < 15; i++) { await page.evaluate(s => window.scrollTo(0, s * 600), i); await page.waitForTimeout(200); }

    // Find infographic image
    const imgSrc = await page.evaluate(() => {
      for (const img of document.querySelectorAll("img")) {
        const alt = (img.alt || "").toLowerCase();
        if (alt.includes("note") || alt.includes("infographie")) return img.src;
      }
      return null;
    });

    if (!imgSrc) { console.log("  ❌ No infographic"); continue; }

    // Download image
    const imgBuffer = await page.evaluate(async (src) => {
      const res = await fetch(src);
      const buf = await res.arrayBuffer();
      return Array.from(new Uint8Array(buf));
    }, imgSrc);

    const base64 = Buffer.from(imgBuffer).toString("base64");
    console.log(`  📷 ${Math.round(imgBuffer.length / 1024)} KB`);

    // OCR with Gemini
    const result = await model.generateContent([
      { inlineData: { mimeType: "image/jpeg", data: base64 } },
      { text: 'Extrais les notes de joueurs de football. Les notes sont des chiffres dans des cercles colorés. Retourne un JSON: [{"playerName":"nom","rating":N}]. Chaque joueur a sa propre note. Retourne UNIQUEMENT le JSON.' },
    ]);
    const text = result.response.text();
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start >= 0 && end > start) {
      const ratings = JSON.parse(text.slice(start, end + 1));
      console.log(`  ✅ ${ratings.length} notes`);
      ratings.forEach((r: { playerName: string; rating: number }) => allRatings.push({ ...r, match }));
    }

    await new Promise(r => setTimeout(r, 4500));
  }

  return allRatings;
}

// ── Step 3: Get goals + red cards from Sportmonks ────────
interface MatchEvent {
  playerName: string;
  type: "goal" | "red_card";
  minute: number;
  team: string;
}

async function getSportmonksEvents(matchday: number): Promise<MatchEvent[]> {
  // Get L1 fixtures for this date range
  const matches = await getMatchday(matchday);
  const events: MatchEvent[] = [];

  for (const match of matches) {
    if (match.homeScore === null) continue;

    const res = await fetch(
      `https://api.sportmonks.com/v3/football/fixtures/date/${match.date}?api_token=${SPORTMONKS_TOKEN}&filters=fixtureLeagueIds:301&include=events.player`
    );
    const data = await res.json();

    for (const fixture of data.data ?? []) {
      const fName = (fixture.name ?? "").toLowerCase();
      const homeNorm = match.homeTeam.split(" ").pop()!.toLowerCase();
      if (!fName.includes(homeNorm)) continue;

      for (const e of fixture.events ?? []) {
        const playerName = e.player?.display_name ?? e.player_name ?? "";
        if (e.type_id === 14) { // goal
          events.push({ playerName, type: "goal", minute: e.minute, team: match.homeTeam });
        } else if (e.type_id === 20 || (e.type_id === 19 && String(e.addition ?? "").toLowerCase().includes("red"))) {
          events.push({ playerName, type: "red_card", minute: e.minute, team: match.homeTeam });
        }
      }
    }

    await new Promise(r => setTimeout(r, 500));
  }

  return events;
}

// ── Step 4: Match to DB + inject ─────────────────────────
async function injectScores(
  matchday: number,
  notes: { playerName: string; rating: number; match: string }[],
  events: MatchEvent[],
  dryRun: boolean
) {
  const players = await prisma.player.findMany();
  const clubs = await prisma.club.findMany();
  const clubIdToName = new Map(clubs.map(c => [c.id, c.name]));
  const clubNameToId = new Map(clubs.map(c => [c.name, c.id]));

  // Build lookup: norm(lname)|clubName → player
  const dbLookup = new Map<string, { id: number; name: string; clubName: string; position: string }>();
  players.forEach(pl => {
    const clubName = clubIdToName.get(pl.clubId) ?? "";
    [norm(pl.lname), norm(pl.fname + pl.lname), norm(pl.fname)].forEach(k => {
      dbLookup.set(k + "|" + clubName, { id: pl.id, name: `${pl.fname} ${pl.lname}`.trim(), clubName, position: pl.position });
    });
  });

  // Build goal/card lookup by player name
  const goalsByPlayer = new Map<string, number>();
  const redCards = new Set<string>();
  events.forEach(e => {
    const key = norm(e.playerName);
    if (e.type === "goal") goalsByPlayer.set(key, (goalsByPlayer.get(key) ?? 0) + 1);
    if (e.type === "red_card") redCards.add(key);
  });

  // Match notes to DB players
  const toInject: { playerId: number; name: string; rating: number; goals: number; passes: number }[] = [];
  let matched = 0, notFound = 0;

  for (const note of notes) {
    const sn = norm(note.playerName);

    // Try to find in DB (match by name across all clubs)
    let db: typeof dbLookup extends Map<string, infer V> ? V : never | undefined;
    for (const [k, v] of Array.from(dbLookup.entries())) {
      const dn = k.split("|")[0];
      if (dn === sn || (sn.length > 3 && dn.includes(sn)) || (dn.length > 3 && sn.includes(dn))) {
        db = v;
        break;
      }
    }

    if (!db) { notFound++; continue; }

    const goals = goalsByPlayer.get(sn) ?? goalsByPlayer.get(norm(db.name)) ?? 0;

    // Check if already added (dedup)
    if (toInject.some(t => t.playerId === db!.id)) continue;

    toInject.push({
      playerId: db.id,
      name: db.name,
      rating: note.rating,
      goals,
      passes: 0, // TODO: from text parsing or API
    });
    matched++;
  }

  console.log(`\n=== MATCHING ===`);
  console.log(`  Matched: ${matched}`);
  console.log(`  Not in roster: ${notFound}`);
  console.log(`  Goals from Sportmonks: ${Array.from(goalsByPlayer.values()).reduce((a, b) => a + b, 0)}`);
  console.log(`  Red cards: ${redCards.size}`);

  console.log(`\n=== TO INJECT (${toInject.length} scores) ===`);
  toInject.forEach(s => {
    const extras = [];
    if (s.goals > 0) extras.push(`${s.goals}g`);
    console.log(`  ${s.name.padEnd(28)} ${s.rating}${extras.length ? " [" + extras.join(",") + "]" : ""}`);
  });

  if (dryRun) {
    console.log(`\n--- DRY RUN ---`);
  } else {
    console.log(`\nInjecting ${toInject.length} scores...`);
    for (const s of toInject) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO SCORE (ID_PLAYER, DAY, USED, POINTS, GOALS, PASSES)
         VALUES (?, ?, 1, ?, ?, ?)
         ON DUPLICATE KEY UPDATE USED=1, POINTS=VALUES(POINTS), GOALS=VALUES(GOALS), PASSES=VALUES(PASSES)`,
        s.playerId, matchday, s.rating, s.goals, s.passes
      );
    }
    console.log(`Done!`);
  }

  return toInject;
}

// ── Main ─────────────────────────────────────────────────
async function main() {
  const matchday = parseInt(process.argv[2] ?? "0");
  const dryRun = process.argv.includes("--dry-run");
  if (!matchday) { console.log("Usage: npx tsx scripts/process-matchday.ts <matchday> [--dry-run]"); process.exit(0); }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`PROCESSING MATCHDAY ${matchday}${dryRun ? " (DRY RUN)" : ""}`);
  console.log(`${"=".repeat(50)}`);

  // Step 1: Match info
  console.log("\n📅 Step 1: Match info from TheSportsDB...");
  const matches = await getMatchday(matchday);
  matches.forEach(m => {
    const score = m.homeScore !== null ? `${m.homeScore}-${m.awayScore}` : "TBD";
    console.log(`  ${m.homeTeam} ${score} ${m.awayTeam}`);
  });

  // Step 2: Find articles + extract notes
  console.log("\n📰 Step 2: L'Équipe articles + infographic OCR...");
  if (!fs.existsSync(PROFILE)) fs.mkdirSync(PROFILE, { recursive: true });
  const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: 1440, height: 900 } });

  const articleUrls = await findArticleUrls(ctx, matches);
  console.log(`  Found ${articleUrls.size}/${matches.filter(m => m.homeScore !== null).length} articles`);

  const notes = await extractNotesFromArticles(ctx, articleUrls);
  await ctx.close();
  console.log(`  Total: ${notes.length} notes extracted`);

  // Step 3: Events from Sportmonks
  console.log("\n⚽ Step 3: Goals + cards from Sportmonks...");
  const events = await getSportmonksEvents(matchday);
  const goals = events.filter(e => e.type === "goal");
  const reds = events.filter(e => e.type === "red_card");
  console.log(`  ${goals.length} goals, ${reds.length} red cards`);
  goals.forEach(g => console.log(`    ⚽ ${g.minute}' ${g.playerName}`));
  reds.forEach(r => console.log(`    🟥 ${r.minute}' ${r.playerName}`));

  // Step 4: Inject
  console.log("\n💾 Step 4: Inject into DB...");
  await injectScores(matchday, notes, events, dryRun);

  await prisma.$disconnect();
}

main().catch(console.error);
