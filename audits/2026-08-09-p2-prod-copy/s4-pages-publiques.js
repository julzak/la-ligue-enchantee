// S4 — Pages publiques des 3 ligues + accès enchères par un membre de chaque
const { chromium } = require("playwright");
const { apiLogin, newPage, snap, BASE } = require("./helpers");

const CASES = [
  { slug: "ligue-1", user: "Mathieu L.", label: "Ligue 1" },
  { slug: "ligue-2", user: "Denis", label: "Ligue 2" },
  { slug: "ligue-3", user: "Moktar", label: "Ligue 3" },
];

(async () => {
  const browser = await chromium.launch();
  const log = (...a) => console.log("[S4]", ...a);
  let i = 11;

  for (const c of CASES) {
    const cookies = await apiLogin(c.user);
    const { page, consoleErrors, httpErrors, context } = await newPage(browser, cookies, { mobile: true });

    await page.goto(`${BASE}/ligue/${c.slug}/classement`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const title = await page.title();
    const h = await page.locator("h1, h2").allInnerTexts();
    const body = await page.locator("body").innerText();
    log(`${c.slug} — <title>: "${title}"`);
    log(`${c.slug} — headings:`, JSON.stringify(h.slice(0, 6)));
    const occurrences = (body.match(new RegExp(c.label, "g")) || []).length;
    log(`${c.slug} — occurrences de "${c.label}" dans la page:`, occurrences);
    // doublons de nom de ligue suspects (ex "Ligue 1 Ligue 1")
    log(`${c.slug} — doublon accolé:`, new RegExp(`${c.label}\\s*${c.label}`).test(body));
    await snap(page, `${String(i).padStart(2, "0")}-s4-${c.slug}-classement`);
    i++;

    await page.goto(`${BASE}/ligue/${c.slug}/encheres`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    const btxt = await page.locator("body").innerText();
    log(`${c.slug}/encheres (${c.user}) — état:`, btxt.includes("Aucune enchère") ? "Aucune enchère en cours" : (btxt.match(/Tour \d+|tour \d+/)?.[0] ?? "?"), "| longueur page:", btxt.length);
    await snap(page, `${String(i).padStart(2, "0")}-s4-${c.slug}-encheres`);
    i++;

    if (consoleErrors.length) log(`${c.slug} consoleErrors:`, JSON.stringify(consoleErrors.slice(0, 5)));
    if (httpErrors.length) log(`${c.slug} httpErrors:`, JSON.stringify(httpErrors.slice(0, 5)));
    await context.close();
  }
  await browser.close();
})().catch((e) => { console.error("[S4] CRASH", e); process.exit(1); });
