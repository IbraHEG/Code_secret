(function () {
  'use strict';
  const { COLORS, createGame } = window.MastermindEngine;
  const symbols = ['●', '◆', '▲', '★', '■', '✚'];
  const testMode = new URLSearchParams(window.location.search).get('test') === '1';
  const game = createGame(Math.random, { autoStart: !testMode });
  const $ = id => document.getElementById(id);
  let draft = Array(4).fill(null), selected = 0;
  const name = color => color[0].toUpperCase() + color.slice(1);
  const token = color => `<span class="pip ${color}" aria-hidden="true">${symbols[COLORS.indexOf(color)]}</span><span class="color-name">${name(color)}</span>`;

  for (let i = 0; i < 4; i++) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'slot';
    button.addEventListener('click', () => { selected = i; renderDraft(); });
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      selected = (i + (event.key === 'ArrowRight' ? 1 : 3)) % 4;
      renderDraft();
      $('slots').children[selected].focus();
    });
    $('slots').append(button);
  }
  COLORS.forEach((color, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'color-button';
    button.innerHTML = token(color);
    button.setAttribute('aria-label', `Choisir ${color}, symbole ${symbols[i]}`);
    button.addEventListener('click', () => {
      if (game.getState().status !== 'playing') return;
      draft[selected] = color;
      selected = (selected + 1) % 4;
      renderDraft();
      $('message').textContent = `${name(color)} ajouté. Position ${selected + 1} sélectionnée.`;
      $('message').classList.remove('error');
    });
    $('palette').append(button);
  });

  function renderDraft() {
    const ended = game.getState().status !== 'playing';
    Array.from($('slots').children).forEach((button, i) => {
      button.innerHTML = `<span class="position-label">${i + 1}</span>${draft[i] ? token(draft[i]) : '<span class="empty-pip" aria-hidden="true">+</span><span class="color-name">Choisir</span>'}`;
      button.setAttribute('aria-label', `Position ${i + 1} : ${draft[i] || 'vide'}`);
      button.setAttribute('aria-pressed', String(i === selected));
      button.disabled = ended;
    });
    Array.from($('palette').children).forEach(button => { button.disabled = ended; });
    $('submit-guess').disabled = ended;
    $('clear-guess').disabled = ended;
  }

  function render() {
    const state = game.getState(), ended = ['won', 'lost'].includes(state.status);
    renderDraft();
    $('attempt-label').textContent = state.status === 'not-started' ? 'Partie non démarrée' : ended ? (state.status === 'won' ? 'Code découvert !' : 'Partie terminée') : `Essai ${state.attempts + 1} sur 10`;
    $('remaining').textContent = `${state.remaining} essai${state.remaining > 1 ? 's' : ''} restant${state.remaining > 1 ? 's' : ''}`;
    $('progress').innerHTML = Array.from({ length: 10 }, (_, i) => `<span class="${i < state.attempts ? 'used' : ''}"></span>`).join('');
    $('history-count').textContent = `${state.attempts} / 10`;
    $('empty-history').hidden = state.attempts > 0;
    $('history').innerHTML = state.history.map(({ guess, result: row }, i) => `<li class="history-row${row.wellPlaced === 4 ? ' winning' : ''}"><span class="attempt-number" aria-label="Essai ${i + 1}">${String(i + 1).padStart(2, '0')}</span><div class="history-code">${guess.map(color => `<span class="history-color">${token(color)}</span>`).join('')}</div><div class="indices"><span><strong>${row.wellPlaced}</strong> bien placée${row.wellPlaced > 1 ? 's' : ''}</span><span><strong>${row.misplaced}</strong> mal placée${row.misplaced > 1 ? 's' : ''}</span></div></li>`).join('');
    // Le contrat interdit toute révélation séparée, même après la fin.
    $('secret').innerHTML = '<span>?</span>'.repeat(4);
    $('secret').setAttribute('aria-label', 'Code secret caché');
    $('secret-caption').textContent = state.status === 'not-started' ? 'Démarrez une nouvelle partie.' : ended ? 'À vous de relever un nouveau défi.' : 'Il attend d’être découvert.';
    if (ended) {
      $('message').classList.remove('error');
      $('message').textContent = state.status === 'won' ? `Bravo ! Code trouvé en ${state.attempts} essai${state.attempts > 1 ? 's' : ''}. Une nouvelle énigme vous attend !` : 'Les dix essais sont écoulés. Nouvelle partie, nouvelle chance !';
    }
  }

  function submit(guess) {
    const result = game.submit(guess);
    if (result.ok) {
      const ended = result.state.status !== 'playing';
      if (!ended) { draft = Array(4).fill(null); selected = 0; }
      render();
      if (!ended) $('message').textContent = `Essai ${result.state.attempts} : ${result.wellPlaced} bien placée(s), ${result.misplaced} mal placée(s). À vous pour la suite !`;
    } else {
      if (result.state.status === 'playing') {
        $('message').textContent = result.error;
        $('message').classList.add('error');
      }
    }
    return result;
  }
  function newGame(options) {
    const state = game.startGame(options);
    draft = Array(4).fill(null); selected = 0;
    $('message').classList.remove('error');
    $('message').textContent = 'Nouvelle partie ! Composez votre première proposition.';
    render();
    return state;
  }
  $('guess-form').addEventListener('submit', event => {
    event.preventDefault();
    const result = submit(draft);
    if (result.ok) {
      if (result.state.status === 'playing') $('slots').children[0].focus();
      else $('new-game').focus();
    } else $('slots').children[Math.max(0, draft.indexOf(null))].focus();
  });
  $('new-game').addEventListener('click', () => { newGame(); $('slots').children[0].focus(); });
  $('clear-guess').addEventListener('click', () => {
    draft = Array(4).fill(null); selected = 0; renderDraft();
    $('message').textContent = 'Proposition effacée. Aucun essai utilisé.';
    $('message').classList.remove('error');
    $('slots').children[0].focus();
  });
  if (testMode) $('message').textContent = 'Mode test : démarrez une partie pour jouer.';
  render();
  // Exposer seulement après construction de l’interface. Les mutations async
  // se résolvent après sa mise à jour, sur l’unique partie visible.
  if (testMode) {
    window.codeSecretTest = Object.freeze({
      version: '0.2',
      getConfig: () => ({ apiVersion: '0.2', rulesVersion: 'code-couleurs-1.0',
        secretLength: 4, maxAttempts: 10, allowDuplicates: true, colors: [...COLORS] }),
      getState: game.getState,
      startGame: async options => newGame(options),
      submitGuess: async guess => submit(guess).state,
    });
  }
})();
