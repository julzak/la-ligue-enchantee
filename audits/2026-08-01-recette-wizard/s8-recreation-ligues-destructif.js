// S8 (DESTRUCTIF, en dernier) : état etape4, retour étape 3, re-clic "Créer les ligues"
// -> les ligues sont remplacées et les inscriptions effacées (comportement annoncé par l'avertissement).
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

  // retour étape 3
  await page.getByRole('button', { name: /Étape 3/ }).first().click();
  await page.waitForTimeout(2000);
  let txt = await body();
  console.log('S8 avertissement présent avant clic:', txt.includes('efface les inscriptions') ? 'PASS' : 'FAIL');
  await shot(page, '12-s8-etape3-avertissement.png');

  await page.getByRole('button', { name: /Créer les ligues/ }).first().click();
  await page.waitForTimeout(3000);
  txt = await body();
  const wiz = txt.slice(txt.indexOf('Créer une nouvelle saison'));
  console.log('--- APRÈS CLIC ---');
  console.log(wiz.slice(0, 1200));
  await shot(page, '13-s8-apres-recreation.png');

  // aller à l'étape 4 voir les participants
  const next = page.getByRole('button', { name: /inscrire les participants/ });
  if (await next.count()) {
    await next.first().click();
    await page.waitForTimeout(2500);
    txt = await body();
    const wiz4 = txt.slice(txt.indexOf('Créer une nouvelle saison'));
    console.log('--- ÉTAPE 4 APRÈS RECRÉATION ---');
    console.log(wiz4.slice(0, 1500));
    for (const j of ['Joueur1', 'Joueur2', 'Joueur3']) {
      const idx = wiz4.indexOf(j);
      // Joueur1 peut apparaître dans la liste déroulante des comptes ; on vérifie les inscriptions via DB ensuite.
      console.log(`S8 ${j} encore visible dans le wizard:`, idx >= 0 ? 'oui (voir contexte)' : 'non');
    }
    await shot(page, '14-s8-etape4-participants-vides.png');
  } else {
    console.log('S8: pas de bouton "Étape suivante : inscrire les participants"');
  }

  console.log('--- API RESPONSES ---');
  apiResponses.forEach((r) => console.log(r));
  report('s8', consoleErrors, httpErrors);
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
