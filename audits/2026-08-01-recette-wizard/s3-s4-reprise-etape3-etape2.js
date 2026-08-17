// S3 : état etape3 (TEST-SETUP-SANSLIGUE : clubs sans ligue) -> reprise étape 3, formulaire vide, pas d'avertissement
// S4 : état etape2 (TEST-SETUP-VIDE : 0 club) -> reprise étape 2
// La bascule d'état est faite AVANT par le shell.
const { launch, login, shot, report, BASE } = require('./lib');

const MODE = process.argv[2]; // 'etape3' ou 'etape2'

(async () => {
  const { browser, page, consoleErrors, httpErrors } = await launch();
  await login(page);
  await page.goto(BASE + '/admin/nouvelle-saison');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  const txt = await page.locator('body').innerText();
  const wizIdx = txt.indexOf('Créer une nouvelle saison');
  console.log('--- WIZARD TEXT ---');
  console.log(txt.slice(wizIdx, wizIdx + 2200));

  if (MODE === 'etape3') {
    const onStep3 = txt.includes('Configure les divisions de la saison TEST-SETUP-SANSLIGUE');
    console.log('S3 reprise étape 3:', onStep3 ? 'PASS' : 'FAIL');
    const warn = txt.includes('existent déjà');
    console.log('S3 pas d\'avertissement recréation:', warn ? 'FAIL (avertissement présent)' : 'PASS');
    const inputs = await page.locator('input:visible').all();
    const values = [];
    for (const i of inputs) values.push(await i.inputValue());
    console.log('S3 valeurs inputs:', JSON.stringify(values));
    await shot(page, '04-s3-reprise-etape3-sansligue.png');
  } else {
    const onStep2 = /Récupérer les clubs|Récupère les clubs/.test(txt);
    console.log('S4 reprise étape 2:', onStep2 ? 'PASS' : 'FAIL');
    console.log('S4 saison ciblée VIDE:', txt.includes('TEST-SETUP-VIDE') ? 'PASS' : 'FAIL');
    await shot(page, '05-s4-reprise-etape2-vide.png');
  }

  report('s3-s4 ' + MODE, consoleErrors, httpErrors);
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
