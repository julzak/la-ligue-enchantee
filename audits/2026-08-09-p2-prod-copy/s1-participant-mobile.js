// S1 — Parcours participant mobile complet (Duch, ligue-1)
const { chromium } = require("playwright");
const { apiLogin, newPage, snap, BASE } = require("./helpers");

const PLAN = [
  // [searchTerm, expectedName, expectedBadge, amount]
  ["Nicolaisen", "Rasmus Nicolaisen", "DEF", 1],
  ["McKenzie", "Mark McKenzie", "DEF", 10],
  ["Cresswell", "Charlie Cresswell", "DEF", 9],
  ["Chardonnet", "Brendan Chardonnet", "DEF", 8],
  ["Lala", "Kenny Lala", "DEF", 7],
  ["Lees Melou", "Pierre Lees Melou", "MID", 18],
  ["Schmidt", "Niklas Schmidt", "MID", 12],
  ["Tousart", "Lucas Tousart", "MID", 11],
  ["Magnetti", "Hugo Magnetti", "MID", 10],
  ["Abu", "Francis Abu", "MID", 9],
  ["Gboho", "Yann Gboho", "ATT", 15],
  ["Ajorque", "Ludovic Ajorque", "ATT", 10],
  ["Camblan", "Axel Camblan", "ATT", 10],
];

(async () => {
  const browser = await chromium.launch();
  const cookies = await apiLogin("Duch");
  const { page, consoleErrors, httpErrors } = await newPage(browser, cookies, { mobile: true });

  const log = (...a) => console.log("[S1]", ...a);

  await page.goto(`${BASE}/ligue/ligue-1/encheres`, { waitUntil: "networkidle" });
  await snap(page, "01-s1-duch-etat-initial");

  const bodyTxt = await page.locator("body").innerText();
  log("Header contient budget 130:", bodyTxt.includes("130"));
  log("Tour 1 visible:", /tour\s*1/i.test(bodyTxt));

  // Helper: open drawer, search, report results, optionally add
  async function openDrawer() {
    await page.locator("button", { hasText: "Ajouter un joueur" }).first().click();
    await page.waitForSelector('input[placeholder*="Rechercher"]');
  }
  async function closeDrawer() {
    const x = page.locator('div.fixed button:has(svg)').first();
    // click the X in drawer header
    await page.locator('div.fixed >> text=Ajouter un joueur').locator("xpath=following-sibling::button").click().catch(async () => {
      await page.keyboard.press("Escape").catch(() => {});
    });
    await page.waitForTimeout(200);
  }
  async function searchInDrawer(term) {
    if (!(await page.locator('input[placeholder*="Rechercher"]').count())) await openDrawer();
    const input = page.locator('input[placeholder*="Rechercher"]');
    await input.fill("");
    await input.fill(term);
    await page.waitForTimeout(700); // debounce + fetch
  }
  function bidRow(name) {
    return page.locator(`div.rounded-lg:has(input[type="number"]):has-text("${name}")`).last();
  }

  // ── Test A : recherche gardien ──
  await openDrawer();
  await searchInDrawer("Gardiens");
  let txt = await page.locator("div.fixed.inset-0").innerText();
  log("Recherche 'Gardiens' → aucun résultat ?", txt.includes("Aucun joueur libre trouvé"));
  await snap(page, "02-s1-recherche-gardiens-vide");
  await searchInDrawer("Chevalier"); // gardien nommé Lille/PSG
  txt = await page.locator("div.fixed.inset-0").innerText();
  log("Recherche 'Chevalier' (gardien nommé) → aucun résultat ?", txt.includes("Aucun joueur libre trouvé"));
  await searchInDrawer("Marseille"); // recherche par club promise par le placeholder
  txt = await page.locator("div.fixed.inset-0").innerText();
  log("Recherche 'Marseille' (club) → aucun résultat ?", txt.includes("Aucun joueur libre trouvé"));
  await snap(page, "03-s1-recherche-club-marseille");

  // ── Test B : badges de poste vs DB sur une recherche large ──
  await searchInDrawer("ma");
  const rows = await page.locator("div.fixed.inset-0 button:has-text('Ajouter')").evaluateAll((els) =>
    els.map((e) => e.innerText.replace(/\n/g, " | "))
  );
  log("Résultats 'ma' (échantillon badges):");
  rows.slice(0, 15).forEach((r) => log("   ", r));

  // ── Ajouts du plan ──
  for (const [term, name, badge, amount] of PLAN) {
    await searchInDrawer(term);
    const row = page.locator(`div.fixed.inset-0 button`, { hasText: name }).first();
    const found = (await row.count()) > 0;
    if (!found) { log(`FAIL ajout: "${name}" introuvable via "${term}"`); continue; }
    const rowTxt = await row.innerText();
    const badgeOk = rowTxt.includes(badge);
    if (!badgeOk) log(`BADGE MISMATCH pour ${name}: attendu ${badge}, ligne = ${rowTxt.replace(/\n/g, " | ")}`);
    await row.click();
    await page.waitForTimeout(300);
    // drawer closes on add? if still open, close it
    const drawerOpen = await page.locator('input[placeholder*="Rechercher"]').count();
    if (drawerOpen) { await page.locator("div.fixed.inset-0 div.absolute").first().click({ position: { x: 10, y: 10 } }).catch(() => {}); await page.waitForTimeout(200); }
    const numInput = bidRow(name).locator('input[type="number"]');
    if (await numInput.count()) { await numInput.fill(String(amount)); }
    else log(`FAIL: pas de ligne de mise trouvée pour ${name}`);
    await page.waitForTimeout(100);
  }
  await snap(page, "04-s1-13-joueurs-saisis");

  // Vérifier compteurs de ligne et montants
  const pageTxt = await page.locator("body").innerText();
  log("Compteur GK 0/1 présent:", pageTxt.includes("0 / 1"));
  log("Compteur DEF 5/6 présent:", pageTxt.includes("5 / 6"));
  log("Compteur MIL 5/6:", pageTxt.includes("5 / 6"));
  log("Compteur ATT 3/4:", pageTxt.includes("3 / 4"));
  log("Avertissements affichés:", pageTxt.includes("Avertissement"));
  log("Footer:", pageTxt.match(/13 joueurs.*|Mise non conforme.*|Composition conforme.*/)?.[0]);

  // ── Test C : montant 0 ──
  const firstNum = bidRow("Mark McKenzie").locator('input[type="number"]');
  await firstNum.fill("0");
  await page.waitForTimeout(200);
  const v0 = await firstNum.inputValue();
  log("Montant saisi 0 → valeur retenue:", v0);

  // ── Test D : dépassement de budget ──
  await firstNum.fill("60"); // total devient 130-10+60 = 180 > 130
  await page.waitForTimeout(300);
  const overTxt = await page.locator("body").innerText();
  log("Dépassement affiché:", overTxt.includes("dépassement"));
  await snap(page, "05-s1-depassement-budget");
  await firstNum.fill("10");
  await page.waitForTimeout(200);

  // ── Test E : 5e attaquant (dépassement de ligne) ──
  await searchInDrawer("Hidalgo");
  const hRow = page.locator("div.fixed.inset-0 button", { hasText: "Santiago Hidalgo" }).first();
  if (await hRow.count()) {
    await hRow.click(); await page.waitForTimeout(300);
    const t = await page.locator("body").innerText();
    log("ATT 4/4 après ajout Hidalgo:", t.includes("4 / 4"));
    // add 5th
    await searchInDrawer("Russell-Rowe");
    const r2 = page.locator("div.fixed.inset-0 button", { hasText: "Russell-Rowe" }).first();
    if (await r2.count()) { await r2.click(); await page.waitForTimeout(300); }
    const t2 = await page.locator("body").innerText();
    log("ATT 5/4 (rouge) après 5e ATT:", t2.includes("5 / 4"));
    log("Avertissement excès ATT:", /attaquant/i.test(t2));
    await snap(page, "06-s1-exces-attaquants");
    // remove the 2 extra ATT
    for (const nm of ["Santiago Hidalgo", "Jacen Russell-Rowe"]) {
      const rm = bidRow(nm).locator('button[aria-label="Retirer"]');
      if (await rm.count()) await rm.click();
      await page.waitForTimeout(200);
    }
  } else {
    log("Hidalgo introuvable, test 5e ATT sauté");
  }

  // ── Test F : doublon de joueur via UI ──
  await openDrawer();
  await searchInDrawer("Gboho");
  const dupRow = page.locator("div.fixed.inset-0 button", { hasText: "Yann Gboho" });
  const dupCount = await dupRow.count();
  log("Gboho déjà en mise réapparaît dans la recherche ?", dupCount > 0);
  if (dupCount > 0) {
    await dupRow.first().click();
    await page.waitForTimeout(300);
    const nb = await page.locator('span:has-text("Yann Gboho")').count();
    log("Après clic doublon, occurrences Gboho dans la mise:", nb);
  }
  // close drawer if open
  if (await page.locator('input[placeholder*="Rechercher"]').count()) {
    await page.locator("div.fixed.inset-0 div.absolute").first().click({ position: { x: 10, y: 10 } }).catch(() => {});
    await page.waitForTimeout(200);
  }
  await snap(page, "07-s1-avant-soumission");

  // ── Soumission ──
  const state = await page.locator("body").innerText();
  log("Footer avant soumission:", state.match(/(Soumission bloquée[^\n]*|Mise non conforme[^\n]*|Composition conforme[^\n]*)/)?.[0] ?? "(rien)");
  const btn = page.locator("button", { hasText: "Soumettre ma mise" });
  log("Bouton soumission disabled:", await btn.isDisabled());
  if (!(await btn.isDisabled())) {
    await btn.click();
    await page.waitForTimeout(1500);
    const after = await page.locator("body").innerText();
    log("Message post-soumission:", after.match(/(Mise enregistrée[^\n]*|✗[^\n]*)/)?.[0] ?? "(aucun)");
    await snap(page, "08-s1-apres-soumission");
  }

  console.log("[S1] consoleErrors:", JSON.stringify(consoleErrors.slice(0, 10), null, 1));
  console.log("[S1] httpErrors:", JSON.stringify(httpErrors.slice(0, 10), null, 1));
  await browser.close();
})().catch((e) => { console.error("[S1] CRASH", e); process.exit(1); });
