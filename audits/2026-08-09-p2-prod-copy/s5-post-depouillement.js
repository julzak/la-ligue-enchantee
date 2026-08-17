// S5 — Vues participant après dépouillement (tour 2 ouvert) + tests deadline/clôture
const { chromium } = require("playwright");
const { apiLogin, apiFetch, newPage, snap, BASE } = require("./helpers");

(async () => {
  const browser = await chromium.launch();
  const log = (...a) => console.log("[S5]", ...a);

  // ── Duch : 11 acquis, budget 19 ──
  let cookies = await apiLogin("Duch");
  let { page, context, consoleErrors, httpErrors } = await newPage(browser, cookies, { mobile: true });
  await page.goto(`${BASE}/ligue/ligue-1/encheres`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  let txt = await page.locator("body").innerText();
  log("Duch — tour affiché:", txt.match(/[Tt]our \d+/)?.[0]);
  log("Duch — budget:", txt.match(/(\d+)\s*\n?\s*\/ \d+ pts/)?.[0]?.replace(/\n/g, " "));
  log("Duch — nb ACQUIS:", (txt.match(/ACQUIS/g) || []).length);
  log("Duch — compteurs:", (txt.match(/\d+ \/ \d+/g) || []).join("  "));
  await snap(page, "27-s5-duch-tour2-acquis");
  // Onglet résultats
  const resTab = page.locator("button", { hasText: "Résultats" }).first();
  if (await resTab.count()) {
    await resTab.click();
    await page.waitForTimeout(1200);
    txt = await page.locator("body").innerText();
    log("Duch — résultats: retiré présent:", /RETIRÉ|Retiré|retrait/i.test(txt), "| égalité présent:", /ÉGALITÉ|Égalité/i.test(txt), "| Lees Melou:", txt.includes("Lees Melou"), "| Nicolaisen:", txt.includes("Nicolaisen"));
    await snap(page, "28-s5-duch-resultats-tour1");
  } else {
    log("Duch — PAS d'onglet Résultats");
  }
  await context.close();

  // ── Blek le Roc : tout perdu ──
  cookies = await apiLogin("Blek le Roc");
  ({ page, context } = await newPage(browser, cookies, { mobile: true }));
  await page.goto(`${BASE}/ligue/ligue-1/encheres`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  txt = await page.locator("body").innerText();
  log("Blek — budget:", txt.match(/(\d+)\s*\n?\s*\/ \d+ pts/)?.[0]?.replace(/\n/g, " "), "| nb ACQUIS:", (txt.match(/ACQUIS/g) || []).length);
  await snap(page, "29-s5-blek-tour2");
  const resTab2 = page.locator("button", { hasText: "Résultats" }).first();
  if (await resTab2.count()) {
    await resTab2.click();
    await page.waitForTimeout(1200);
    txt = await page.locator("body").innerText();
    log("Blek — résultats: Coppola retiré:", txt.includes("Coppola"), "| Clauss égalité:", txt.includes("Clauss"));
    await snap(page, "30-s5-blek-resultats");
  }
  await context.close();

  // ── Deadline tolérance zéro (API) ──
  const admin = await apiLogin("Thomas P");
  const past = new Date(Date.now() - 60000).toISOString();
  let r = await apiFetch(admin, "/api/admin/auction", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set-deadline", leagueId: 39, deadline: past }) });
  log("set-deadline passée:", r.status, JSON.stringify(r.json));
  const nico = await apiLogin("Nico B");
  r = await apiFetch(nico, "/api/auction", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leagueId: 39, bids: [{ playerId: 17980, amount: 2 }] }) });
  log("POST après butoir dépassé:", r.status, JSON.stringify(r.json));
  // UI côté participant avec butoir dépassé
  ({ page, context } = await newPage(browser, cookies, { mobile: true })); // Blek cookies
  await page.goto(`${BASE}/ligue/ligue-1/encheres`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  txt = await page.locator("body").innerText();
  log("UI butoir dépassé — footer:", txt.match(/Soumission close|Mise soumise|Soumettre ma mise/)?.[0], "| countdown:", txt.match(/0s|butoir[^\n]*/i)?.[0]);
  await snap(page, "31-s5-butoir-depasse");
  await context.close();
  // retirer le butoir
  r = await apiFetch(admin, "/api/admin/auction", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set-deadline", leagueId: 39, deadline: null }) });
  log("suppression butoir:", r.status, JSON.stringify(r.json));

  // ── Clôture tour 2 puis tentative de mise ──
  r = await apiFetch(admin, "/api/admin/auction", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "close-round", leagueId: 39 }) });
  log("close-round tour 2:", r.status, JSON.stringify(r.json));
  r = await apiFetch(nico, "/api/auction", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leagueId: 39, bids: [{ playerId: 17980, amount: 2 }] }) });
  log("POST sur tour clôturé:", r.status, JSON.stringify(r.json));

  await browser.close();
})().catch((e) => { console.error("[S5] CRASH", e); process.exit(1); });
