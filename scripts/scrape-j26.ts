import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const COOKIES_FILE = path.join(__dirname, "cookies-lequipe.json");

// Known J26 note articles (from L'Equipe L1 page + search)
const ARTICLES = [
  "https://www.lequipe.fr/Football/Article/Les-notes-de-rennes-lille-les-jambes-de-fernandez-pardo-la-tete-d-haraldsson/1659974",
  "https://www.lequipe.fr/Football/Article/Les-notes-de-le-havre-ol-diaw-solide-karabec-invisible/1659928",
  "https://www.lequipe.fr/Football/Article/Les-notes-de-metz-toulouse-gboho-et-donnum-ont-mis-les-messins-au-supplice/1659906",
  "https://www.lequipe.fr/Football/Article/Les-notes-de-strasbourg-pfc-penders-et-trapp-ferment-la-boutique/1659862",
];

interface Rating {
  name: string;
  club: string;
  rating: number;
  goals: number;
  assists: number;
  match: string;
}

function parseRatingsFromText(text: string, matchLabel: string): Rating[] {
  const lines = text.split("\n");
  const ratings: Rating[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Match: "Prénom Nom (Club) : N" or "Prénom Nom (Club)  : N"
    const match = line.match(/^(.+?)\s*\(([^)]+)\)\s*:\s*(\d+)\s*$/);
    if (match && Number(match[3]) <= 10 && match[1].trim().length > 2) {
      // Get description text
      let desc = "";
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        const next = lines[j].trim();
        if (next.length > 40 && !next.match(/\([^)]+\)\s*:\s*\d+$/)) {
          desc = next;
          break;
        }
      }

      // Parse goals from description
      let goals = 0;
      if (desc.match(/tripl[ée]/i)) goals = 3;
      else if (desc.match(/doubl[ée]/i)) goals = 2;
      else if (desc.match(/\bun but\b|\bson but\b|\ble but\b|\ba marqu[ée]/i) && !desc.match(/n'a pas marqu/i)) goals = 1;
      // Also check for specific minute mentions like "(14e, 45e+3)" which indicate goals
      const minuteGoals = desc.match(/\((\d+e(?:\+\d+)?(?:,\s*\d+e(?:\+\d+)?)*)\)/);
      if (minuteGoals && desc.match(/but|marqu|couronnée/i)) {
        const mins = minuteGoals[1].split(",").length;
        if (mins > goals) goals = mins;
      }

      // Parse assists
      let assists = 0;
      if (desc.match(/passe[s]?\s+d[ée]cisive/i)) assists = 1;
      if (desc.match(/deux\s+passe/i) || desc.match(/doubl[ée]\s+de\s+passe/i)) assists = 2;

      // Don't count goals for defensive players described as conceding
      if (desc.match(/encaiss|fautif|passif|manqu.*agress/i) && goals > 0 && !desc.match(/marqu|but de/i)) {
        goals = 0;
      }

      ratings.push({
        name: match[1].trim(),
        club: match[2].trim(),
        rating: Number(match[3]),
        goals,
        assists,
        match: matchLabel,
      });
    }
  }

  return ratings;
}

async function main() {
  const rawCookies = JSON.parse(fs.readFileSync(COOKIES_FILE, "utf-8"));
  const cookies = rawCookies.map((c: Record<string, unknown>) => ({
    name: c.name, value: c.value, domain: c.domain, path: c.path ?? "/",
    expires: c.expirationDate ?? -1, httpOnly: c.httpOnly ?? false,
    secure: c.secure ?? false, sameSite: "Lax" as const,
  }));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies(cookies);

  const allRatings: Rating[] = [];

  for (const url of ARTICLES) {
    const page = await context.newPage();
    const matchLabel = decodeURIComponent(url.split("/").slice(-2, -1)[0])
      .replace(/Les-notes-de-/i, "")
      .replace(/-[a-z].*$/, "")
      .replace(/-/g, " ");

    console.log(`\nScraping: ${matchLabel}...`);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    try { await page.click('text="oui, j\'accepte"', { timeout: 2000 }); } catch {}

    // Scroll to load
    for (let i = 0; i < 10; i++) {
      await page.evaluate((s) => window.scrollTo(0, s * 800), i);
      await page.waitForTimeout(200);
    }

    const text = await page.evaluate(() => document.body.innerText);
    const paywalled = text.includes("réservée à nos abonnés");

    if (paywalled) {
      console.log("  PAYWALLED - skipping");
      await page.close();
      continue;
    }

    const ratings = parseRatingsFromText(text, matchLabel);
    console.log(`  Found ${ratings.length} ratings`);
    ratings.forEach((r) => {
      const extras = [];
      if (r.goals > 0) extras.push(`${r.goals}g`);
      if (r.assists > 0) extras.push(`${r.assists}a`);
      console.log(`    ${r.name} (${r.club}): ${r.rating}${extras.length ? " [" + extras.join(",") + "]" : ""}`);
    });
    allRatings.push(...ratings);
    await page.close();
  }

  console.log(`\n=== TOTAL: ${allRatings.length} ratings across ${ARTICLES.length} matches ===`);

  // Compare with DB
  console.log("\n=== COMPARISON WITH DB ===");
  // Output as JSON for comparison
  fs.writeFileSync("/tmp/j26-scraped-ratings.json", JSON.stringify(allRatings, null, 2));
  console.log("Saved to /tmp/j26-scraped-ratings.json");

  await browser.close();
}

main().catch(console.error);
