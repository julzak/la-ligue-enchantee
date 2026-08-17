// S9 : si le GET initial des saisons échoue (réseau), la page doit montrer une erreur lisible,
// pas un faux état "Aucune saison" à l'étape 1. Reproduit le comportement observé lors d'un run flaky.
const { launch, login, shot, report, BASE } = require('./lib');

(async () => {
  const { browser, page, consoleErrors, httpErrors } = await launch();
  await login(page);

  const aborted = [];
  await page.route('**/api/admin/seasons**', (route) => {
    if (route.request().method() === 'GET') {
      aborted.push(route.request().url());
      return route.abort('failed');
    }
    return route.continue();
  });

  await page.goto(BASE + '/admin/nouvelle-saison');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500);
  console.log('Requêtes GET avortées:', JSON.stringify(aborted));
  const txt = await page.locator('body').innerText();
  const wiz = txt.slice(txt.indexOf('Démarrer une nouvelle saison'), txt.indexOf('Démarrer une nouvelle saison') + 1200);
  console.log('--- PAGE ---');
  console.log(wiz);
  const fakeEmpty = txt.includes('Aucune saison');
  const readableError = /erreur|impossible|réessayer|échec|indisponible/i.test(txt);
  console.log('S9 faux état "Aucune saison" affiché:', fakeEmpty ? 'OUI (bug)' : 'non');
  console.log('S9 message d\'erreur lisible affiché:', readableError ? 'OUI' : 'NON (bug si fetch avorté)');
  await shot(page, '10-s9-fetch-saisons-avorte.png');

  report('s9', consoleErrors, httpErrors);
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
