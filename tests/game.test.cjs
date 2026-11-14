const { test } = require('node:test');
const assert = require('node:assert/strict');
const { COLORS, score, createGame } = require('../game.js');
const secret = ['rouge', 'bleu', 'vert', 'jaune'];
const miss = ['violet', 'violet', 'violet', 'violet'];

test('palette exacte, ordre commun et code caché pendant la partie', () => {
  assert.deepEqual(COLORS, ['rouge', 'bleu', 'vert', 'jaune', 'orange', 'violet']);
  const game = createGame(() => 0);
  assert.equal(Object.hasOwn(game.getState(), 'secret'), false);
  assert.equal(game.submit(Array(4).fill('rouge')).state.status, 'won');
});
test('les deux exemples demandés et les deux parties illustrées', () => {
  assert.deepEqual(score(secret, ['rouge', 'vert', 'bleu', 'orange']), { wellPlaced: 1, misplaced: 2 });
  const repeated = ['rouge', 'rouge', 'bleu', 'vert'];
  assert.deepEqual(score(repeated, Array(4).fill('rouge')), { wellPlaced: 2, misplaced: 0 });
  for (const [guess, expected] of [
    [['orange', 'violet', 'rouge', 'bleu'], [0, 2]],
    [['bleu', 'rouge', 'jaune', 'vert'], [0, 4]],
    [['rouge', 'bleu', 'jaune', 'vert'], [2, 2]],
    [secret, [4, 0]],
  ]) assert.deepEqual(Object.values(score(secret, guess)), expected);
  assert.deepEqual(score(repeated, ['rouge', 'bleu', 'rouge', 'vert']), { wellPlaced: 2, misplaced: 2 });
});
test('propositions invalides refusées sans changement de partie', () => {
  const game = createGame(); game.newGame(secret);
  const before = game.getState();
  for (const invalid of [null, {}, 'rouge', [], ['rouge'], Array(4), ['rouge', 'bleu', 'vert', null], ['rouge', 'bleu', 'vert', 'rose'], ['Rouge', 'bleu', 'vert', 'jaune'], [...secret, 'orange']]) {
    const result = game.submit(invalid);
    assert.equal(result.ok, false);
    assert.ok(result.error.length > 0);
    assert.deepEqual({ ...game.getState(), lastError: null }, before);
  }
});
test('victoire au dixième essai prioritaire sur la défaite et blocage après victoire', () => {
  const game = createGame(); game.newGame(secret);
  for (let i = 0; i < 9; i++) assert.equal(game.submit(miss).state.status, 'playing');
  const result = game.submit(secret);
  assert.equal(result.state.status, 'won');
  assert.equal(result.state.attempts, 10);
  assert.equal(result.state.remaining, 0);
  const before = game.getState();
  assert.equal(game.submit(miss).ok, false);
  assert.deepEqual({ ...game.getState(), lastError: null }, before);
});
test('dix échecs, code non divulgué, blocage après défaite', () => {
  const game = createGame(); game.newGame(secret);
  for (let i = 0; i < 10; i++) game.submit(miss);
  const before = game.getState();
  assert.equal(before.status, 'lost');
  assert.equal(Object.hasOwn(before, 'secret'), false);
  assert.equal(game.submit(secret).ok, false);
  assert.deepEqual({ ...game.getState(), lastError: null }, before);
});
test('nouvelle partie réinitialise tous les résultats sans divulgation du secret', () => {
  const game = createGame(() => 0.99999); game.newGame(secret); game.submit(secret);
  assert.deepEqual(game.newGame(), { status: 'playing', attempts: 0, remaining: 10, history: [], lastGuess: null, lastResult: null, lastError: null });
  assert.equal(game.submit(Array(4).fill('violet')).state.status, 'won');
});
test('code fixe, copie des entrées et résultats : pas de modification extérieure', () => {
  const game = createGame(); const input = [...secret]; game.newGame(input); input[0] = 'orange';
  const guess = [...miss]; const result = game.submit(guess); guess[0] = 'rouge';
  result.state.history[0].guess[0] = 'jaune';
  assert.deepEqual(game.getState().history[0].guess, miss);
  assert.equal(game.submit(secret).state.status, 'won');
});
test('tous les 1 679 616 couples secret/proposition : comparaison avec un calcul indépendant', () => {
  const codes = [];
  for (const a of COLORS) for (const b of COLORS) for (const c of COLORS) for (const d of COLORS) codes.push([a,b,c,d]);
  const counts = codes.map(code => COLORS.map(color => code.filter(c => c === color).length));
  for (let a = 0; a < codes.length; a++) for (let b = 0; b < codes.length; b++) {
    const expectedExact = codes[a].reduce((n, c, i) => n + Number(c === codes[b][i]), 0);
    const total = counts[a].reduce((n, c, i) => n + Math.min(c, counts[b][i]), 0);
    const actual = score(codes[a], codes[b]);
    if (actual.wellPlaced !== expectedExact || actual.misplaced !== total - expectedExact) {
      assert.deepEqual(actual, {wellPlaced: expectedExact, misplaced: total - expectedExact}, `${codes[a]} / ${codes[b]}`);
    }
  }
});
