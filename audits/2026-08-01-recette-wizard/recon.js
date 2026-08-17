// Reconnaissance : login + dump de /admin/nouvelle-saison et /admin/promotions
const { launch, login, shot, report, BASE } = require('./lib');

(async () => {
  const { browser, page, consoleErrors, httpErrors } = await launch();
  await login(page);
  console.log('URL après login:', page.url());
  await shot(page, '00-recon-apres-login.png');

  await page.goto(BASE + '/admin/nouvelle-saison');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  console.log('=== NOUVELLE-SAISON TEXT ===');
  console.log(await page.locator('body').innerText());
  await shot(page, '00-recon-nouvelle-saison.png');

  console.log('=== BUTTONS ===');
  for (const b of await page.getByRole('button').all()) {
    console.log('BTN:', (await b.innerText()).replace(/\n/g, ' | '));
  }

  await page.goto(BASE + '/admin/promotions');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  console.log('=== PROMOTIONS TEXT ===');
  console.log(await page.locator('body').innerText());
  await shot(page, '00-recon-promotions.png');

  report('recon', consoleErrors, httpErrors);
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
