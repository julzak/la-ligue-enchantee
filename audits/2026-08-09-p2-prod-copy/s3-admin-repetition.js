// S3 — Répétition générale admin : clôture tour 1 → dépouillement → ouverture tour 2
const { chromium } = require("playwright");
const { apiLogin, newPage, snap, BASE } = require("./helpers");

(async () => {
  const browser = await chromium.launch();
  const cookies = await apiLogin("Thomas P");
  const { page, consoleErrors, httpErrors } = await newPage(browser, cookies, { mobile: false });
  const log = (...a) => console.log("[S3]", ...a);

  const dialogs = [];
  page.on("dialog", async (d) => { dialogs.push(d.message()); await d.accept(); });

  await page.goto(`${BASE}/admin/encheres`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await snap(page, "17-s3-admin-arrivee");

  // Sélection de la ligue
  const select = page.locator("select").first();
  const options = await select.locator("option").allInnerTexts();
  log("Options du sélecteur de ligue:", JSON.stringify(options));
  await select.selectOption({ label: "Ligue 1" }).catch(async () => {
    const val = await select.locator("option", { hasText: "Ligue 1" }).first().getAttribute("value");
    await select.selectOption(val);
  });
  await page.waitForTimeout(1200);
  await snap(page, "18-s3-admin-ligue1-tour-ouvert");

  let txt = await page.locator("body").innerText();
  log("Chip état:", txt.match(/OUVERT|CLÔTURÉ|DÉPOUILLÉ|PHASE CLOSE/)?.[0]);
  log("Soumissions reçues:", txt.match(/Soumissions reçues[\s\S]{0,40}/)?.[0]?.replace(/\n/g, " "));
  log("En attente:", txt.match(/En attente · \d+/)?.[0]);

  // ── Étape 2 : clôturer le tour ──
  const closeBtn = page.locator("button", { hasText: "Clôturer le tour" }).last();
  log("Bouton clôture visible:", (await closeBtn.count()) > 0);
  await closeBtn.click();
  await page.waitForTimeout(1500);
  txt = await page.locator("body").innerText();
  log("Dialog affiché:", JSON.stringify(dialogs));
  log("Après clôture — chip:", txt.match(/OUVERT|CLÔTURÉ|DÉPOUILLÉ/)?.[0], "| message:", txt.match(/Tour clôturé[^\n]*|clôtur[^\n]*/i)?.[0]);
  await snap(page, "19-s3-admin-tour-cloture");

  // ── Étape 3 : dépouiller ──
  const resolveBtn = page.locator("button", { hasText: "Lancer le dépouillement" }).last();
  log("Bouton dépouillement visible:", (await resolveBtn.count()) > 0);
  await resolveBtn.click();
  await page.waitForTimeout(2500);
  txt = await page.locator("body").innerText();
  log("Après dépouillement — chip:", txt.match(/OUVERT|CLÔTURÉ|DÉPOUILLÉ/)?.[0]);
  await snap(page, "20-s3-admin-depouille-haut");
  // scroller pour la table de résultats
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await snap(page, "21-s3-admin-depouille-bas");

  // Extraire le bloc résultats pour analyse
  log("=== TEXTE RÉSULTATS (extrait) ===");
  const idx = txt.indexOf("Dépouill");
  console.log(txt.slice(0, 12000));
  log("=== FIN EXTRAIT ===");

  // ── Étape 1 (boucle) : ouvrir le tour 2 ──
  const openBtn = page.locator("button", { hasText: "Ouvrir le tour 2" }).last();
  log("Bouton 'Ouvrir le tour 2' visible:", (await openBtn.count()) > 0);
  if (await openBtn.count()) {
    await openBtn.click();
    await page.waitForTimeout(1500);
    txt = await page.locator("body").innerText();
    log("Après ouverture tour 2 — chip:", txt.match(/OUVERT|CLÔTURÉ|DÉPOUILLÉ/)?.[0], "| tour:", txt.match(/[Tt]our 2/)?.[0]);
    await snap(page, "22-s3-admin-tour2-ouvert");
  }

  log("Dialogs rencontrés:", JSON.stringify(dialogs));
  console.log("[S3] consoleErrors:", JSON.stringify(consoleErrors.slice(0, 8)));
  console.log("[S3] httpErrors:", JSON.stringify(httpErrors.slice(0, 8)));
  await browser.close();
})().catch((e) => { console.error("[S3] CRASH", e); process.exit(1); });
