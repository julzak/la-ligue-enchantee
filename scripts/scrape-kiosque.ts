/**
 * Scrape L'Équipe kiosque (liseuse) to extract L1 player ratings.
 *
 * Usage:
 *   npx tsx scripts/scrape-kiosque.ts                   # latest edition
 *   npx tsx scripts/scrape-kiosque.ts --date 2026-03-16  # specific date
 *   npx tsx scripts/scrape-kiosque.ts --date 16          # day of current month
 *
 * Flow:
 *   1. Login to L'Équipe (or reuse cookies)
 *   2. Navigate to kiosque/le-journal
 *   3. Scroll to find target edition, open in liseuse
 *   4. Screenshot football pages (with player ratings)
 *   5. Send screenshots to Claude Vision API for structured extraction
 *   6. Output JSON with all ratings
 */

import { chromium, type Page, type BrowserContext } from "playwright";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const COOKIES_FILE = path.join(__dirname, "cookies-lequipe.json");
const BROWSER_PROFILE = path.join(__dirname, "..", "tmp/lequipe-profile");
const LOCK_FILE = path.join(__dirname, "..", "tmp/scrape.lock");
// Directories are set per-run in main() based on target date
let SCREENSHOTS_DIR = path.join(__dirname, "..", "tmp/kiosque-screenshots");
let OUTPUT_FILE = path.join(__dirname, "..", "tmp/kiosque-ratings.json");

const LEQUIPE_EMAIL = process.env.LEQUIPE_EMAIL!;
const LEQUIPE_PASSWORD = process.env.LEQUIPE_PASSWORD!;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

// ── Parse CLI args ────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const dates: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--date" || args[i] === "--dates") && args[i + 1]) {
      // Support comma-separated: --dates 2026-03-15,2026-03-16
      dates.push(...args[i + 1].split(",").map((d) => d.trim()));
      i++;
    }
  }

  return { dates: dates.length > 0 ? dates : [null as unknown as string] };
}

/**
 * Convert --date arg to a French date fragment for matching.
 * "2026-03-16" -> "16 mars 2026"
 * "16" -> "16 mars" (current month)
 */
function toFrenchDate(dateStr: string): string {
  const months = [
    "janv.", "févr.", "mars", "avril", "mai", "juin",
    "juil.", "août", "sept.", "oct.", "nov.", "déc.",
  ];

  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [y, m, d] = dateStr.split("-");
    return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
  }

  if (dateStr.match(/^\d{1,2}$/)) {
    const now = new Date();
    return `${parseInt(dateStr)} ${months[now.getMonth()]}`;
  }

  return dateStr;
}

// ── Login to L'Équipe ─────────────────────────────────────
async function login(context: BrowserContext): Promise<boolean> {
  const page = await context.newPage();
  console.log("Logging in to L'Équipe...");

  try {
    await page.goto("https://www.lequipe.fr/mon-compte/connexion", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3000);

    // Accept cookies banner
    try {
      await page.click('text="oui, j\'accepte"', { timeout: 3000 });
      await page.waitForTimeout(1000);
    } catch {}

    // Fill login form (placeholders: "email ou pseudo", "mot de passe")
    const emailInput = await page.$('input[placeholder*="email"], input[name="email"], input[type="email"]');
    const passInput = await page.$('input[placeholder*="mot de passe"], input[name="password"], input[type="password"]');
    if (!emailInput || !passInput) {
      console.log("  Could not find login form fields");
      await page.screenshot({ path: "/tmp/lequipe-login-error.png" });
      await page.close();
      return false;
    }
    await emailInput.fill(LEQUIPE_EMAIL);
    await page.waitForTimeout(500);
    await passInput.fill(LEQUIPE_PASSWORD);
    await page.waitForTimeout(500);

    // Click submit button
    const submitBtn = await page.$('button:has-text("connecter"), button[type="submit"]');
    if (submitBtn) await submitBtn.click();
    else await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);

    const url = page.url();
    const isLoggedIn = !url.includes("connexion");
    console.log(isLoggedIn ? "  Login successful" : "  Login may have failed, continuing...");

    // Save cookies for reuse
    const cookies = await context.cookies();
    fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
    console.log(`  Saved ${cookies.length} cookies`);

    await page.close();
    return isLoggedIn;
  } catch (err) {
    console.error("  Login error:", err);
    await page.screenshot({ path: "/tmp/lequipe-login-error.png" });
    await page.close();
    return false;
  }
}

// ── Load existing cookies ─────────────────────────────────
async function loadCookies(context: BrowserContext): Promise<boolean> {
  if (!fs.existsSync(COOKIES_FILE)) return false;

  try {
    const rawCookies = JSON.parse(fs.readFileSync(COOKIES_FILE, "utf-8"));
    const cookies = rawCookies.map((c: Record<string, unknown>) => ({
      name: c.name as string,
      value: c.value as string,
      domain: c.domain as string,
      path: (c.path as string) ?? "/",
      expires: (c.expirationDate as number) ?? (c.expires as number) ?? -1,
      httpOnly: (c.httpOnly as boolean) ?? false,
      secure: (c.secure as boolean) ?? false,
      sameSite: "Lax" as const,
    }));
    await context.addCookies(cookies);
    console.log(`Loaded ${cookies.length} cookies from cache`);
    return true;
  } catch {
    return false;
  }
}

// ── Navigate to kiosque and open edition ──────────────────
async function openKiosqueEdition(
  page: Page,
  targetDate: string | null
): Promise<boolean> {
  // Go directly to /le-journal filter
  console.log("\nNavigating to kiosque/le-journal...");
  await page.goto("https://www.lequipe.fr/abonnement/kiosque/le-journal", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(4000);

  // Accept cookies
  try {
    await page.click('text="oui, j\'accepte"', { timeout: 2000 });
    await page.waitForTimeout(1000);
  } catch {}

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, "01-kiosque-journal.png"),
    fullPage: false,
  });
  console.log("  Screenshot saved: 01-kiosque-journal.png");

  // Scroll down to load more editions (lazy loading)
  console.log("  Scrolling to load previous editions...");
  for (let i = 0; i < 10; i++) {
    await page.evaluate((step) => window.scrollTo(0, step * 600), i + 1);
    await page.waitForTimeout(800);
  }

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, "02-kiosque-scrolled.png"),
    fullPage: true,
  });
  console.log("  Screenshot saved: 02-kiosque-scrolled.png");

  // Get all visible text to find edition dates
  const pageText = await page.evaluate(() => document.body.innerText);
  console.log("\n  Page text (editions section, first 3000 chars):");
  console.log(pageText.slice(0, 3000));

  // Determine which date we're looking for
  const frenchDate = targetDate ? toFrenchDate(targetDate) : null;
  console.log(`\n  Looking for: ${frenchDate ?? "latest edition"}`);

  if (frenchDate) {
    // Try to find and click the edition with this date
    // The editions show as "le journal[DATE]" with a "lire l'édition" button nearby
    // Strategy: find text containing the date, then click the nearest "lire l'édition"

    const found = await page.evaluate((dateStr) => {
      // Walk through all text nodes to find the date
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null
      );

      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent?.includes(dateStr)) {
          // Found the date text — find the parent container
          let container = node.parentElement;
          // Walk up to find the edition card/section
          for (let i = 0; i < 10 && container; i++) {
            const btn = container.querySelector('a, button');
            const text = container.textContent ?? "";
            if (text.includes("lire") && btn) {
              (btn as HTMLElement).click();
              return { found: true, text: text.slice(0, 200) };
            }
            container = container.parentElement;
          }
        }
      }
      return { found: false, text: "" };
    }, frenchDate);

    if (found.found) {
      console.log(`  Clicked edition: ${found.text.slice(0, 100)}`);
      await page.waitForTimeout(5000);
    } else {
      console.log(`  Date "${frenchDate}" not found on page. Trying alternative approach...`);

      // Alternative: look for all "lire l'édition" buttons and their associated dates
      const editions = await page.evaluate(() => {
        const results: { index: number; text: string; rect: DOMRect | null }[] = [];
        // Find all elements that contain "lire l'édition" or similar
        const allElements = document.querySelectorAll("a, button");
        allElements.forEach((el, i) => {
          const text = el.textContent?.trim() ?? "";
          if (text.toLowerCase().includes("lire")) {
            // Get the surrounding context (parent's text)
            const parent = el.closest("section, article, div[class]");
            const parentText = parent?.textContent?.trim().slice(0, 300) ?? "";
            results.push({
              index: i,
              text: parentText,
              rect: el.getBoundingClientRect(),
            });
          }
        });
        return results;
      });

      console.log(`\n  Found ${editions.length} 'lire' buttons:`);
      editions.forEach((e, i) => {
        const dateMatch = e.text.match(/\d{1,2}\s+(?:janv|févr|mars|avril|mai|juin|juil|août|sept|oct|nov|déc)\S*\s+\d{4}/);
        console.log(`    [${i}] ${dateMatch?.[0] ?? "no date"} — ${e.text.slice(0, 80)}`);
      });

      // Try to find the target date among them
      const targetIdx = editions.findIndex((e) => e.text.includes(frenchDate));
      if (targetIdx >= 0) {
        console.log(`\n  Found target at index ${targetIdx}, clicking...`);
        const allButtons = await page.$$("a, button");
        const btnIdx = editions[targetIdx].index;
        if (allButtons[btnIdx]) {
          await allButtons[btnIdx].click();
          await page.waitForTimeout(5000);
        }
      } else {
        console.log(`\n  Target date "${frenchDate}" not found among editions.`);
        console.log("  Available dates on page:");
        const dates = pageText.match(/\d{1,2}\s+(?:janv|févr|mars|avril|mai|juin|juil|août|sept|oct|nov|déc)\S*\s+\d{4}/g);
        dates?.forEach((d) => console.log(`    - ${d}`));
        return false;
      }
    }
  } else {
    // Just click the first "lire l'édition" (latest)
    console.log("  Opening latest edition...");
    try {
      await page.click('text="lire l\'édition"', { timeout: 5000 });
      await page.waitForTimeout(5000);
    } catch {
      console.log("  Could not click 'lire l'édition'");
      return false;
    }
  }

  // We should now be in the liseuse or navigating to it
  // Check if we're on a new page/iframe
  const currentUrl = page.url();
  console.log(`\n  Current URL after click: ${currentUrl}`);

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, "03-after-click.png"),
    fullPage: false,
  });
  console.log("  Screenshot saved: 03-after-click.png");

  // The liseuse might open in a new tab or iframe
  // Check for new pages
  const pages = page.context().pages();
  if (pages.length > 1) {
    const newPage = pages[pages.length - 1];
    console.log(`  New tab opened: ${newPage.url()}`);
    await newPage.waitForTimeout(5000);
    await newPage.screenshot({
      path: path.join(SCREENSHOTS_DIR, "03-new-tab.png"),
      fullPage: false,
    });
  }

  // Check for iframes (Twipe reader)
  const frames = page.frames();
  console.log(`  Page has ${frames.length} frames`);
  for (const frame of frames) {
    const frameUrl = frame.url();
    if (frameUrl.includes("twipe") || frameUrl.includes("reader")) {
      console.log(`  Found reader iframe: ${frameUrl}`);
    }
  }

  return true;
}

// ── Navigate liseuse and screenshot football pages ────────
async function screenshotFootballPages(page: Page): Promise<string[]> {
  console.log("\nCapturing football pages from liseuse...");
  const screenshots: string[] = [];

  // Use the correct page (might have opened in a new tab)
  const pages = page.context().pages();
  const readerPage = pages.length > 1 ? pages[pages.length - 1] : page;

  await readerPage.waitForTimeout(3000);
  console.log(`  Reader URL: ${readerPage.url()}`);

  // The Twipe reader has a top navigation bar with section links
  // e.g.: "tous | tennis | rennes | football | strasbourg | rugby | ..."
  // Click "football" to jump directly to the football section
  console.log("  Looking for 'football' section link...");

  try {
    // Try clicking the "football" link in the nav bar
    const footballLink = await readerPage.$('a:has-text("football"), button:has-text("football")');
    if (footballLink) {
      await footballLink.click();
      console.log("  Clicked 'football' section link");
      await readerPage.waitForTimeout(3000);
    } else {
      // Try text-based click
      await readerPage.click('text="football"', { timeout: 3000 });
      console.log("  Clicked 'football' text");
      await readerPage.waitForTimeout(3000);
    }
  } catch {
    // Check if we hit a login wall
    const pageText = await readerPage.evaluate(() => document.body.innerText);
    if (pageText.includes("connecter") || pageText.includes("désolé")) {
      console.log("  Session expired! Re-logging in...");
      const loggedIn = await login(readerPage.context());
      if (loggedIn) {
        // Reload the reader page
        await readerPage.reload({ waitUntil: "domcontentloaded" });
        await readerPage.waitForTimeout(5000);
        try {
          await readerPage.click('text="football"', { timeout: 5000 });
          console.log("  Clicked 'football' after re-login");
          await readerPage.waitForTimeout(3000);
        } catch {
          console.log("  Still could not find 'football' after re-login");
        }
      }
    } else {
      console.log("  Could not find 'football' link");
      const navLinks = await readerPage.evaluate(() => {
        const links: string[] = [];
        document.querySelectorAll("a, button, [role='tab'], [class*='nav'] *").forEach((el) => {
          const text = (el as HTMLElement).textContent?.trim().toLowerCase() ?? "";
          if (text.length < 30) links.push(text);
        });
        return links;
      });
      console.log("  Nav items found:", navLinks.filter((l) => l.length > 0).slice(0, 20));
    }
  }

  await readerPage.screenshot({
    path: path.join(SCREENSHOTS_DIR, "04-football-section.png"),
    fullPage: false,
  });
  console.log("  Screenshot saved: 04-football-section.png");

  // The Twipe reader uses hash-based navigation:
  // #!preferred/0/package/1624/pub/1624/page/N
  // We extract the publication ID and navigate by changing the page number.

  const currentHash = await readerPage.evaluate(() => window.location.hash);
  console.log(`  Current hash: ${currentHash}`);

  // Extract pub ID and current page number
  const hashMatch = currentHash.match(/package\/(\d+)\/pub\/(\d+)\/page\/(\d+)/);
  if (!hashMatch) {
    console.log("  Could not parse hash format, falling back to screenshot only");
    await readerPage.screenshot({
      path: path.join(SCREENSHOTS_DIR, "football-01.png"),
      fullPage: false,
    });
    screenshots.push(path.join(SCREENSHOTS_DIR, "football-01.png"));
    return screenshots;
  }

  const packageId = hashMatch[1];
  const pubId = hashMatch[2];
  const startPage = parseInt(hashMatch[3]);
  console.log(`  Publication: ${pubId}, starting at page ${startPage}`);

  // Two-pass approach:
  // Pass 1: capture full spread (small) to detect match encart positions
  // Pass 2: crop each encart region for detailed extraction
  const viewport = readerPage.viewportSize()!;
  const NUM_SPREADS = 8;

  for (let pageNum = startPage; pageNum <= startPage + NUM_SPREADS - 1; pageNum++) {
    const targetHash = `#!preferred/0/package/${packageId}/pub/${pubId}/page/${pageNum}`;
    await readerPage.evaluate((hash) => {
      window.location.hash = hash.replace("#", "");
    }, targetHash);
    await readerPage.waitForTimeout(2500);

    // Capture left half-page (one page of the spread)
    const leftFile = `football-p${String(pageNum).padStart(2, "0")}-L.png`;
    const leftPath = path.join(SCREENSHOTS_DIR, leftFile);
    await readerPage.screenshot({
      path: leftPath,
      clip: { x: 0, y: 0, width: viewport.width / 2, height: viewport.height },
    });
    screenshots.push(leftPath);

    // Capture right half-page
    const rightFile = `football-p${String(pageNum).padStart(2, "0")}-R.png`;
    const rightPath = path.join(SCREENSHOTS_DIR, rightFile);
    await readerPage.screenshot({
      path: rightPath,
      clip: { x: viewport.width / 2, y: 0, width: viewport.width / 2, height: viewport.height },
    });
    screenshots.push(rightPath);

    console.log(`  Captured spread ${pageNum - startPage + 1}/${NUM_SPREADS} (p${pageNum})`);
  }

  console.log(`  Total: ${screenshots.length} screenshots captured`);
  return screenshots;
}

// ── Extract ratings from screenshots using Pixtral (Mistral Vision) ──
interface ExtractedRating {
  playerName: string;
  club: string;
  rating: number;
  confidence: "high" | "medium" | "low";
  goals: number;
  assists: number;
  ownGoals: number;
  penaltySaved: number;
  redCard: boolean;
  position: "GK" | "DEF" | "MID" | "ATT" | null;
  match: string;
}

const VISION_PROMPT = `Extrais les notes de joueurs de football sur cette page du journal L'Équipe. Les notes sont des chiffres dans des cercles colorés sur un schéma de terrain.

Retourne un JSON: [{"playerName":"nom","club":"ABRÉV","rating":N,"confidence":"high/medium/low","goals":0,"assists":0,"ownGoals":0,"redCard":false,"position":"GK/DEF/MID/ATT","match":"Domicile X-Y Extérieur"}]

Clubs: PSG,OM,OL,LOSC,ASM,SRFC,HAC,FCM,TFC,RCSA,PFC,RCL,FCN,OGCN,SB29,SCO,AJA. Équipe à gauche=domicile. Score en GRAS=final (pas mi-temps). Lis aussi "Les buts" en bas pour goals/assists. Si pas de formation visible, retourne [].`;

// Single Gemini call for one image (simple format — works reliably)
async function callGemini(
  model: ReturnType<InstanceType<typeof GoogleGenerativeAI>["getGenerativeModel"]>,
  base64: string,
  _temperature: number
): Promise<ExtractedRating[]> {
  const result = await model.generateContent([
    { inlineData: { mimeType: "image/png", data: base64 } },
    { text: VISION_PROMPT },
  ]);

  const rawText = result.response.text();
  const start = rawText.indexOf("[");
  const end = rawText.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    return JSON.parse(rawText.slice(start, end + 1)) as ExtractedRating[];
  } catch {
    return [];
  }
}

// Vote majority on ratings from multiple passes
function voteRatings(passes: ExtractedRating[][]): ExtractedRating[] {
  // Group by player name + match across all passes
  const byPlayer = new Map<string, { ratings: (number | null)[]; entries: ExtractedRating[] }>();

  for (const pass of passes) {
    for (const r of pass) {
      const key = `${(r.playerName ?? "").toLowerCase()}|${(r.club ?? "").toLowerCase()}|${(r.match ?? "").toLowerCase()}`;
      const existing = byPlayer.get(key) ?? { ratings: [], entries: [] };
      existing.ratings.push(r.rating);
      existing.entries.push(r);
      byPlayer.set(key, existing);
    }
  }

  const voted: ExtractedRating[] = [];
  byPlayer.forEach(({ ratings, entries }) => {
    const validRatings = ratings.filter((r): r is number => r !== null);
    if (validRatings.length === 0) return;

    // Find majority rating
    const counts = new Map<number, number>();
    validRatings.forEach((r) => counts.set(r, (counts.get(r) ?? 0) + 1));
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const bestRating = sorted[0][0];
    const bestCount = sorted[0][1];

    // Determine confidence based on agreement
    let confidence: "high" | "medium" | "low";
    if (bestCount === validRatings.length) {
      confidence = "high"; // all passes agree
    } else if (bestCount >= 2) {
      confidence = "medium"; // majority agrees
    } else {
      confidence = "low"; // no agreement
    }

    // Take the best entry and override rating + confidence
    const best = entries[0];
    best.rating = bestRating;
    best.confidence = confidence;

    // Merge bonus info from all passes
    for (const e of entries) {
      if (e.goals > best.goals) best.goals = e.goals;
      if (e.assists > best.assists) best.assists = e.assists;
      if (e.redCard) best.redCard = true;
      if (e.ownGoals > best.ownGoals) best.ownGoals = e.ownGoals;
    }

    voted.push(best);
  });

  return voted;
}

async function extractRatingsFromScreenshots(
  screenshotPaths: string[]
): Promise<ExtractedRating[]> {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const allRatings: ExtractedRating[] = [];
  for (let i = 0; i < screenshotPaths.length; i++) {
    const filepath = screenshotPaths[i];
    console.log(
      `\nProcessing screenshot ${i + 1}/${screenshotPaths.length} with Gemini Flash...`
    );

    const imageData = fs.readFileSync(filepath);
    const base64 = imageData.toString("base64");

    try {
      const ratings = await callGemini(model, base64, 0);
      console.log(`  Extracted ${ratings.length} ratings`);
      ratings.forEach((r) => {
        const extras = [];
        if (r.goals > 0) extras.push(`${r.goals}g`);
        if (r.assists > 0) extras.push(`${r.assists}a`);
        if (r.ownGoals > 0) extras.push(`${r.ownGoals}csc`);
        if (r.redCard) extras.push("rouge");
        console.log(
          `    ${r.playerName} (${r.club}): ${r.rating}${extras.length ? " [" + extras.join(",") + "]" : ""} — ${r.match}`
        );
      });
      allRatings.push(...ratings);
    } catch (apiErr: unknown) {
      const errMsg = apiErr instanceof Error ? apiErr.message : String(apiErr);
      if (errMsg.includes("429")) {
        console.log("  Rate limited, waiting 10s...");
        await new Promise((r) => setTimeout(r, 10000));
        i--;
        continue;
      }
      console.error("  Gemini error:", errMsg.slice(0, 200));
    }

    // Courtesy delay
    await new Promise((r) => setTimeout(r, 4500));
  }

  // Smart deduplication: when the same player appears multiple times
  // (from L/R half-page captures), keep the entry with the most info
  const grouped = new Map<string, ExtractedRating[]>();
  allRatings.forEach((r) => {
    // Normalize key: lowercase name, normalize match string
    const key = `${(r.playerName ?? "").toLowerCase()}-${(r.match ?? "unknown").toLowerCase()}`;
    const arr = grouped.get(key) ?? [];
    arr.push(r);
    grouped.set(key, arr);
  });

  const deduped: ExtractedRating[] = [];
  grouped.forEach((entries) => {
    if (entries.length === 1) {
      deduped.push(entries[0]);
      return;
    }

    // Score each entry: more info = better
    const scored = entries.map((e) => {
      let score = 0;
      if (e.rating !== null && e.rating !== undefined) score += 10;
      if (e.goals > 0) score += 5;
      if (e.assists > 0) score += 5;
      if (e.redCard) score += 3;
      if (e.ownGoals > 0) score += 3;
      if (e.position) score += 1;
      // Penalize "all same rating" patterns (likely hallucinated)
      return { entry: e, score };
    });

    // Keep the best scored entry
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0].entry;

    // Merge bonus info from other entries (goals, assists might be caught by one but not the other)
    for (const { entry: other } of scored.slice(1)) {
      if (other.goals > best.goals) best.goals = other.goals;
      if (other.assists > best.assists) best.assists = other.assists;
      if (other.redCard && !best.redCard) best.redCard = true;
      if (other.ownGoals > best.ownGoals) best.ownGoals = other.ownGoals;
    }

    deduped.push(best);
  });

  // Filter out entries with null match (likely not from a real match article)
  const filtered = deduped.filter((r) => r.match && r.match !== "null");

  return filtered;
}

// ── Process one edition ───────────────────────────────────
async function processEdition(
  page: Page,
  targetDate: string | null,
  allRatings: ExtractedRating[]
): Promise<void> {
  const dateSuffix = targetDate?.replace(/\D/g, "-") ?? "latest";
  SCREENSHOTS_DIR = path.join(__dirname, "..", `tmp/kiosque-${dateSuffix}`);

  // Ensure screenshots dir exists and is clean
  if (fs.existsSync(SCREENSHOTS_DIR)) {
    const old = fs.readdirSync(SCREENSHOTS_DIR).filter((f) => f.endsWith(".png"));
    old.forEach((f) => fs.unlinkSync(path.join(SCREENSHOTS_DIR, f)));
  } else {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`EDITION: ${targetDate ?? "latest"}`);
  console.log(`${"=".repeat(60)}`);

  // Navigate to kiosque and open edition
  const editionOpened = await openKiosqueEdition(page, targetDate);
  if (!editionOpened) {
    console.log(`  Skipping ${targetDate} — could not open edition`);
    return;
  }

  // Screenshot football pages
  const screenshots = await screenshotFootballPages(page);
  if (screenshots.length === 0) {
    console.log(`  No screenshots for ${targetDate}`);
    return;
  }

  // Extract ratings
  const ratings = await extractRatingsFromScreenshots(screenshots);
  console.log(`\n  Edition ${targetDate}: ${ratings.length} ratings extracted`);
  allRatings.push(...ratings);

}

// openKiosqueEdition already navigates to kiosque, so no need to go back here

// ── Lock file (prevent concurrent runs) ──────────────────
function acquireLock(): boolean {
  if (fs.existsSync(LOCK_FILE)) {
    const lockAge = Date.now() - fs.statSync(LOCK_FILE).mtimeMs;
    if (lockAge < 10 * 60 * 1000) { // less than 10 min old
      console.error("Another scrape is running (lock file exists). Wait or delete tmp/scrape.lock");
      return false;
    }
    // Stale lock, remove it
    fs.unlinkSync(LOCK_FILE);
  }
  fs.writeFileSync(LOCK_FILE, `${process.pid}\n${new Date().toISOString()}`);
  return true;
}

function releaseLock() {
  try { fs.unlinkSync(LOCK_FILE); } catch {}
}

// ── Check if session is valid ─────────────────────────────
async function isSessionValid(page: Page): Promise<boolean> {
  try {
    await page.goto("https://www.lequipe.fr/abonnement/kiosque/le-journal", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3000);
    const text = await page.evaluate(() => document.body.innerText);
    // If we see edition dates, we're logged in
    return text.includes("lire l'édition");
  } catch {
    return false;
  }
}

// ── Main ──────────────────────────────────────────────────
async function main() {
  const { dates } = parseArgs();

  console.log(`L'Équipe Kiosque Scraper`);
  console.log(`Editions to scrape: ${dates.join(", ")}`);
  console.log("---");

  // Prevent concurrent runs
  if (!acquireLock()) process.exit(1);

  // Use persistent browser context — session survives between runs
  // This is like a real Chrome profile: cookies, localStorage, etc. are saved
  if (!fs.existsSync(BROWSER_PROFILE)) {
    fs.mkdirSync(BROWSER_PROFILE, { recursive: true });
  }

  const context = await chromium.launchPersistentContext(BROWSER_PROFILE, {
    headless: false,
    // Wide viewport, no retina (retina images too large for reliable Gemini parsing)
    viewport: { width: 2560, height: 1440 },
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const page = context.pages()[0] || await context.newPage();

  // Check if existing session is valid
  console.log("Checking session...");
  let sessionOk = await isSessionValid(page);

  if (!sessionOk) {
    console.log("Session invalid, trying login...");

    // Try importing EditAnyCookie cookies first (if file exists and fresh)
    if (fs.existsSync(COOKIES_FILE)) {
      const cookieAge = Date.now() - fs.statSync(COOKIES_FILE).mtimeMs;
      if (cookieAge < 24 * 60 * 60 * 1000) { // less than 24h old
        console.log("  Importing cookies from EditAnyCookie export...");
        await loadCookies(context);
        sessionOk = await isSessionValid(page);
      }
    }

    // If still not valid, do programmatic login
    if (!sessionOk) {
      console.log("  Cookies didn't work, doing programmatic login...");
      const loggedIn = await login(context);
      if (loggedIn) {
        sessionOk = await isSessionValid(page);
      }
    }

    if (!sessionOk) {
      console.error("Could not establish session. Export fresh cookies to scripts/cookies-lequipe.json");
      await context.close();
      releaseLock();
      process.exit(1);
    }
  }

  console.log("Session OK!\n");

  const allRatings: ExtractedRating[] = [];

  // Process each edition sequentially in the same browser session
  for (const date of dates) {
    await processEdition(page, date, allRatings);
  }

  await context.close();
  releaseLock();

  // Deduplicate across all editions
  const grouped = new Map<string, ExtractedRating[]>();
  allRatings.forEach((r) => {
    const key = `${(r.playerName ?? "").toLowerCase()}-${(r.match ?? "unknown").toLowerCase()}`;
    const arr = grouped.get(key) ?? [];
    arr.push(r);
    grouped.set(key, arr);
  });

  const deduped: ExtractedRating[] = [];
  grouped.forEach((entries) => {
    const best = entries.sort((a, b) => {
      let sa = 0, sb = 0;
      if (a.rating !== null) sa += 10;
      if (b.rating !== null) sb += 10;
      if (a.goals > 0) sa += 5;
      if (b.goals > 0) sb += 5;
      if (a.assists > 0) sa += 5;
      if (b.assists > 0) sb += 5;
      return sb - sa;
    })[0];
    // Merge bonus info
    entries.forEach((e) => {
      if (e.goals > best.goals) best.goals = e.goals;
      if (e.assists > best.assists) best.assists = e.assists;
      if (e.redCard) best.redCard = true;
      if (e.ownGoals > best.ownGoals) best.ownGoals = e.ownGoals;
    });
    deduped.push(best);
  });

  const filtered = deduped.filter((r) => r.match && r.match !== "null");

  // Save combined output
  OUTPUT_FILE = path.join(__dirname, "..", "tmp/kiosque-ratings-combined.json");
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(filtered, null, 2));
  console.log(`\n${"=".repeat(60)}`);
  console.log(`COMBINED RESULTS: ${filtered.length} unique ratings`);
  console.log(`Saved to ${OUTPUT_FILE}`);
  console.log(`${"=".repeat(60)}`);

  // Summary by match
  const byMatch = new Map<string, ExtractedRating[]>();
  filtered.forEach((r) => {
    const arr = byMatch.get(r.match) ?? [];
    arr.push(r);
    byMatch.set(r.match, arr);
  });

  byMatch.forEach((players, match) => {
    console.log(`\n${match} (${players.length} players):`);
    players.forEach((p) => {
      const extras = [];
      if (p.goals > 0) extras.push(`${p.goals}g`);
      if (p.assists > 0) extras.push(`${p.assists}a`);
      if (p.redCard) extras.push("rouge");
      console.log(`  ${p.position ?? "?"} ${p.playerName} (${p.club}): ${p.rating}${extras.length ? " [" + extras.join(",") + "]" : ""}`);
    });
  });
}

main().catch(console.error);
