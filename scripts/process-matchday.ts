/**
 * Full matchday processing pipeline (no paid API required).
 *
 * Usage: npx tsx scripts/process-matchday.ts 26 [--dry-run]
 *
 * Pipeline:
 *   1. TheSportsDB → match dates + scores (free)
 *   2. L'Équipe web articles → infographic OCR via Gemini (notes)
 *   3. L'Équipe web articles → text parsing (goals, assists, red cards, CSC, pen saved)
 *   4. Inject into DB SCORE table
 */

import { PrismaClient } from "@prisma/client";
import { resolveSeasonKey } from "./lib/season";
import { chromium } from "playwright";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { getMatchday } from "./lib/sportsdb";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const prisma = new PrismaClient();
const PROFILE = path.join(__dirname, "..", "tmp/lequipe-profile");
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
  "Reims": "REIMS", "SDR": "REIMS",
  "Montpellier": "MONTPELLIER", "MHSC": "MONTPELLIER",
  "Saint-Étienne": "SAINT-ETIENNE", "ASSE": "SAINT-ETIENNE", "St Etienne": "SAINT-ETIENNE",
};

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[- ']/g, "");
}

// ── Types ────────────────────────────────────────────────
interface PlayerNote {
  playerName: string;
  rating: number;
  match: string;
}

interface PlayerEvents {
  playerName: string;
  club: string;
  goals: number;
  assists: number;
  redCard: boolean;
  ownGoals: number;
  penaltySaved: number;
  match: string;
}

// ── Step 1: Get article URLs from L'Équipe ───────────────
async function findArticleUrls(
  ctx: Awaited<ReturnType<typeof chromium.launchPersistentContext>>,
  matches: Awaited<ReturnType<typeof getMatchday>>,
  matchday: number
): Promise<Map<string, string>> {
  const page = ctx.pages()[0] || await ctx.newPage();
  const matchToUrl = new Map<string, string>();

  // First: check MATCH_SCHEDULE for stored article URLs
  const storedUrls = await prisma.$queryRawUnsafe<{ home_team: string; away_team: string; infographic_url: string }[]>(
    "SELECT home_team, away_team, infographic_url FROM MATCH_SCHEDULE WHERE matchday = ? AND infographic_url IS NOT NULL",
    matchday
  );
  for (const s of storedUrls) {
    const match = matches.find((m) => m.homeTeam === s.home_team);
    if (match && match.homeScore !== null) {
      const label = `${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}`;
      matchToUrl.set(label, s.infographic_url);
    }
  }

  if (matchToUrl.size === matches.filter((m) => m.homeScore !== null).length) {
    console.log(`  All ${matchToUrl.size} URLs found in DB`);
    return matchToUrl;
  }

  // Fallback: browse L1 page to find missing articles
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
    if (matchToUrl.has(label)) continue;

    const homeFrags = [match.homeTeam.split(" ").pop()!.toLowerCase()];
    const awayFrags = [match.awayTeam.split(" ").pop()!.toLowerCase()];

    const found = allLinks.find(l =>
      homeFrags.some(h => l.href.toLowerCase().includes(h)) ||
      awayFrags.some(a => l.href.toLowerCase().includes(a))
    );
    if (found) {
      matchToUrl.set(label, found.href);
    } else {
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

// ── Step 2: Extract notes (OCR) + events (text) from articles ──
async function extractFromArticles(
  ctx: Awaited<ReturnType<typeof chromium.launchPersistentContext>>,
  matchToUrl: Map<string, string>
): Promise<{ notes: PlayerNote[]; events: PlayerEvents[] }> {
  const page = ctx.pages()[0] || await ctx.newPage();
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const allNotes: PlayerNote[] = [];
  const allEvents: PlayerEvents[] = [];

  for (const [match, url] of Array.from(matchToUrl.entries())) {
    console.log(`\n📰 ${match}`);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    try { await page.click('text="oui, j\'accepte"', { timeout: 2000 }); } catch {}
    for (let i = 0; i < 15; i++) { await page.evaluate(s => window.scrollTo(0, s * 600), i); await page.waitForTimeout(200); }

    // ── 2a: OCR infographic for ratings ──
    const imgSrc = await page.evaluate(() => {
      for (const img of document.querySelectorAll("img")) {
        const alt = (img.alt || "").toLowerCase();
        if (alt.includes("note") || alt.includes("infographie")) return img.src;
      }
      return null;
    });

    // Get article text (needed for both formats)
    const bodyText = await page.evaluate(() => document.body.innerText);
    const isPaywalled = bodyText.includes("réservée à nos abonnés");

    if (imgSrc) {
      // ── Format A: Infographic OCR ──
      const imgBuffer = await page.evaluate(async (src) => {
        const res = await fetch(src);
        const buf = await res.arrayBuffer();
        return Array.from(new Uint8Array(buf));
      }, imgSrc);

      const base64 = Buffer.from(imgBuffer).toString("base64");
      console.log(`  📷 ${Math.round(imgBuffer.length / 1024)} KB`);

      try {
        const result = await model.generateContent([
          { inlineData: { mimeType: "image/jpeg", data: base64 } },
          { text: 'Extrais les notes de joueurs de football. Les notes sont des chiffres dans des cercles colorés. Retourne un JSON: [{"playerName":"nom","rating":N}]. Chaque joueur a sa propre note. Retourne UNIQUEMENT le JSON.' },
        ]);
        const text = result.response.text();
        const start = text.indexOf("[");
        const end = text.lastIndexOf("]");
        if (start >= 0 && end > start) {
          const ratings = JSON.parse(text.slice(start, end + 1));
          console.log(`  ✅ ${ratings.length} notes (OCR)`);
          ratings.forEach((r: { playerName: string; rating: number }) =>
            allNotes.push({ ...r, match })
          );
        }
      } catch (err) {
        console.log(`  ❌ OCR error: ${err}`);
      }
      await new Promise(r => setTimeout(r, 4500)); // rate limit
    } else if (!isPaywalled) {
      // ── Format B: Text parsing (name / rating / description lines) ──
      const textNotes = parseNotesFromTextFormat(bodyText, match);
      if (textNotes.length > 0) {
        console.log(`  ✅ ${textNotes.length} notes (texte)`);
        allNotes.push(...textNotes);
      } else {
        console.log("  ❌ No infographic + no text ratings found");
      }
    } else {
      console.log("  ❌ Paywalled — no data");
    }

    // ── Events from text (goals, assists, cards) — works with both formats ──
    if (!isPaywalled) {
      const textEvents = parseEventsFromText(bodyText, match);
      // Also parse events from format B descriptions
      const textEventsB = parseEventsFromTextFormatB(bodyText, match);
      const combined = [...textEvents, ...textEventsB];
      // Dedup by player name
      const seen = new Set<string>();
      const deduped = combined.filter(e => {
        const key = norm(e.playerName);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (deduped.length > 0) {
        console.log(`  📝 ${deduped.length} joueurs avec events (texte)`);
        deduped.forEach(e => {
          const extras = [];
          if (e.goals > 0) extras.push(`${e.goals}g`);
          if (e.assists > 0) extras.push(`${e.assists}a`);
          if (e.redCard) extras.push("🟥");
          if (e.ownGoals > 0) extras.push(`${e.ownGoals}csc`);
          if (e.penaltySaved > 0) extras.push(`${e.penaltySaved}pen`);
          if (extras.length > 0) console.log(`    ${e.playerName}: [${extras.join(",")}]`);
        });
        allEvents.push(...deduped);
      }
    }
  }

  return { notes: allNotes, events: allEvents };
}

// ── Parse notes from text format B (name / rating / description lines) ──
function parseNotesFromTextFormat(text: string, matchLabel: string): PlayerNote[] {
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  const notes: PlayerNote[] = [];
  const seen = new Set<string>();

  // Find "la note moyenne" marker to know where ratings start
  let startIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes("la note moyenne")) { startIdx = i; break; }
  }

  for (let i = startIdx; i < lines.length - 1; i++) {
    const name = lines[i];
    const nextLine = lines[i + 1];

    // Name: 1-3 words, starts with uppercase, no digits, reasonable length
    if (name.length < 3 || name.length > 25 || !/^[A-ZÀ-Ü]/.test(name) || /^\d/.test(name)) continue;
    // Skip common non-name lines
    if (/^(Lyon|Monaco|Marseille|Lille|Nice|PSG|Rennes|Metz|Lens|Toulouse|Nantes|Brest|Auxerre|Strasbourg|Angers|Le Havre|Paris FC|Lorient|Reims|Montpellier|Saint-Étienne)$/i.test(name)) continue;
    if (/l'entraîneur|coach|moyenne|partager|commenter/i.test(name)) continue;

    // Rating: single number 1-10
    if (/^[1-9]$|^10$/.test(nextLine)) {
      // Clean name: remove trailing "l'entraîneur" etc.
      const cleanName = name.replace(/l'entraîneur.*$/i, "").trim();
      if (cleanName.length < 2) continue;

      // Skip if already seen (dedup first occurrence vs summary at bottom)
      const key = norm(cleanName);
      if (seen.has(key)) continue;
      seen.add(key);

      notes.push({ playerName: cleanName, rating: parseInt(nextLine), match: matchLabel });
    }
  }

  return notes;
}

// ── Parse events from text format B (name / rating / description) ──
function parseEventsFromTextFormatB(text: string, matchLabel: string): PlayerEvents[] {
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  const events: PlayerEvents[] = [];

  let startIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes("la note moyenne")) { startIdx = i; break; }
  }

  for (let i = startIdx; i < lines.length - 2; i++) {
    const name = lines[i];
    const nextLine = lines[i + 1];

    if (name.length < 3 || name.length > 25 || !/^[A-ZÀ-Ü]/.test(name) || /^\d/.test(name)) continue;
    if (!/^[1-9]$|^10$/.test(nextLine)) continue;

    const cleanName = name.replace(/l'entraîneur.*$/i, "").trim();
    if (cleanName.length < 2) continue;

    // Get description (line after rating)
    const desc = (i + 2 < lines.length && lines[i + 2].length > 30) ? lines[i + 2] : "";
    if (!desc) continue;

    // Parse goals
    let goalCount = 0;
    if (desc.match(/tripl[ée]/i) && !desc.match(/tripl[ée]\s+de\s+passe/i)) goalCount = 3;
    else if (desc.match(/doubl[ée]/i) && !desc.match(/doubl[ée]\s+de\s+passe/i)) goalCount = 2;
    else if (desc.match(/\ba marqu[ée]\b|\ba inscrit\b|\bauteur d'un but\b|\bson (?:premier |second )?but\b/i) && !desc.match(/n'a pas marqu/i)) goalCount = 1;
    if (desc.match(/couronn[ée]e? par un but|r[ée]compens[ée]e? par un but/i) && goalCount === 0) goalCount = 1;
    if (desc.match(/sur le.*but|premier but adverse|encaiss[ée]|fautif sur le but/i)) goalCount = 0;

    // Parse assists
    let assistCount = 0;
    if (desc.match(/deux\s+passe|doubl[ée]\s+de\s+passe/i)) assistCount = 2;
    else if (desc.match(/passe[s]?\s+d[ée]cisive/i)) assistCount = 1;
    if (desc.match(/\bpasseur\b|à l'origine du but|service pour/i) && assistCount === 0) assistCount = 1;

    const redCard = !!desc.match(/\bexpuls[ée]\b|\bcarton rouge\b|\bexclu\b|\brouge directe?\b|\bsecond (?:carton )?jaune\b/i);
    let ownGoals = 0;
    if (desc.match(/\bcsc\b|\bcontre son camp\b/i)) ownGoals = 1;
    let penaltySaved = 0;
    if (desc.match(/\barr[êe]t[ée]? (?:un |le )?p[ée]nalty\b/i)) penaltySaved = 1;

    if (goalCount > 0 || assistCount > 0 || redCard || ownGoals > 0 || penaltySaved > 0) {
      events.push({ playerName: cleanName, club: "", goals: goalCount, assists: assistCount, redCard, ownGoals, penaltySaved, match: matchLabel });
    }
  }

  return events;
}

// ── Parse events from article text (format A: "Nom (Club) : N") ──
function parseEventsFromText(text: string, matchLabel: string): PlayerEvents[] {
  const lines = text.split("\n");
  const events: PlayerEvents[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Match: "Prénom Nom (Club) : N"
    const m = line.match(/^(.+?)\s*\(([^)]+)\)\s*:\s*(\d+)\s*$/);
    if (!m || Number(m[3]) > 10 || m[1].trim().length <= 2) continue;

    // Get description (next paragraph after the rating line)
    let desc = "";
    for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
      const next = lines[j].trim();
      if (next.length > 40 && !next.match(/\([^)]+\)\s*:\s*\d+$/)) {
        desc = next;
        break;
      }
    }
    if (!desc) continue;

    const playerName = m[1].trim();
    const club = m[2].trim();

    // ── Goals ──
    let goalCount = 0;
    if (desc.match(/tripl[ée]/i) && !desc.match(/tripl[ée]\s+de\s+passe/i)) goalCount = 3;
    else if (desc.match(/doubl[ée]/i) && !desc.match(/doubl[ée]\s+de\s+passe/i)) goalCount = 2;
    else if (desc.match(/\ba marqu[ée]\b|\ba inscrit\b|\bauteur d'un but\b|\bson (?:premier |second |deuxième )?but\b/i) && !desc.match(/n'a pas marqu/i)) goalCount = 1;
    const goalMinute = desc.match(/but[^.]*?\((\d+e(?:\+\d+)?)\)/i);
    if (goalMinute && !desc.match(/sur le.*but|premier but adverse|encaiss|fautif sur|débordé sur/i)) {
      if (goalCount === 0) goalCount = 1;
    }
    if (desc.match(/couronn[ée]e? par un but|r[ée]compens[ée]e? par un but/i)) {
      if (goalCount === 0) goalCount = 1;
    }
    // Cancel if description is about conceding
    if (desc.match(/sur le.*but|premier but adverse|encaiss[ée]|fautif sur le but|débordé sur le|d[ée]pos[ée] sur le|passif sur|sur les.*buts/i)) {
      goalCount = 0;
    }

    // ── Assists ──
    let assistCount = 0;
    if (desc.match(/deux\s+passe|doubl[ée]\s+de\s+passe/i)) assistCount = 2;
    else if (desc.match(/passe[s]?\s+d[ée]cisive/i)) assistCount = 1;
    if (desc.match(/\bpasseur\b|à l'origine du but|service pour/i) && assistCount === 0) assistCount = 1;

    // ── Red cards ──
    const redCard = !!desc.match(
      /\bexpuls[ée]\b|\bcarton rouge\b|\bexclu\b|\brouge directe?\b|\brenvoy[ée] aux vestiaires\b|\bsecond (?:carton )?jaune\b|\bdeux(?:ième)? (?:carton )?jaune\b/i
    );

    // ── Own goals (CSC) ──
    let ownGoals = 0;
    if (desc.match(/\bcsc\b|\bcontre son camp\b|\bautogoal\b|\bbut contre son camp\b/i)) ownGoals = 1;

    // ── Penalty saved (goalkeepers) ──
    let penaltySaved = 0;
    if (desc.match(/\barr[êe]t[ée]? (?:un |le )?p[ée]nalty\b|\bp[ée]nalty (?:repouss|arr[êe]t|stopp)\b|\ba stopp[ée] (?:un |le )?p[ée]nalty\b|\brepouss[ée] (?:un |le )?p[ée]nalty\b/i)) penaltySaved = 1;

    events.push({
      playerName,
      club,
      goals: goalCount,
      assists: assistCount,
      redCard,
      ownGoals,
      penaltySaved,
      match: matchLabel,
    });
  }

  return events;
}

// ── Step 3: Match to DB + inject ─────────────────────────
async function injectScores(
  matchday: number,
  notes: PlayerNote[],
  events: PlayerEvents[],
  dryRun: boolean
) {
  const players = await prisma.player.findMany();
  const clubs = await prisma.club.findMany();
  const clubIdToName = new Map(clubs.map(c => [c.id, c.name]));

  // Build lookup: norm(name)|clubName → player
  const dbLookup = new Map<string, { id: number; name: string; clubName: string }>();
  players.forEach(pl => {
    const clubName = clubIdToName.get(pl.clubId) ?? "";
    [norm(pl.lname), norm(pl.fname + pl.lname), norm(pl.fname)].forEach(k => {
      dbLookup.set(k + "|" + clubName, { id: pl.id, name: `${pl.fname} ${pl.lname}`.trim(), clubName });
    });
  });

  // Build events lookup by normalized player name
  const eventsByName = new Map<string, PlayerEvents>();
  for (const e of events) {
    eventsByName.set(norm(e.playerName), e);
  }

  // Match notes to DB players
  const toInject: {
    playerId: number; name: string; rating: number;
    goals: number; passes: number; redCard: number; ownGoals: number; penaltySaved: number;
  }[] = [];
  let matched = 0, notFound = 0;

  for (const note of notes) {
    const sn = norm(note.playerName);

    // Find in DB
    let db: { id: number; name: string; clubName: string } | undefined;
    for (const [k, v] of Array.from(dbLookup.entries())) {
      const dn = k.split("|")[0];
      if (dn === sn || (sn.length > 3 && dn.includes(sn)) || (dn.length > 3 && sn.includes(dn))) {
        db = v;
        break;
      }
    }

    if (!db) { notFound++; continue; }
    if (toInject.some(t => t.playerId === db!.id)) continue;

    // Find events for this player
    const ev = eventsByName.get(sn) ?? eventsByName.get(norm(db.name));

    toInject.push({
      playerId: db.id,
      name: db.name,
      rating: note.rating,
      goals: ev?.goals ?? 0,
      passes: ev?.assists ?? 0,
      redCard: ev?.redCard ? 1 : 0,
      ownGoals: ev?.ownGoals ?? 0,
      penaltySaved: ev?.penaltySaved ?? 0,
    });
    matched++;
  }

  console.log(`\n=== MATCHING ===`);
  console.log(`  Matched: ${matched}`);
  console.log(`  Not in roster: ${notFound}`);

  const totalGoals = toInject.reduce((a, s) => a + s.goals, 0);
  const totalAssists = toInject.reduce((a, s) => a + s.passes, 0);
  const totalReds = toInject.filter(s => s.redCard).length;
  const totalCSC = toInject.reduce((a, s) => a + s.ownGoals, 0);
  const totalPen = toInject.reduce((a, s) => a + s.penaltySaved, 0);
  console.log(`  Goals: ${totalGoals} | Assists: ${totalAssists} | Red cards: ${totalReds} | CSC: ${totalCSC} | Pen saved: ${totalPen}`);

  console.log(`\n=== TO INJECT (${toInject.length} scores) ===`);
  toInject.forEach(s => {
    const extras = [];
    if (s.goals > 0) extras.push(`${s.goals}g`);
    if (s.passes > 0) extras.push(`${s.passes}a`);
    if (s.redCard) extras.push("🟥");
    if (s.ownGoals > 0) extras.push(`${s.ownGoals}csc`);
    if (s.penaltySaved > 0) extras.push(`${s.penaltySaved}pen`);
    console.log(`  ${s.name.padEnd(28)} ${s.rating}${extras.length ? " [" + extras.join(",") + "]" : ""}`);
  });

  if (dryRun) {
    console.log(`\n--- DRY RUN ---`);
  } else {
    console.log(`\nInjecting ${toInject.length} scores...`);
    for (const s of toInject) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO SCORE (ID_PLAYER, DAY, USED, POINTS, GOALS, PASSES, RED_CARD, OWN_GOALS, PENALTY_SAVED)
         VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE USED=1, POINTS=VALUES(POINTS), GOALS=VALUES(GOALS), PASSES=VALUES(PASSES),
           RED_CARD=VALUES(RED_CARD), OWN_GOALS=VALUES(OWN_GOALS), PENALTY_SAVED=VALUES(PENALTY_SAVED)`,
        s.playerId, matchday, s.rating, s.goals, s.passes, s.redCard, s.ownGoals, s.penaltySaved
      );
    }
    console.log(`Done!`);
  }

  // Save JSON backup
  const outputFile = path.join(__dirname, "..", `tmp/matchday-${matchday}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(toInject, null, 2));
  console.log(`Saved to ${outputFile}`);

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
  const matches = await getMatchday(matchday, await resolveSeasonKey(prisma));
  matches.forEach(m => {
    const score = m.homeScore !== null ? `${m.homeScore}-${m.awayScore}` : "TBD";
    console.log(`  ${m.homeTeam} ${score} ${m.awayTeam}`);
  });

  // Step 2: Find articles + extract notes & events
  console.log("\n📰 Step 2: L'Équipe articles (OCR notes + text events)...");
  if (!fs.existsSync(PROFILE)) fs.mkdirSync(PROFILE, { recursive: true });
  const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: 1440, height: 900 } });

  const articleUrls = await findArticleUrls(ctx, matches, matchday);
  console.log(`  Found ${articleUrls.size}/${matches.filter(m => m.homeScore !== null).length} articles`);

  const { notes, events } = await extractFromArticles(ctx, articleUrls);
  await ctx.close();
  console.log(`\n  Total: ${notes.length} notes, ${events.length} players with text data`);

  // Step 3: Inject
  console.log("\n💾 Step 3: Inject into DB...");
  await injectScores(matchday, notes, events, dryRun);

  await prisma.$disconnect();
}

main().catch(console.error);
