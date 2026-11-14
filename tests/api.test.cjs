const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createGame } = require('../game.js');
const red = Array(4).fill('rouge');
const blue = Array(4).fill('bleu');
const fresh = () => createGame(() => 0, { autoStart: false });
const withoutError = state => ({ ...state, lastError: null });

test('contrat 0.2 : not-started et priorité des refus de cycle de vie', () => {
  const game = fresh();
  assert.deepEqual(game.getState(), { status: 'not-started', attempts: 0, remaining: 10, history: [], lastGuess: null, lastResult: null, lastError: null });
  assert.equal(game.submit(null).state.lastError.code, 'game-not-started');
  game.startGame({ secret: red }); game.submit(red);
  assert.equal(game.submit(null).state.lastError.code, 'game-finished');
});

test('contrat 0.2 : type dense, longueur, puis couleur ; aucun essai consommé', () => {
  const game = fresh(); game.startGame({ secret: red }); game.submit(blue);
  const before = game.getState();
  const inherited = Array(4); Object.setPrototypeOf(inherited, Object.assign(Object.create(Array.prototype), red));
  const cases = [
    [undefined, 'invalid-type'], [null, 'invalid-type'], [{}, 'invalid-type'], ['rouge', 'invalid-type'],
    [Array(4), 'invalid-type'], [inherited, 'invalid-type'], [['rouge', null], 'invalid-type'],
    [['rouge', 1, false, undefined, 'violet'], 'invalid-type'],
    [[], 'invalid-length'], [['rouge'], 'invalid-length'], [['rose'], 'invalid-length'],
    [[...red, 'rouge'], 'invalid-length'],
    [Array(4).fill('Violet'), 'invalid-color'], [Array(4).fill('violet '), 'invalid-color'],
    [Array(4).fill('purple'), 'invalid-color'], [Array(4).fill(''), 'invalid-color'],
  ];
  for (const [guess, code] of cases) {
    const state = game.submit(guess).state;
    assert.equal(state.lastError.code, code);
    assert.ok(state.lastError.message.length);
    assert.deepEqual(withoutError(state), before);
  }
  assert.equal(game.submit(blue).state.lastError, null);
});

test('contrat 0.2 : démarrage invalide atomique, codes et priorité des options', () => {
  const game = fresh(); game.startGame({ secret: red }); game.submit(blue); game.submit(null);
  const before = game.getState();
  const cases = [
    [null, 'invalid-options'], [[], 'invalid-options'], ['x', 'invalid-options'], [12, 'invalid-options'],
    [() => {}, 'invalid-options'], [new Date(), 'invalid-options'], [new (class Options {})(), 'invalid-options'],
    [{ unknown: 1, secret: null }, 'invalid-options'], [{ [Symbol('x')]: true }, 'invalid-options'],
    [{ secret: undefined }, 'invalid-type'], [{ secret: null }, 'invalid-type'], [{ secret: Array(4) }, 'invalid-type'],
    [{ secret: ['rouge', null] }, 'invalid-type'], [{ secret: ['rouge'] }, 'invalid-length'],
    [{ secret: Array(4).fill('Rouge') }, 'invalid-color'],
  ];
  for (const [options, code] of cases) {
    assert.throws(() => game.startGame(options), error => error instanceof Error && error.code === code && error.message.length > 0);
    assert.deepEqual(game.getState(), before);
  }
  for (const options of [undefined, {}, Object.create(null), { secret: red }]) {
    const state = game.startGame(options);
    assert.equal(state.status, 'playing'); assert.equal(state.attempts, 0); assert.equal(state.lastError, null);
  }
});

test('contrat 0.2 : neuf exemples T01 à T09, structure history et champs last', () => {
  const game = fresh();
  const unique = ['rouge', 'bleu', 'vert', 'jaune'];
  const repeated = ['rouge', 'rouge', 'bleu', 'vert'];
  const cases = [
    [unique, ['rouge', 'vert', 'bleu', 'orange'], 1, 2],
    [unique, ['orange', 'violet', 'rouge', 'bleu'], 0, 2],
    [unique, ['bleu', 'rouge', 'jaune', 'vert'], 0, 4],
    [unique, ['rouge', 'bleu', 'jaune', 'vert'], 2, 2], [unique, unique, 4, 0],
    [repeated, red, 2, 0], [repeated, ['rouge', 'bleu', 'rouge', 'vert'], 2, 2],
    [repeated, repeated, 4, 0], [repeated, ['rouge', 'bleu', 'rouge', 'rouge'], 1, 2],
  ];
  for (const [secret, guess, wellPlaced, misplaced] of cases) {
    game.startGame({ secret }); const state = game.submit(guess).state;
    const result = { wellPlaced, misplaced };
    assert.deepEqual(state, { status: wellPlaced === 4 ? 'won' : 'playing', attempts: 1, remaining: 9,
      history: [{ guess, result }], lastGuess: guess, lastResult: result, lastError: null });
    assert.equal(Object.hasOwn(state, 'secret'), false); assert.equal(Object.hasOwn(state, 'solution'), false);
  }
});

test('contrat 0.2 : refus à neuf essais, victoire/défaite, refus après fin et redémarrage', () => {
  const game = fresh();
  for (const win of [true, false]) {
    game.startGame({ secret: red });
    for (let i = 0; i < 9; i++) game.submit(blue);
    assert.equal(game.submit(['rouge']).state.attempts, 9);
    const state = game.submit(win ? red : blue).state;
    assert.equal(state.status, win ? 'won' : 'lost'); assert.equal(state.attempts, 10);
    assert.equal(state.lastError, null);
    for (const guess of [red, null, ['rose']]) {
      const refused = game.submit(guess).state;
      assert.equal(refused.lastError.code, 'game-finished');
      assert.deepEqual(withoutError(refused), state);
    }
    assert.throws(() => game.startGame({ secret: null }));
    const restarted = game.startGame();
    assert.equal(restarted.status, 'playing'); assert.equal(restarted.lastGuess, null);
    assert.equal(restarted.lastResult, null); assert.equal(restarted.lastError, null);
    assert.deepEqual(restarted.history, []);
  }
});

test('contrat 0.2 : copie profonde, getters purs et sérialisation JSON', () => {
  const game = fresh(); const imposed = [...red]; game.startGame({ secret: imposed }); imposed[0] = 'bleu';
  const guess = [...blue]; game.submit(guess); guess[0] = 'rouge';
  game.submit(null);
  const before = game.getState();
  const copy = game.getState();
  copy.history[0].guess[0] = 'jaune'; copy.history[0].result.wellPlaced = 99;
  copy.lastGuess[0] = 'jaune'; copy.lastResult.misplaced = 99; copy.lastError.code = 'modifié';
  copy.history.push({}); copy.status = 'won';
  assert.deepEqual(game.getState(), before);
  assert.deepEqual(JSON.parse(JSON.stringify(game.getState())), before);
  assert.equal(game.submit(red).state.status, 'won');
});
