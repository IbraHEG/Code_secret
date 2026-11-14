/* Moteur partagé par l’interface et les tests. Aucun appel réseau. */
(function (root) {
  'use strict';
  const COLORS = Object.freeze(['rouge', 'bleu', 'vert', 'jaune', 'orange', 'violet']);
  function codeError(code) {
    if (!Array.isArray(code)) return { code: 'invalid-type', message: 'La proposition doit être un tableau dense de quatre couleurs (chaînes de caractères).' };
    for (let i = 0; i < code.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(code, i) || typeof code[i] !== 'string') {
        return { code: 'invalid-type', message: 'Choisissez quatre couleurs : aucun emplacement ne peut être vide et chaque couleur doit être une chaîne de caractères.' };
      }
    }
    if (code.length !== 4) return { code: 'invalid-length', message: 'La proposition doit contenir exactement quatre couleurs.' };
    if (code.some(color => !COLORS.includes(color))) return { code: 'invalid-color', message: 'Couleur non autorisée. Choisissez rouge, bleu, vert, jaune, orange ou violet, en minuscules sans espace.' };
    return null;
  }
  const validCode = code => codeError(code) === null;

  function score(secret, guess) {
    if (!validCode(secret) || !validCode(guess)) throw new TypeError('Un code doit contenir quatre couleurs autorisées.');
    let wellPlaced = 0;
    const remainingSecret = {}, remainingGuess = {};
    for (let i = 0; i < 4; i++) {
      if (secret[i] === guess[i]) wellPlaced++;
      else {
        remainingSecret[secret[i]] = (remainingSecret[secret[i]] || 0) + 1;
        remainingGuess[guess[i]] = (remainingGuess[guess[i]] || 0) + 1;
      }
    }
    const misplaced = COLORS.reduce((sum, color) => sum + Math.min(remainingSecret[color] || 0, remainingGuess[color] || 0), 0);
    return { wellPlaced, misplaced };
  }

  function createGame(random = Math.random, { autoStart = true } = {}) {
    let secret = null, history = [], status = 'not-started', lastError = null;
    function getState() {
      const last = history[history.length - 1];
      return { status, attempts: history.length, remaining: 10 - history.length,
        history: history.map(row => ({ guess: [...row.guess], result: { ...row.result } })),
        lastGuess: last ? [...last.guess] : null,
        lastResult: last ? { ...last.result } : null,
        lastError: lastError ? { ...lastError } : null };
    }
    function startGame(options = {}) {
      // Tout valider avant la moindre mutation, y compris de lastError.
      if (options === null || typeof options !== 'object' ||
          ![Object.prototype, null].includes(Object.getPrototypeOf(options)) ||
          Reflect.ownKeys(options).some(key => key !== 'secret')) {
        throw Object.assign(new Error('Les options doivent être un objet ne contenant que la clé facultative secret.'), { code: 'invalid-options' });
      }
      const imposed = Object.prototype.hasOwnProperty.call(options, 'secret');
      if (imposed) {
        const error = codeError(options.secret);
        if (error) throw Object.assign(new Error(error.message), { code: error.code });
      }
      const nextSecret = imposed ? [...options.secret] : Array.from({ length: 4 }, () => COLORS[Math.floor(random() * COLORS.length)]);
      secret = nextSecret;
      history = [];
      status = 'playing';
      lastError = null;
      return getState();
    }
    // Raccourci interne utilisé par les tests métier existants.
    function newGame(fixedSecret) {
      return startGame(fixedSecret === undefined ? {} : { secret: fixedSecret });
    }
    function submit(guess) {
      const error = status === 'not-started'
        ? { code: 'game-not-started', message: 'Démarrez une partie avant de proposer un code.' }
        : status !== 'playing'
          ? { code: 'game-finished', message: 'Cette partie est terminée. Lancez une nouvelle partie pour rejouer.' }
          : codeError(guess);
      if (error) {
        lastError = error;
        return { ok: false, error: error.message, state: getState() };
      }
      const result = score(secret, guess);
      history.push({ guess: [...guess], result });
      lastError = null;
      if (result.wellPlaced === 4) status = 'won';
      else if (history.length === 10) status = 'lost';
      return { ok: true, ...result, state: getState() };
    }
    if (autoStart) startGame();
    return Object.freeze({ newGame, startGame, submit, getState });
  }
  const engine = Object.freeze({ COLORS, score, createGame });
  if (typeof module !== 'undefined' && module.exports) module.exports = engine;
  else root.MastermindEngine = engine;
})(typeof globalThis !== 'undefined' ? globalThis : this);
