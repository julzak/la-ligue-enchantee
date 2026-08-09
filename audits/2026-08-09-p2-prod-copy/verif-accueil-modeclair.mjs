import { chromium } from "playwright";

const BASE = "http://localhost:3100";
const jar = new Map();
const absorb = (res) => { for (const c of res.headers.getSetCookie()) { const [p] = c.split(";"); const i = p.indexOf("="); if (i > 0) jar.set(p.slice(0, i).trim(), p.slice(i + 1).trim()); } };
const csrfRes = await fetch(`${BASE}/api/auth/csrf`); absorb(csrfRes);
const { csrfToken } = await csrfRes.json();
const cb = await fetch(`${BASE}/api/auth/callback/credentials`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: Array.from(jar).map(([k, v]) => `${k}=${v}`).join("; ") },
  body: new URLSearchParams({ csrfToken, login: "Duch", password: "recette2026", redirect: "false", json: "true" }),
  redirect: "manual",
}); absorb(cb);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addCookies(Array.from(jar).map(([name, value]) => ({ name, value, url: BASE })));
const page = await ctx.newPage();

// 1. Accueil : cartes de raccourci sans lien mort
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
const hrefs = await page.locator("a[href*='/classement']").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
console.log("liens classement accueil :", JSON.stringify([...new Set(hrefs)]));
const dead = hrefs.filter((h) => h.includes("national-1") || h.includes("baudens"));
console.log(dead.length === 0 ? ">> aucun lien mort" : ">> LIENS MORTS: " + dead.join(", "));

// 2. Mode clair : montants visibles sur l'écran de mise
await page.emulateMedia({ colorScheme: "light" });
await page.goto(`${BASE}/ligue/ligue-1/encheres`, { waitUntil: "networkidle" });
await page.evaluate(() => { document.documentElement.setAttribute("data-theme", "light"); localStorage.setItem("theme", "light"); });
await page.waitForTimeout(1200);
await page.screenshot({ path: "audits/2026-08-09-p2-prod-copy/34-encheres-mode-clair.png", fullPage: true });
// contraste effectif du premier montant "pts"
const contrast = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll("span")).filter((e) => /pts$/.test(e.textContent?.trim() ?? ""));
  return els.slice(0, 3).map((e) => {
    const c = getComputedStyle(e).color;
    return e.textContent.trim() + " -> " + c;
  });
});
console.log("couleurs des montants en mode clair :", JSON.stringify(contrast));
await browser.close();
