import { chromium } from "playwright";

const BASE = "http://localhost:3100";
const jar = new Map();
const absorb = (res) => { for (const c of res.headers.getSetCookie()) { const [p] = c.split(";"); const i = p.indexOf("="); if (i > 0) jar.set(p.slice(0, i).trim(), p.slice(i + 1).trim()); } };
const csrfRes = await fetch(`${BASE}/api/auth/csrf`); absorb(csrfRes);
const { csrfToken } = await csrfRes.json();
const cb = await fetch(`${BASE}/api/auth/callback/credentials`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: Array.from(jar).map(([k, v]) => `${k}=${v}`).join("; ") },
  body: new URLSearchParams({ csrfToken, login: "RecetteAdmin", password: "recette2026", redirect: "false", json: "true" }),
  redirect: "manual",
}); absorb(cb);

const browser = await chromium.launch();
const ctx = await browser.newContext();
await ctx.addCookies(Array.from(jar).map(([name, value]) => ({ name, value, url: BASE })));
const page = await ctx.newPage();
await page.goto(`${BASE}/admin/nouvelle-saison`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const text = await page.locator("main").innerText().catch(() => page.locator("body").innerText());
const stepMatch = text.match(/ÉTAPE \d|Étape \d|Enchères ouvertes/gi);
console.log("marqueurs d'étape trouvés :", JSON.stringify([...new Set(stepMatch || [])]));
console.log("mention 'enchères' :", /ench/i.test(text));
await page.screenshot({ path: "audits/2026-08-01-recette-wizard/15-resume-etape5-apres-fix.png", fullPage: true });
console.log("screenshot -> audits/2026-08-01-recette-wizard/15-resume-etape5-apres-fix.png");
await browser.close();
