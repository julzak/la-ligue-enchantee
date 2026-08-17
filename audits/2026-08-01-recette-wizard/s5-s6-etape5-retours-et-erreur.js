// S5 : état etape5 (TEST-SETUP-2027 AUCTION) -> reprise étape 5, boutons "← Étape 4 (participants)" et "← Étape 2",
//      retour étape 4 recharge les participants.
// S6 : depuis l'étape 3 (via retours), cliquer "Créer les ligues" alors que les enchères sont ouvertes
//      -> message d'erreur lisible en français, pas de "JSON.parse".
const { launch, login, shot, report, BASE } = require('./lib');

(async () => {
  const { browser, page, consoleErrors, httpErrors } = await launch();
  const apiResponses = [];
  page.on('response', async (resp) => {
    if (resp.url().includes('/api/') && resp.request().method() !== 'GET') {
      let body = '';
      try { body = await resp.text(); } catch (e) {}
      apiResponses.push(`${resp.status()} ${resp.request().method()} ${resp.url()} BODY=${body.slice(0, 300)}`);
    }
  });
  await login(page);
  await page.goto(BASE + '/admin/nouvelle-saison');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  const body = () => page.locator('body').innerText();
  let txt = await body();
  const wiz = txt.slice(txt.indexOf('Créer une nouvelle saison'));
  console.log('--- WIZARD ÉTAPE 5 ---');
  console.log(wiz.slice(0, 1500));
  console.log('S5 reprise étape 5:', /ench/i.test(wiz) && wiz.includes('TEST-SETUP-2027') ? 'CHECK-TEXT-ABOVE' : 'CHECK-TEXT-ABOVE');
  const btn4 = page.getByRole('button', { name: /Étape 4/ });
  const btn2 = page.getByRole('button', { name: /Étape 2/ });
  console.log('S5 bouton "← Étape 4 (participants)":', (await btn4.count()) ? 'PASS' : 'FAIL');
  console.log('S5 bouton "← Étape 2":', (await btn2.count()) ? 'PASS' : 'FAIL');
  await shot(page, '06-s5-reprise-etape5.png');

  // retour étape 4
  if (await btn4.count()) {
    await btn4.first().click();
    await page.waitForTimeout(2500);
    txt = await body();
    console.log('S5 étape 4 affichée:', txt.includes('Inscris les participants') ? 'PASS' : 'FAIL');
    for (const x of ['TEST Ligue A', 'TEST Ligue B', 'TEST Ligue C', 'Joueur1', 'Joueur2', 'Joueur3'])
      console.log('S5 rechargé', x, ':', txt.includes(x) ? 'PASS' : 'FAIL');
    await shot(page, '07-s5-retour-etape4-participants.png');
  }

  // S6 : étape 3 puis "Créer les ligues" (interdit en AUCTION)
  const btn3 = page.getByRole('button', { name: /Étape 3/ });
  if (await btn3.count()) {
    await btn3.first().click();
    await page.waitForTimeout(2000);
    await shot(page, '08-s6-etape3-avant-creation.png');
    const create = page.getByRole('button', { name: /Créer les ligues/ });
    console.log('S6 bouton "Créer les ligues" présent:', (await create.count()) ? 'oui' : 'NON');
    if (await create.count()) {
      await create.first().click();
      await page.waitForTimeout(3000);
      txt = await body();
      const wiz3 = txt.slice(txt.indexOf('Créer une nouvelle saison'));
      console.log('--- APRÈS CLIC CRÉER (texte wizard) ---');
      console.log(wiz3.slice(0, 2000));
      console.log('S6 contient "JSON.parse":', txt.includes('JSON.parse') ? 'FAIL' : 'PASS (absent)');
      await shot(page, '09-s6-message-erreur.png');
    }
  } else {
    console.log('S6 impossible: pas de bouton Étape 3 depuis étape 4');
  }

  console.log('--- API RESPONSES (non-GET) ---');
  apiResponses.forEach((r) => console.log(r));
  report('s5-s6', consoleErrors, httpErrors);
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
