/**
 * Scrape L'Équipe website articles for player ratings (text-based, not OCR).
 * Much more reliable than kiosque/Vision approach.
 *
 * Usage:
 *   npx tsx scripts/scrape-notes-web.ts 26    # scrape all J26 note articles
 *
 * Flow:
 *   1. Get match list from TheSportsDB
 *   2. Search lequipe.fr for "notes" articles for each match
 *   3. Parse text: "Joueur (Club) : N" format
 *   4. Extract goals/assists from descriptions
 *   5. Output combined JSON
 */

import { chromium, type BrowserContext } from "playwright";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { getMatchday } from "./lib/sportsdb";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const COOKIES_FILE = path.join(__dirname, "cookies-lequipe.json");
const BROWSER_PROFILE = path.join(__dirname, "..", "tmp/lequipe-profile");

interface Rating {
  playerName: string;
  club: string;
  rating: number;
  goals: number;
  assists: number;
  redCard: boolean;
  ownGoals: number;
  penaltySaved: number;
  match: string;
}

// ── Parse ratings from article text ───────────────────────
function parseRatingsFromText(text: string, matchLabel: string): Rating[] {
  const lines = text.split("\n");
  const ratings: Rating[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Match: "Prénom Nom (Club) : N" or with spaces
    const match = line.match(/^(.+?)\s*\(([^)]+)\)\s*:\s*(\d+)\s*$/);
    if (match && Number(match[3]) <= 10 && match[1].trim().length > 2) {
      // Get description text (next long paragraph)
      let desc = "";
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        const next = lines[j].trim();
        if (next.length > 40 && !next.match(/\([^)]+\)\s*:\s*\d+$/)) {
          desc = next;
          break;
        }
      }

      // Parse goals — look for explicit scoring language
      let goalCount = 0;
      // "doublé" / "triplé" = 2/3 goals by this player
      if (desc.match(/tripl[ée]/i) && !desc.match(/tripl[ée]\s+de\s+passe/i)) goalCount = 3;
      else if (desc.match(/doubl[ée]/i) && !desc.match(/doubl[ée]\s+de\s+passe/i)) goalCount = 2;
      // Explicit: "a marqué", "son but", "auteur d'un but", "inscrit un but", "a inscrit"
      else if (desc.match(/\ba marqu[ée]\b|\ba inscrit\b|\bauteur d'un but\b|\bson (?:premier |second |deuxième )?but\b/i) && !desc.match(/n'a pas marqu/i)) goalCount = 1;
      // Goal with minute: "but (Xe)" pattern — but only if the player is the scorer
      const goalMinute = desc.match(/but[^.]*?\((\d+e(?:\+\d+)?)\)/i);
      if (goalMinute && !desc.match(/sur le.*but|premier but adverse|encaiss|fautif sur|débordé sur/i)) {
        if (goalCount === 0) goalCount = 1;
      }
      // "couronnée par un but" / "récompensé par un but"
      if (desc.match(/couronn[ée]e? par un but|r[ée]compens[ée]e? par un but/i)) {
        if (goalCount === 0) goalCount = 1;
      }

      // NEGATIVE: descriptions about conceding/being beaten — cancel any detected goal
      if (desc.match(/sur le.*but|premier but adverse|encaiss[ée]|fautif sur le but|débordé sur le|d[ée]pos[ée] sur le|passif sur|sur les.*buts/i)) {
        goalCount = 0;
      }

      // Parse assists
      let assistCount = 0;
      if (desc.match(/deux\s+passe|doubl[ée]\s+de\s+passe/i)) assistCount = 2;
      else if (desc.match(/passe[s]?\s+d[ée]cisive/i)) assistCount = 1;
      if (desc.match(/\bpasseur\b|à l'origine du but|service pour/i) && assistCount === 0) assistCount = 1;

      // Red cards
      const redCard = !!desc.match(
        /\bexpuls[ée]\b|\bcarton rouge\b|\bexclu\b|\brouge directe?\b|\brenvoy[ée] aux vestiaires\b|\bsecond (?:carton )?jaune\b|\bdeux(?:ième)? (?:carton )?jaune\b/i
      );

      // Own goals (CSC)
      let ownGoals = 0;
      if (desc.match(/\bcsc\b|\bcontre son camp\b|\bautogoal\b|\bbut contre son camp\b/i)) ownGoals = 1;

      // Penalty saved (goalkeepers)
      let penaltySaved = 0;
      if (desc.match(/\barr[êe]t[ée]? (?:un |le )?p[ée]nalty\b|\bp[ée]nalty (?:repouss|arr[êe]t|stopp)\b|\ba stopp[ée] (?:un |le )?p[ée]nalty\b|\brepouss[ée] (?:un |le )?p[ée]nalty\b/i)) penaltySaved = 1;

      ratings.push({
        playerName: match[1].trim(),
        club: match[2].trim(),
        rating: Number(match[3]),
        goals: goalCount,
        assists: assistCount,
        redCard,
        ownGoals,
        penaltySaved,
        match: matchLabel,
      });
    }
  }

  return ratings;
}

// ── Search for note articles on lequipe.fr ────────────────
async function findNoteArticles(
  context: BrowserContext,
  homeTeam: string,
  awayTeam: string
): Promise<string[]> {
  const page = await context.newPage();
  const urls: string[] = [];

  // Alternative names for L'Équipe search
  const ALT_NAMES: Record<string, string[]> = {
    "Marseille": ["OM", "Marseille", "om"],
    "Olympique Marseille": ["OM", "Marseille"],
    "Paris SG": ["PSG", "Paris SG", "paris"],
    "Paris Saint Germain": ["PSG", "Paris SG"],
    "Olympique Lyonnais": ["OL", "Lyon", "ol"],
    "Le Havre": ["HAC", "Le Havre", "le-havre"],
    "Monaco": ["ASM", "Monaco"],
    "LOSC Lille": ["Lille", "LOSC"],
    "Lorient": ["FCL", "Lorient"],
    "Paris": ["PFC", "Paris FC", "pfc"],
    "Nantes": ["FCN", "Nantes"],
    "Strasbourg": ["RCSA", "Strasbourg", "Racing", "RC Strasbourg"],
    "Rennes": ["SRFC", "Rennes", "Stade Rennais"],
    "Lens": ["RCL", "Lens", "RC Lens"],
    "Brest": ["SB29", "Brest", "Stade Brestois"],
    "Nice": ["OGCN", "Nice", "OGC Nice"],
    "Angers": ["SCO", "Angers"],
    "Auxerre": ["AJA", "Auxerre"],
    "Metz": ["FCM", "Metz", "FC Metz"],
    "Toulouse": ["TFC", "Toulouse"],
  };

  const homeNames = ALT_NAMES[homeTeam] ?? [homeTeam];
  const awayNames = ALT_NAMES[awayTeam] ?? [awayTeam];

  try {
    // Search with multiple name variants
    // Max 3 search terms to avoid rate limiting
    const searchTerms: string[] = [];
    // Term 1: first alt names (usually the common abbreviation)
    searchTerms.push(`notes ${homeNames[0]} ${awayNames[0]}`);
    // Term 2: original names from API
    if (homeNames[0] !== homeTeam || awayNames[0] !== awayTeam) {
      searchTerms.push(`notes ${homeTeam} ${awayTeam}`);
    }
    // Term 3: hyphenated (URL format used by L'Équipe)
    const hShort = homeNames[0].toLowerCase();
    const aShort = awayNames[0].toLowerCase();
    searchTerms.push(`notes ${hShort}-${aShort}`);

    for (const term of searchTerms) {
      const searchUrl = `https://www.lequipe.fr/recherche?q=${encodeURIComponent(term)}&type=article`;
      await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);

      // Accept cookies
      try { await page.click('text="oui, j\'accepte"', { timeout: 2000 }); } catch {}

      // Find article links containing "notes" — only recent ones
      const links = await page.evaluate(() => {
        const results: string[] = [];
        document.querySelectorAll("a[href]").forEach((a) => {
          const href = (a as HTMLAnchorElement).href;
          const text = (a as HTMLElement).textContent?.toLowerCase() ?? "";
          if (
            href.includes("/Football/Article/") &&
            href.toLowerCase().includes("note") &&
            (text.includes("note") || text.includes("notation"))
          ) {
            // Filter by article ID — higher ID = more recent
            const idMatch = href.match(/\/(\d+)$/);
            if (idMatch && parseInt(idMatch[1]) > 1650000) { // recent articles only
              results.push(href);
            }
          }
        });
        return [...new Set(results)];
      });

      urls.push(...links);
      if (urls.length > 0) break; // Found some, no need to try other search terms
    }
  } catch (err) {
    console.error(`  Search error for ${homeTeam}-${awayTeam}:`, err);
  }

  await page.close();
  return [...new Set(urls)];
}

// ── Scrape a single article ───────────────────────────────
async function scrapeArticle(
  context: BrowserContext,
  url: string,
  matchLabel: string
): Promise<Rating[]> {
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);

    // Accept cookies
    try { await page.click('text="oui, j\'accepte"', { timeout: 2000 }); } catch {}

    // Scroll to load content
    for (let i = 0; i < 10; i++) {
      await page.evaluate((s) => window.scrollTo(0, s * 800), i);
      await page.waitForTimeout(200);
    }

    const text = await page.evaluate(() => document.body.innerText);

    if (text.includes("réservée à nos abonnés")) {
      console.log("    PAYWALLED — skipping");
      await page.close();
      return [];
    }

    const ratings = parseRatingsFromText(text, matchLabel);
    await page.close();
    return ratings;
  } catch (err) {
    console.error("    Scrape error:", err);
    await page.close();
    return [];
  }
}

// ── Browse L'Équipe L1 page for note articles ────────────
async function browseLigue1Page(
  context: BrowserContext,
  homeTeam: string,
  awayTeam: string
): Promise<string[]> {
  const page = await context.newPage();
  const urls: string[] = [];

  try {
    await page.goto("https://www.lequipe.fr/Football/Ligue-1/", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3000);
    try { await page.click('text="oui, j\'accepte"', { timeout: 2000 }); } catch {}

    // Scroll to load more articles
    for (let i = 0; i < 5; i++) {
      await page.evaluate((s) => window.scrollTo(0, s * 1000), i + 1);
      await page.waitForTimeout(500);
    }

    // Find links containing "note" + team names
    // Build all possible name fragments to search in URLs
    const ALT_NAMES: Record<string, string[]> = {
      "Marseille": ["om", "marseille"], "Olympique Marseille": ["om", "marseille"],
      "Paris SG": ["psg"], "Paris Saint Germain": ["psg"],
      "Olympique Lyonnais": ["ol", "lyon"], "Le Havre": ["havre", "hac"],
      "Monaco": ["monaco"], "LOSC Lille": ["lille"], "Lorient": ["lorient"],
      "Paris": ["pfc", "paris-fc"], "Nantes": ["nantes"],
      "Strasbourg": ["strasbourg", "racing"], "Rennes": ["rennes"],
      "Lens": ["lens"], "Brest": ["brest"], "Nice": ["nice"],
      "Angers": ["angers"], "Auxerre": ["auxerre"], "Metz": ["metz"],
      "Toulouse": ["toulouse"],
    };
    const homeFrags = ALT_NAMES[homeTeam] ?? [homeTeam.split(" ").pop()!.toLowerCase()];
    const awayFrags = ALT_NAMES[awayTeam] ?? [awayTeam.split(" ").pop()!.toLowerCase()];

    const links = await page.evaluate(
      ({ hFrags, aFrags }: { hFrags: string[]; aFrags: string[] }) => {
        const results: string[] = [];
        document.querySelectorAll("a[href]").forEach((el) => {
          const href = (el as HTMLAnchorElement).href.toLowerCase();
          if (
            href.includes("/football/article/") &&
            href.includes("note") &&
            (hFrags.some((h) => href.includes(h)) || aFrags.some((a) => href.includes(a)))
          ) {
            results.push((el as HTMLAnchorElement).href);
          }
        });
        return [...new Set(results)];
      },
      { hFrags: homeFrags, aFrags: awayFrags }
    );

    urls.push(...links);
  } catch {
    // silent
  }

  await page.close();
  return urls;
}

// ── Main ──────────────────────────────────────────────────
async function main() {
  const matchday = parseInt(process.argv[2] ?? "0");
  if (!matchday) {
    console.log("Usage: npx tsx scripts/scrape-notes-web.ts <matchday>");
    process.exit(0);
  }

  console.log(`\nScraping L'Équipe web articles for J${matchday}\n`);

  // 1. Get matches from TheSportsDB
  const matches = await getMatchday(matchday);
  console.log(`${matches.length} matches from TheSportsDB:`);
  matches.forEach((m) => {
    const score = m.homeScore !== null ? `${m.homeScore}-${m.awayScore}` : "TBD";
    console.log(`  ${m.homeTeam} ${score} ${m.awayTeam}`);
  });

  // 2. Launch browser with persistent context
  if (!fs.existsSync(BROWSER_PROFILE)) {
    fs.mkdirSync(BROWSER_PROFILE, { recursive: true });
  }

  const context = await chromium.launchPersistentContext(BROWSER_PROFILE, {
    headless: true,
    viewport: { width: 1440, height: 900 },
  });

  // Load cookies if persistent context is fresh
  const page = context.pages()[0] || await context.newPage();
  await page.goto("https://www.lequipe.fr", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.close();

  // 3. For each match, find and scrape note articles
  const allRatings: Rating[] = [];

  for (const match of matches) {
    if (match.homeScore === null) {
      console.log(`\n⏭  ${match.homeTeam} vs ${match.awayTeam} — postponed, skipping`);
      continue;
    }

    const matchLabel = `${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}`;
    console.log(`\n🔍 ${matchLabel}`);

    // Search for note articles
    const articleUrls = await findNoteArticles(context, match.homeTeam, match.awayTeam);
    console.log(`  Found ${articleUrls.length} article(s)`);

    for (const url of articleUrls.slice(0, 2)) { // max 2 articles per match
      const shortUrl = url.split("/").slice(-2).join("/");
      console.log(`  📰 ${shortUrl}`);

      const ratings = await scrapeArticle(context, url, matchLabel);
      console.log(`    ${ratings.length} ratings extracted`);

      ratings.forEach((r) => {
        const extras = [];
        if (r.goals > 0) extras.push(`${r.goals}g`);
        if (r.assists > 0) extras.push(`${r.assists}a`);
        if (r.redCard) extras.push("🟥");
        if (r.ownGoals > 0) extras.push(`${r.ownGoals}csc`);
        if (r.penaltySaved > 0) extras.push(`${r.penaltySaved}pen`);
        console.log(`      ${r.playerName} (${r.club}): ${r.rating}${extras.length ? " [" + extras.join(",") + "]" : ""}`);
      });

      allRatings.push(...ratings);
    }

    if (articleUrls.length === 0) {
      // Fallback: browse L'Équipe Football/Ligue 1 page for recent articles
      console.log("  Trying L1 page browse...");
      const fallbackUrls = await browseLigue1Page(context, match.homeTeam, match.awayTeam);
      for (const url of fallbackUrls.slice(0, 1)) {
        const shortUrl = url.split("/").slice(-2).join("/");
        console.log(`  📰 ${shortUrl} (from browse)`);
        const ratings = await scrapeArticle(context, url, matchLabel);
        console.log(`    ${ratings.length} ratings extracted`);
        ratings.forEach((r) => {
          const extras = [];
          if (r.goals > 0) extras.push(`${r.goals}g`);
          if (r.assists > 0) extras.push(`${r.assists}a`);
          console.log(`      ${r.playerName} (${r.club}): ${r.rating}${extras.length ? " [" + extras.join(",") + "]" : ""}`);
        });
        allRatings.push(...ratings);
      }
      if (fallbackUrls.length === 0) {
        console.log("  ❌ No article found (even after browse)");
      }
    }
  }

  await context.close();

  // 4. Deduplicate
  const seen = new Set<string>();
  const deduped = allRatings.filter((r) => {
    const key = `${r.playerName.toLowerCase()}-${r.club.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 5. Save output
  const outputFile = path.join(__dirname, "..", `tmp/web-ratings-j${matchday}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(deduped, null, 2));

  console.log(`\n${"=".repeat(50)}`);
  console.log(`TOTAL: ${deduped.length} unique ratings from ${matches.length} matches`);
  console.log(`Saved to ${outputFile}`);
  console.log(`${"=".repeat(50)}`);
}

main().catch(console.error);
