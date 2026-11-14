/* Contrat public vérifié dans un vrai navigateur, sous /jeu/ comme GitHub Pages.
   Outil de développement facultatif : Playwright + navigateur déjà installés. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const allowed = { 'index.html': 'text/html', 'app.js': 'text/javascript', 'game.js': 'text/javascript', 'styles.css': 'text/css' };
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = pathname === '/jeu/' ? 'index.html' : pathname.replace(/^\/jeu\//, '');
    if (!Object.hasOwn(allowed, file)) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', `${allowed[file]}; charset=utf-8`);
    res.end(fs.readFileSync(path.resolve(__dirname, '..', file)));
  });
  if (!process.env.MASTERMIND_URL) await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
    const page = await browser.newPage();
    const errors = [], externalRequests = [];
    const baseURL = new URL(process.env.MASTERMIND_URL || `http://127.0.0.1:${server.address().port}/jeu/`);
    const origin = baseURL.origin;
    const address = query => {
      const url = new URL(baseURL);
      url.searchParams.delete('test');
      for (const [key, value] of new URLSearchParams(query)) url.searchParams.set(key, value);
      return url.href;
    };
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (!request.url().startsWith(origin)) externalRequests.push(request.url()); });
    const call = (method, ...args) => page.evaluate(({ method, args }) => window.codeSecretTest[method](...args), { method, args });
    const red = Array(4).fill('rouge'), blue = Array(4).fill('bleu');
    const unique = ['rouge', 'bleu', 'vert', 'jaune'], repeated = ['rouge', 'rouge', 'bleu', 'vert'];
    const withoutError = state => ({ ...state, lastError: null });
    const snapshot = () => page.locator('main').innerHTML();
    async function matchesScreen(state) {
      assert.equal(await page.locator('#history li').count(), state.attempts);
      assert.equal(await page.locator('#history-count').innerText(), `${state.attempts} / 10`);
      assert.equal(await page.locator('#submit-guess').isDisabled(), state.status !== 'playing');
      const rows = await page.locator('#history li').evaluateAll(nodes => nodes.map(node => ({
        colors: Array.from(node.querySelectorAll('.color-name'), el => el.textContent.toLowerCase()),
        indices: Array.from(node.querySelectorAll('.indices strong'), el => Number(el.textContent)),
      })));
      assert.deepEqual(rows, state.history.map(row => ({ colors: row.guess, indices: [row.result.wellPlaced, row.result.misplaced] })));
      assert.equal(await page.locator('#secret').getAttribute('aria-label'), 'Code secret caché');
      assert.equal(await page.locator('#secret .color-name').count(), 0);
      assert.equal(Object.hasOwn(state, 'secret'), false); assert.equal(Object.hasOwn(state, 'solution'), false);
    }
    for (const query of ['', '?test=0', '?test=true', '?autre=1']) {
      await page.goto(address(query));
      assert.equal(await page.evaluate(() => typeof window.codeSecretTest), 'undefined');
      assert.equal(await page.locator('#submit-guess').isDisabled(), false);
    }
    await page.goto(address('?autre=conserve&test=1'));
    await page.waitForFunction(() => window.codeSecretTest);
    assert.equal(await page.evaluate(() => window.codeSecretTest.version), '0.2');
    assert.deepEqual(await call('getConfig'), { apiVersion: '0.2', rulesVersion: 'code-couleurs-1.0', secretLength: 4, maxAttempts: 10, allowDuplicates: true, colors: ['rouge', 'bleu', 'vert', 'jaune', 'orange', 'violet'] });
    let state = await call('getState');
    assert.deepEqual(state, { status: 'not-started', attempts: 0, remaining: 10, history: [], lastGuess: null, lastResult: null, lastError: null });
    await matchesScreen(state);
    state = await call('submitGuess', null);
    assert.equal(state.lastError.code, 'game-not-started'); await matchesScreen(state);
    // Les signatures synchrones et async sont vérifiées dans le contexte JS du jeu.
    assert.equal(await page.evaluate(async () => {
      const api = window.codeSecretTest;
      const start = api.startGame(); const startIsPromise = start instanceof Promise; await start;
      const submit = api.submitGuess([]); const submitIsPromise = submit instanceof Promise; await submit;
      return startIsPromise && submitIsPromise && !(api.getState() instanceof Promise) && !(api.getConfig() instanceof Promise);
    }), true);
    const fixtures = [
      [unique, ['rouge', 'vert', 'bleu', 'orange'], 1, 2], [unique, ['orange', 'violet', 'rouge', 'bleu'], 0, 2],
      [unique, ['bleu', 'rouge', 'jaune', 'vert'], 0, 4], [unique, ['rouge', 'bleu', 'jaune', 'vert'], 2, 2],
      [unique, unique, 4, 0], [repeated, red, 2, 0], [repeated, ['rouge', 'bleu', 'rouge', 'vert'], 2, 2],
      [repeated, repeated, 4, 0], [repeated, ['rouge', 'bleu', 'rouge', 'rouge'], 1, 2],
    ];
    for (const [secret, guess, wellPlaced, misplaced] of fixtures) {
      await matchesScreen(await call('startGame', { secret }));
      state = await call('submitGuess', guess);
      assert.equal(state.attempts, 1);
      assert.equal(state.status, wellPlaced === 4 ? 'won' : 'playing');
      assert.deepEqual(state.lastResult, { wellPlaced, misplaced });
      assert.deepEqual(state.lastGuess, guess); assert.equal(state.lastError, null);
      await matchesScreen(state);
    }
    // Scénario exact de la grille d’évaluation : API → interface → API.
    await call('startGame', { secret: repeated });
    state = await call('submitGuess', ['rouge', 'bleu', 'rouge', 'vert']);
    assert.deepEqual(state.lastResult, { wellPlaced: 2, misplaced: 2 });
    assert.equal(state.attempts, 1); await matchesScreen(state);
    // Refus provoqué dans l’interface, relu dans la véritable partie de l’API.
    await page.getByRole('button', { name: 'Valider la proposition' }).click();
    const refusedInUi = await call('getState');
    assert.equal(refusedInUi.lastError.code, 'invalid-type');
    assert.deepEqual(withoutError(refusedInUi), state);
    assert.equal(await page.locator('#message').innerText(), refusedInUi.lastError.message);
    // Proposition complète saisie au clavier, y compris modification d’un choix.
    for (const color of ['bleu', 'rouge', 'bleu', 'vert']) {
      await page.getByRole('button', { name: `Choisir ${color}, symbole` }).focus();
      await page.keyboard.press('Space');
    }
    await page.getByRole('button', { name: 'Position 1 : bleu', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Choisir rouge, symbole' }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Valider la proposition' }).focus();
    await page.keyboard.press('Enter');
    state = await call('getState');
    assert.equal(state.status, 'won'); assert.equal(state.attempts, 2);
    assert.deepEqual(state.lastGuess, repeated); assert.equal(state.lastError, null);
    await matchesScreen(state);
    const finishedInUi = await call('submitGuess', null);
    assert.equal(finishedInUi.lastError.code, 'game-finished');
    assert.deepEqual(withoutError(finishedInUi), state);
    await page.getByRole('button', { name: 'Nouvelle partie' }).click();
    await matchesScreen(await call('getState'));
    await call('startGame', { secret: red });
    // Même partie dans les deux sens : API → écran puis commandes tactiles/clavier → API.
    await call('submitGuess', blue);
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Choisir rouge, symbole' }).click();
    await page.getByRole('button', { name: 'Valider la proposition' }).click();
    state = await call('getState'); assert.equal(state.status, 'won'); assert.equal(state.attempts, 2);
    assert.deepEqual(state.lastGuess, red); await matchesScreen(state);
    await page.getByRole('button', { name: 'Nouvelle partie' }).click();
    state = await call('getState'); assert.equal(state.status, 'playing'); assert.equal(state.attempts, 0);
    await matchesScreen(state);
    // Invalidations : priorités, message visible, état de jeu conservé.
    const validation = await page.evaluate(async () => {
      const api = window.codeSecretTest;
      await api.startGame({ secret: ['rouge','rouge','rouge','rouge'] });
      const baseline = api.getState();
      const values = [null, ['rouge', null], Array(4), ['rouge'], ['rose'], ['rouge','bleu','vert','Violet'], ['rouge','bleu','vert','violet ']];
      const codes = ['invalid-type','invalid-type','invalid-type','invalid-length','invalid-length','invalid-color','invalid-color'];
      const output = [];
      for (let i = 0; i < values.length; i++) {
        const state = await api.submitGuess(values[i]);
        output.push({ actual: state.lastError.code, expected: codes[i], message: state.lastError.message,
          visible: document.getElementById('message').textContent, unchanged: JSON.stringify({ ...state, lastError: null }) === JSON.stringify(baseline) });
      }
      return output;
    });
    for (const check of validation) { assert.equal(check.actual, check.expected); assert.ok(check.message); assert.equal(check.visible, check.message); assert.equal(check.unchanged, true); }
    // startGame invalide : vraie Error rejetée, état ET DOM intacts.
    const invalidStarts = await page.evaluate(async () => {
      const api = window.codeSecretTest;
      const values = [null, [], 'x', new Date(), { extra: true, secret: null }, { secret: undefined }, { secret: null }, { secret: Array(4) }, { secret: ['rouge',null] }, { secret: ['rouge'] }, { secret: ['rouge','rouge','rouge','rose'] }];
      const codes = ['invalid-options','invalid-options','invalid-options','invalid-options','invalid-options','invalid-type','invalid-type','invalid-type','invalid-type','invalid-length','invalid-color'];
      const before = JSON.stringify(api.getState()), dom = document.querySelector('main').innerHTML;
      const results = [];
      for (let i = 0; i < values.length; i++) {
        try { await api.startGame(values[i]); results.push(false); }
        catch (error) { results.push(error instanceof Error && error.code === codes[i] && !!error.message && before === JSON.stringify(api.getState()) && dom === document.querySelector('main').innerHTML); }
      }
      return results;
    });
    assert.ok(invalidStarts.every(Boolean));
    for (const win of [true, false]) {
      await call('startGame', { secret: red });
      for (let i = 0; i < 9; i++) await call('submitGuess', blue);
      state = await call('submitGuess', ['rouge']); assert.equal(state.lastError.code, 'invalid-length'); assert.equal(state.attempts, 9);
      await matchesScreen(state);
      state = await call('submitGuess', win ? red : blue);
      assert.equal(state.status, win ? 'won' : 'lost'); assert.equal(state.attempts, 10);
      assert.equal(state.lastError, null); await matchesScreen(state);
      const finished = state;
      for (const guess of [null, red]) {
        state = await call('submitGuess', guess); assert.equal(state.lastError.code, 'game-finished');
        assert.deepEqual(withoutError(state), finished); await matchesScreen(state);
      }
      await call('startGame', {}); state = await call('getState');
      assert.equal(state.lastGuess, null); assert.equal(state.lastResult, null); assert.equal(state.lastError, null);
      await matchesScreen(state);
    }
    assert.equal(await page.evaluate(async () => {
      const api = window.codeSecretTest;
      const config = api.getConfig(); config.colors[0] = 'rose'; config.maxAttempts = 99;
      const secret = ['rouge','rouge','rouge','rouge']; await api.startGame({ secret }); secret[0] = 'bleu';
      const guess = ['bleu','bleu','bleu','bleu']; const result = await api.submitGuess(guess); guess[0] = 'rouge';
      result.history[0].guess[0] = 'violet'; result.history[0].result.wellPlaced = 99;
      result.lastGuess[0] = 'vert'; result.lastResult.misplaced = 99;
      await api.submitGuess(null);
      const before = JSON.stringify(api.getState()), dom = document.querySelector('main').innerHTML;
      const copy = api.getState(); copy.lastError.code = 'modifié'; copy.history.length = 0;
      const pure = before === JSON.stringify(api.getState()) && dom === document.querySelector('main').innerHTML;
      const correct = api.getState().history[0].guess.every(c => c === 'bleu') && api.getConfig().colors[0] === 'rouge' && api.getConfig().maxAttempts === 10;
      const won = (await api.submitGuess(['rouge','rouge','rouge','rouge'])).status === 'won';
      return pure && correct && won;
    }), true);
    // Redémarrer efface le brouillon visible ; un départ invalide le préserve.
    await call('startGame', { secret: red });
    await page.getByRole('button', { name: 'Choisir vert, symbole' }).click();
    const draftBefore = await snapshot();
    const rejected = await page.evaluate(async () => { try { await window.codeSecretTest.startGame({ secret: null }); return false; } catch { return true; } });
    assert.equal(rejected, true); assert.equal(await snapshot(), draftBefore);
    await call('startGame'); assert.equal(await page.locator('#slots .color-name').allTextContents().then(names => names.every(n => n === 'Choisir')), true);
    await page.reload(); await page.waitForFunction(() => window.codeSecretTest);
    assert.equal((await call('getState')).status, 'not-started');
    await matchesScreen(await call('getState'));
    assert.deepEqual(errors, []); assert.deepEqual(externalRequests, []);
    console.log(`Navigateur : Microsoft Edge/Chromium ${browser.version()}.`);
    console.log(`Cible vérifiée : ${baseURL.href}`);
    console.log('API publique 0.2 : présence conditionnelle, signatures, T01–T09, erreurs et priorités, démarrages atomiques, copies, getters, cycle de vie, rechargement et synchronisation API/interface : OK. Aucun appel externe au site du jeu.');
    console.log('Grille évaluation 1.3 : scénario API 2/2, refus dans l’interface sans consommation, proposition complète et modification au clavier, victoire puis redémarrage reflétés dans l’API : OK.');
  } finally {
    if (browser) await browser.close();
    if (server.listening) await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
