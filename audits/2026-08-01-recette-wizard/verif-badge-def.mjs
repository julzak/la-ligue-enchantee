import { chromium } from "playwright";

const BASE = "http://localhost:3100";
const jar = new Map();
const absorb = (res) => { for (const c of res.headers.getSetCookie()) { const [p] = c.split(";"); const i = p.indexOf("="); if (i > 0) jar.set(p.slice(0, i).trim(), p.slice(i + 1).trim()); } };
const cookie = () => Array.from(jar).map(([k, v]) => `${k}=${v}`).join("; ");

// Login admin pour ouvrir un tour, puis Joueur1 pour le parcours participant.
async function login(name) {
  jar.clear();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`); absorb(csrfRes);
  const { csrfToken } = await csrfRes.json();
  const cb = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: cookie() },
    body: new URLSearchParams({ csrfToken, login: name, password: "recette2026", redirect: "false", json: "true" }),
    redirect: "manual",
  }); absorb(cb);
  const sess = await (await fetch(`${BASE}/api/auth/session`, { headers: { cookie: cookie() } })).json();
  if (!sess?.user?.userId) throw new Error("login failed " + name);
}

await login("RecetteAdmin");
const open = await fetch(`${BASE}/api/admin/auction`, {
  method: "POST",
  headers: { "Content-Type": "application/json", cookie: cookie() },
  body: JSON.stringify({ action: "open", leagueId: 24 }),
});
console.log("ouverture tour recette : HTTP " + open.status);

await login("Joueur1");
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addCookies(Array.from(jar).map(([name, value]) => ({ name, value, url: BASE })));
const page = await ctx.newPage();
await page.goto(`${BASE}/ligue/ligue-recette-encheres/encheres`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// Ouvrir le drawer de recherche et chercher un défenseur de la fixture
await page.screenshot({ path: "audits/2026-08-01-recette-wizard/16a-etat-page.png", fullPage: true }); const bodyTxt = await page.locator("body").innerText(); console.log("page contient:", JSON.stringify(bodyTxt.slice(0, 400))); await page.getByText("Ajouter un joueur").first().click();
await page.waitForTimeout(400);
await page.locator("input[placeholder*='Rechercher']").fill("Girard");
await page.waitForTimeout(1200);
const rowText = await page.locator("button:has-text('Girard')").first().innerText().catch(() => "INTROUVABLE");
console.log("résultat recherche Girard (Défense en base) :", JSON.stringify(rowText.replace(/\n/g, " | ")));
await page.screenshot({ path: "audits/2026-08-01-recette-wizard/16-badge-def-apres-fix.png", fullPage: true });
console.log("badge DEF présent :", /DEF/.test(rowText), "| badge ATT absent :", !/ATT/.test(rowText));
await browser.close();
