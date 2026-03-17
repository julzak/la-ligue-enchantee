import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const COOKIES_FILE = path.join(__dirname, "cookies-lequipe.json");
const ARTICLE_URL = process.argv[2] ?? "https://www.lequipe.fr/Football/Article/Les-notes-de-metz-toulouse-gboho-et-donnum-ont-mis-les-messins-au-supplice/1659906";

interface Rating {
  name: string;
  club: string;
  rating: number;
  desc: string;
  goals: number;
  assists: number;
}

async function main() {
  // Load cookies
  const rawCookies = JSON.parse(fs.readFileSync(COOKIES_FILE, "utf-8"));

  // Convert EditAnyCookie format to Playwright format
  const cookies = rawCookies.map((c: Record<string, unknown>) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path ?? "/",
    expires: c.expirationDate ?? -1,
    httpOnly: c.httpOnly ?? false,
    secure: c.secure ?? false,
    sameSite: "Lax" as const,
  }));

  console.log(`Loaded ${cookies.length} cookies`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  // Inject cookies
  await context.addCookies(cookies);
  const page = await context.newPage();

  // Go to article
  console.log("Loading article:", ARTICLE_URL);
  await page.goto(ARTICLE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);

  // Accept cookies if needed
  try { await page.click('text="oui, j\'accepte"', { timeout: 3000 }); } catch {}
  await page.waitForTimeout(2000);

  // Scroll to load all content
  for (let i = 0; i < 10; i++) {
    await page.evaluate((step) => window.scrollTo(0, step * 800), i);
    await page.waitForTimeout(300);
  }

  // Extract text
  const text = await page.evaluate(() => document.body.innerText);
  const hasPaywall = text.includes("réservée à nos abonnés");
  console.log("Paywalled:", hasPaywall);

  if (hasPaywall) {
    console.log("\n*** Still paywalled. Cookies may have expired. Re-export from browser. ***");
    await page.screenshot({ path: "/tmp/lequipe-paywalled.png" });
    await browser.close();
    return;
  }

  // Parse ratings: "Name (Club) : N"
  const lines = text.split("\n");
  const ratings: Rating[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const match = line.match(/^(.+?)\s*\(([^)]+)\)\s*:\s*(\d+)\s*$/);
    if (match && Number(match[3]) <= 10 && match[1].trim().length > 2) {
      // Get description (next long paragraph)
      let desc = "";
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const next = lines[j].trim();
        if (next.length > 40) { desc = next; break; }
      }

      // Extract goals from description
      const goalMatches = desc.match(/but[s]?\s/gi);
      const goals = goalMatches ? goalMatches.length : 0;

      // Extract assists
      const assistMatches = desc.match(/passe[s]?\s+d[ée]cisive/gi);
      const assists = assistMatches ? assistMatches.length : 0;

      // Check for "doublé" = 2 goals
      const double = desc.match(/doubl[ée]/i);
      const triple = desc.match(/tripl[ée]/i);

      let goalCount = 0;
      if (triple) goalCount = 3;
      else if (double) goalCount = 2;
      else if (desc.match(/son but|un but|le but|marqu[ée]/i)) goalCount = 1;
      else goalCount = goals > 0 ? 1 : 0;

      ratings.push({
        name: match[1].trim(),
        club: match[2].trim(),
        rating: Number(match[3]),
        desc: desc.slice(0, 300),
        goals: goalCount,
        assists: assists > 0 ? 1 : (desc.match(/passe/i) ? 1 : 0),
      });
    }
  }

  console.log(`\n=== ${ratings.length} RATINGS FOUND ===`);
  ratings.forEach((r) => {
    const extras = [];
    if (r.goals > 0) extras.push(`${r.goals} but(s)`);
    if (r.assists > 0) extras.push("passe(s)");
    console.log(`  ${r.name} (${r.club}): ${r.rating}${extras.length ? " [" + extras.join(", ") + "]" : ""}`);
  });

  console.log("\n=== JSON ===");
  console.log(JSON.stringify(ratings, null, 2));

  await browser.close();
}

main().catch(console.error);
