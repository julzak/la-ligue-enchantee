// S1 : etape4 -> reprise directe étape 4 avec ligues+participants
// S2 : retour étape 3 (pré-rempli + avertissement) puis retour étape 2
const { launch, login, shot, report, BASE } = require('./lib');

(async () => {
  const { browser, page, consoleErrors, httpErrors } = await launch();
  await login(page);

  // S1
  await page.goto(BASE + '/admin/nouvelle-saison');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  const body = () => page.locator('body').innerText();
  let txt = await body();
  const step4 = txt.includes('Inscris les participants');
  console.log('S1 étape4 directe:', step4 ? 'PASS' : 'FAIL');
  for (const lig of ['TEST Ligue A', 'TEST Ligue B', 'TEST Ligue C'])
    console.log('S1 ligue affichée', lig, ':', txt.includes(lig) ? 'PASS' : 'FAIL');
  for (const j of ['Joueur1', 'Joueur2', 'Joueur3'])
    console.log('S1 participant affiché', j, ':', txt.includes(j) ? 'PASS' : 'FAIL');
  await shot(page, '01-s1-reprise-etape4.png');

  // S2a : retour étape 3
  await page.getByRole('button', { name: /Étape 3/ }).click();
  await page.waitForTimeout(2000);
  txt = await body();
  console.log('--- ÉTAPE 3 TEXT (extrait) ---');
  const idx = txt.indexOf('Ligues');
  console.log(txt.slice(Math.max(0, idx - 200), idx + 2500));
  // formulaire pré-rempli ?
  const inputs = await page.locator('input:visible').all();
  const values = [];
  for (const i of inputs) values.push(await i.inputValue());
  console.log('S2 valeurs inputs étape 3:', JSON.stringify(values));
  const prefilled = values.join('|');
  for (const lig of ['TEST Ligue A', 'TEST Ligue B', 'TEST Ligue C'])
    console.log('S2 formulaire pré-rempli', lig, ':', (prefilled.includes(lig) || txt.includes(lig)) ? 'PASS' : 'FAIL');
  const warn = /efface|écrase|supprim|inscriptions/i.test(txt);
  console.log('S2 avertissement recréation présent:', warn ? 'PASS' : 'FAIL');
  await shot(page, '02-s2-retour-etape3.png');
  console.log('--- boutons étape 3 ---');
  for (const b of await page.getByRole('button').all())
    console.log('BTN:', (await b.innerText()).replace(/\n/g, ' '));

  // S2b : retour étape 2
  const btn2 = page.getByRole('button', { name: /Étape 2/ });
  if (await btn2.count()) {
    await btn2.first().click();
    await page.waitForTimeout(2000);
    txt = await body();
    console.log('--- ÉTAPE 2 TEXT (extrait) ---');
    const i2 = txt.indexOf('Créer une nouvelle saison');
    console.log(txt.slice(i2, i2 + 1500));
    await shot(page, '03-s2-retour-etape2.png');
  } else {
    console.log('S2 FAIL: pas de bouton "← Étape 2" à l\'étape 3');
  }

  report('s1-s2', consoleErrors, httpErrors);
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
