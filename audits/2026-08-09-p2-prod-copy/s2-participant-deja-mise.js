// S2 — Vue participant ayant déjà misé (Shima / Jay, 12 mises réelles) + modification
const { chromium } = require("playwright");
const { apiLogin, newPage, snap, BASE } = require("./helpers");

(async () => {
  const browser = await chromium.launch();
  const cookies = await apiLogin("Shima / Jay");
  const { page, consoleErrors, httpErrors } = await newPage(browser, cookies, { mobile: true });
  const log = (...a) => console.log("[S2]", ...a);

  await page.goto(`${BASE}/ligue/ligue-1/encheres`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await snap(page, "09-s2-shima-mises-existantes");

  const txt = await page.locator("body").innerText();
  // Ses 12 mises doivent apparaître pré-chargées
  const expected = ["Pierre Lees Melou", "Aron Dönnum", "Melvin Bard", "Youssouf Ndayishimiye", "Montassar Talbi", "Mohamed Ali Cho", "Hicham Boudaoui", "Romain Del Castillo", "Ismaël Doukouré", "Laurent Abergel", "Clement Akpa", "Isak Jansson"];
  const missing = expected.filter((n) => !txt.includes(n));
  log("12 mises affichées ?", missing.length === 0, missing.length ? "manquants: " + missing.join(", ") : "");
  log("Budget/total affiché:", txt.match(/(-?\d+)\s*\/\s*130 pts/)?.[0] ?? "(introuvable)");
  log("Footer:", txt.match(/(Mise soumise[^\n]*|Composition conforme[^\n]*|Mise non conforme[^\n]*|\d+ \/ 13 joueurs[^\n]*)/)?.[0] ?? "(rien)");
  log("Compteurs:", (txt.match(/\d+ \/ \d+/g) || []).join("  "));

  // Modification : Dönnum 15 → 16, resoumettre
  const row = page.locator(`div.rounded-lg:has(input[type="number"]):has-text("Aron Dönnum")`).last();
  if (await row.count()) {
    await row.locator('input[type="number"]').fill("16");
    await page.waitForTimeout(300);
    const btn = page.locator("button", { hasText: "Soumettre ma mise" });
    log("Bouton re-soumission disabled:", await btn.isDisabled());
    await btn.click();
    await page.waitForTimeout(1500);
    const t2 = await page.locator("body").innerText();
    log("Après modif:", t2.match(/(Mise enregistrée[^\n]*|✗[^\n]*)/)?.[0] ?? "(aucun message)");
    await snap(page, "10-s2-shima-apres-modif");
  } else {
    log("FAIL: ligne Dönnum non éditable / introuvable — les mises existantes ne sont peut-être pas rechargées en draft");
    await snap(page, "10-s2-shima-pas-de-ligne-editable");
  }

  console.log("[S2] consoleErrors:", JSON.stringify(consoleErrors.slice(0, 5)));
  console.log("[S2] httpErrors:", JSON.stringify(httpErrors.slice(0, 5)));
  await browser.close();
})().catch((e) => { console.error("[S2] CRASH", e); process.exit(1); });
