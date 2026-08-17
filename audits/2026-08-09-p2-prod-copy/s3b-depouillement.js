// S3b — Reprise : dépouillement (après suppression SQL de la mise du non-membre) + tour 2
const { chromium } = require("playwright");
const { apiLogin, newPage, snap, BASE } = require("./helpers");

(async () => {
  const browser = await chromium.launch();
  const cookies = await apiLogin("Thomas P");
  const { page, consoleErrors, httpErrors } = await newPage(browser, cookies, { mobile: false });
  const log = (...a) => console.log("[S3b]", ...a);
  const dialogs = [];
  page.on("dialog", async (d) => { dialogs.push(d.message()); await d.accept(); });

  await page.goto(`${BASE}/admin/encheres`, { waitUntil: "networkidle" });
  const select = page.locator("select").first();
  await select.selectOption({ label: "Ligue 1" });
  await page.waitForTimeout(1200);

  const resolveBtn = page.locator("button", { hasText: "Lancer le dépouillement" }).last();
  await resolveBtn.click();
  await page.waitForTimeout(3000);
  let txt = await page.locator("body").innerText();
  log("Chip:", txt.match(/OUVERT|CLÔTURÉ|DÉPOUILLÉ/)?.[0]);
  log("Message:", txt.match(/Dépouillement[^\n]*/)?.[0] ?? "(aucun)");
  await snap(page, "23-s3-admin-depouille-haut");
  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(300);
  await snap(page, "24-s3-admin-depouille-milieu");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  await snap(page, "25-s3-admin-depouille-bas");

  // dump the results section text for offline comparison
  console.log("===RESULTATS===");
  console.log(txt);
  console.log("===FIN===");

  // Ouvrir le tour 2
  const openBtn = page.locator("button", { hasText: "Ouvrir le tour 2" }).last();
  log("Bouton 'Ouvrir le tour 2' visible:", (await openBtn.count()) > 0);
  if (await openBtn.count()) {
    await openBtn.click();
    await page.waitForTimeout(1500);
    txt = await page.locator("body").innerText();
    log("Après ouverture tour 2 — chip:", txt.match(/OUVERT|CLÔTURÉ|DÉPOUILLÉ/)?.[0], "| tour courant:", txt.match(/Tour courant\s*\n?\s*Tour \d+/)?.[0]?.replace(/\n/g, " "));
    await snap(page, "26-s3-admin-tour2-ouvert");
  }

  log("Dialogs:", JSON.stringify(dialogs));
  console.log("[S3b] consoleErrors:", JSON.stringify(consoleErrors.slice(0, 8)));
  console.log("[S3b] httpErrors:", JSON.stringify(httpErrors.slice(0, 8)));
  await browser.close();
})().catch((e) => { console.error("[S3b] CRASH", e); process.exit(1); });
