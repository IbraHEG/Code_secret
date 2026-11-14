/* Vérification facultative de l’interface. Nécessite Playwright + Chromium.
   node tests/browser-check.cjs ; les tests métier n’ont aucune dépendance. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // Code déterministe : quatre rouges, en mode joueur sans API exposée.
    await page.addInitScript(() => { Math.random = () => 0; });
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    const color = c => page.getByRole('button', { name: `Choisir ${c}, symbole`, exact: false });
    const validate = () => page.getByRole('button', { name: 'Valider la proposition' }).click();
    const play = async c => { for (let i = 0; i < 4; i++) await color(c).click(); await validate(); };
    await validate();
    assert.match(await page.locator('#message').innerText(), /quatre couleurs/);
    assert.equal(await page.locator('#history li').count(), 0);
    // Modification avant validation et sélection automatique de la position suivante.
    await color('bleu').click();
    await page.getByRole('button', { name: 'Position 1 : bleu', exact: true }).click();
    await color('rouge').click();
    assert.match(await page.locator('#slots').innerText(), /Rouge/);
    await page.getByRole('button', { name: 'Effacer', exact: true }).click();
    assert.equal(await page.locator('#history li').count(), 0);
    // Clavier : position et couleur, puis changement de position avec les flèches.
    await page.getByRole('button', { name: 'Position 1 : vide' }).focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.getByRole('button', { name: 'Position 2 : vide' }).getAttribute('aria-pressed'), 'true');
    await color('bleu').focus(); await page.keyboard.press('Enter');
    assert.match(await page.locator('#slots').innerText(), /Bleu/);
    await page.getByRole('button', { name: 'Effacer', exact: true }).click();
    for (let i = 0; i < 9; i++) await play('bleu');
    await validate();
    assert.equal(await page.locator('#history li').count(), 9);
    await play('rouge');
    assert.equal(await page.locator('#history li').count(), 10);
    assert.match(await page.locator('#message').innerText(), /Bravo.*10 essais/);
    assert.equal(await page.locator('#submit-guess').isDisabled(), true);
    assert.equal(await color('rouge').isDisabled(), true);
    await page.locator('#submit-guess').evaluate(button => button.click());
    assert.equal(await page.locator('#history li').count(), 10);
    await page.getByRole('button', { name: 'Nouvelle partie' }).click();
    assert.equal(await page.locator('#history li').count(), 0);
    assert.equal(await page.locator('#secret').getAttribute('aria-label'), 'Code secret caché');
    for (let i = 0; i < 10; i++) await play('bleu');
    assert.match(await page.locator('#message').innerText(), /dix essais sont écoulés/);
    assert.equal(await page.locator('#submit-guess').isDisabled(), true);
    await page.getByRole('button', { name: 'Nouvelle partie' }).click();
    await play('bleu');
    const output = path.resolve(__dirname, '../verification');
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, 'ordinateur.png'), fullPage: true, animations: 'disabled' });
    // Écrans étroits, historique et règles ouverts : aucun débordement horizontal.
    for (const width of [320, 375, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Débordement à ${width}px`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true, animations: 'disabled' });
    const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const touchPage = await touchContext.newPage();
    await touchPage.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    for (let i = 0; i < 4; i++) await touchPage.getByRole('button', { name: 'Choisir rouge, symbole' }).tap();
    await touchPage.getByRole('button', { name: 'Valider la proposition' }).tap();
    assert.equal(await touchPage.locator('#history li').count(), 1);
    await touchContext.close();
    assert.deepEqual(errors, []);
    console.log('Interface : saisie, modification, refus, clavier, victoire au dixième, défaite, blocage, redémarrage, tactile simulé et largeurs 320/375/390/768 px : OK.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
