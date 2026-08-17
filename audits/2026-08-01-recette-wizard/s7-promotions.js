// S7 : /admin/promotions ne doit lister que les divisions de saisons NON clôturées.
const { launch, login, shot, report, BASE } = require('./lib');

(async () => {
  const { browser, page, consoleErrors, httpErrors } = await launch();
  await login(page);
  await page.goto(BASE + '/admin/promotions');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  const txt = await page.locator('body').innerText();
  console.log('S7 "TEST Division Fermée" absente:', txt.includes('TEST Division Fermée') ? 'FAIL (présente)' : 'PASS');
  for (const x of ['TEST Ligue A', 'TEST Ligue B', 'TEST Ligue C', 'Ligue Recette Enchères'])
    console.log('S7 présente', x, ':', txt.includes(x) ? 'PASS' : 'FAIL');
  // sections legacy sans saison (tolérées)
  for (const x of ['Ligue 1 (Baudens League)', 'Ligue 2', 'National 1'])
    console.log('S7 legacy (tolérée)', x, ':', txt.includes(x) ? 'présente' : 'absente');
  await shot(page, '11-s7-promotions-etape4.png');
  report('s7', consoleErrors, httpErrors);
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
