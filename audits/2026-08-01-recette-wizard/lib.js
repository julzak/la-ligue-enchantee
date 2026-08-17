// Helpers partagés pour les scripts de recette (jetables).
const { chromium } = require('playwright');
const path = require('path');

const BASE = 'http://localhost:3100';
const DIR = __dirname;

async function launch() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const httpErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('response', (resp) => {
    if (resp.status() >= 400) httpErrors.push(`${resp.status()} ${resp.request().method()} ${resp.url()}`);
  });
  return { browser, context, page, consoleErrors, httpErrors };
}

async function login(page) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto(BASE + '/login');
    await page.waitForLoadState('networkidle');
    // champ identifiant = pseudo
    const user = page.locator('input').first();
    await user.fill('RecetteAdmin');
    await page.locator('input[type="password"]').fill('recette2026');
    await page.getByRole('button', { name: /connexion|connecter|login/i }).click();
    try {
      await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 8000 });
    } catch (e) { /* retry */ }
    await page.waitForLoadState('networkidle');
    // vérifie la session
    const sess = await page.evaluate(async () => {
      const r = await fetch('/api/auth/session');
      return { status: r.status, body: await r.text() };
    });
    if (sess.body && sess.body.includes('RecetteAdmin')) {
      console.log(`login OK (tentative ${attempt})`);
      return;
    }
    console.log(`login KO tentative ${attempt}:`, JSON.stringify(sess).slice(0, 200));
  }
  throw new Error('login impossible après 3 tentatives');
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(DIR, name), fullPage: true });
  console.log('SHOT', name);
}

function report(label, consoleErrors, httpErrors) {
  console.log(`--- ${label} ---`);
  console.log('CONSOLE_ERRORS:', JSON.stringify(consoleErrors, null, 1));
  console.log('HTTP_ERRORS:', JSON.stringify(httpErrors, null, 1));
}

module.exports = { BASE, DIR, launch, login, shot, report };
