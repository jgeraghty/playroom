import { disposeGameUI } from '../shared/game-ui.js';

export function createGameHost({ root, games, progressStore, onQuit = () => {} }) {
  const overlay = root.querySelector('#playOverlay');
  const gameRoot = root.querySelector('#gameRoot');
  const result = root.querySelector('#resultPopup');
  const pauseMenu = root.querySelector('#pauseScreen');
  const pauseActions = root.querySelector('#pauseActions');
  const roundExit = root.querySelector('#roundExit');
  gameRoot.tabIndex = -1;
  const header = root.querySelector('.modalhead');
  const title = root.querySelector('#gameTitle');
  const levelBadge = root.querySelector('#levelBadge');
  const scoreBadge = root.querySelector('#scoreBadge');
  let activeGame = null;
  let gameModule = null;
  let controller = null;
  let options = {};
  let currentLevel = 1;
  let currentScore = null;
  let roundStarted = false;
  let roundEnded = false;
  let generation = 0;
  let focusBeforePause = null;
  let focusBeforeOpen = null;
  let exitAction = null;

  function activeDialog() {
    if (result.classList.contains('show')) return result;
    if (pauseMenu.classList.contains('show')) return pauseMenu;
    return overlay.classList.contains('show') ? overlay : null;
  }

  function updateInertState() {
    const gameVisible = overlay.classList.contains('show');
    const finished = result.classList.contains('show');
    gameRoot.inert = finished;
    header.inert = finished;
    const paused = pauseMenu.classList.contains('show');
    for (const child of root.children) {
      if (child === overlay) child.inert = paused;
      else if (child === pauseMenu) child.inert = !paused;
      else child.inert = gameVisible;
    }
  }

  function trapDialogFocus(event) {
    const dialog = activeDialog();
    if (!dialog || event.key !== 'Tab') return;
    const focusable = [
      ...dialog.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
      ),
    ].filter(
      (element) => element.tabIndex >= 0 && !element.inert && element.getClientRects().length,
    );
    if (!focusable.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (
      event.shiftKey &&
      (document.activeElement === first || !dialog.contains(document.activeElement))
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      (document.activeElement === last || !dialog.contains(document.activeElement))
    ) {
      event.preventDefault();
      first.focus();
    }
  }

  function setOverlayVisible(visible) {
    overlay.classList.toggle('show', visible);
    overlay.setAttribute('aria-hidden', String(!visible));
    document.body.classList.toggle('playing', visible);
    updateInertState();
    if (!visible && focusBeforeOpen?.isConnected) {
      focusBeforeOpen.focus();
      focusBeforeOpen = null;
    }
  }

  function setPauseVisible(visible) {
    if (visible && !pauseMenu.classList.contains('show')) focusBeforePause = document.activeElement;
    pauseMenu.classList.toggle('show', visible);
    pauseMenu.setAttribute('aria-hidden', String(!visible));
    updateInertState();
    if (visible) {
      pauseMenu.querySelector('#resumeGame').focus();
    } else {
      showExit(null);
      if (focusBeforePause?.isConnected) focusBeforePause.focus();
      focusBeforePause = null;
    }
  }

  function showExit(action) {
    exitAction = action;
    roundExit.hidden = !action;
    pauseActions.hidden = !!action;
    pauseMenu.setAttribute('aria-labelledby', action ? 'exitTitle' : 'pauseTitle');
    pauseMenu.setAttribute('aria-describedby', action ? 'exitText' : 'pauseText');
    if (action) {
      const settings = action === 'settings';
      roundExit.querySelector('#exitTitle').textContent = settings
        ? 'Change settings?'
        : 'Quit this round?';
      roundExit.querySelector('#confirmExit').textContent = settings
        ? 'Change settings'
        : 'Quit to games';
      roundExit.querySelector('#keepPlaying').focus();
    }
  }

  function cancelExit() {
    if (!exitAction) return false;
    const trigger = exitAction === 'settings' ? '#pauseSettings' : '#quitGame';
    showExit(null);
    pauseActions.querySelector(trigger).focus();
    return true;
  }

  function requestExit(action) {
    if (!roundStarted || roundEnded) return false;
    pause();
    showExit(action);
    return true;
  }

  function blockGameKeysWhilePaused(event) {
    const dialog = activeDialog();
    if (!dialog || dialog === overlay) return;
    const gameKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'];
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (!dialog.contains(event.target) || gameKeys.includes(key)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  function setResultVisible(visible) {
    result.classList.toggle('show', visible);
    result.classList.toggle(
      'win',
      visible && result.dataset.outcome !== 'loss' && result.dataset.outcome !== 'draw',
    );
    result.setAttribute('aria-hidden', String(!visible));
    updateInertState();
    if (visible) root.querySelector('#playAgain').focus();
    else if (overlay.classList.contains('show')) gameRoot.focus({ preventScroll: true });
  }

  function updateStatus(status = {}) {
    if (Number.isFinite(status.level)) currentLevel = Math.max(1, status.level);
    if ('score' in status) currentScore = status.score;
    const setup = activeGame?.setup;
    levelBadge.hidden = activeGame?.showLevel === false;
    levelBadge.textContent = setup
      ? setup.choices.find((choice) => choice.value === options[setup.key])?.label ||
        'Choose a mode'
      : `Level ${currentLevel}`;
    scoreBadge.textContent = Number.isFinite(currentScore) ? `Score ${currentScore}` : '';
    scoreBadge.hidden = !Number.isFinite(currentScore);
  }

  function renderIntro() {
    root.querySelector('#pauseButton').hidden = true;
    const setup = activeGame.setup;
    const setupControls = setup
      ? `<fieldset class="setup-options"><legend>${setup.label}</legend>${setup.choices.map((choice) => `<label class="setup-choice"><input type="radio" name="game-option" value="${choice.value}" ${options[setup.key] === choice.value ? 'checked' : ''}><span><strong>${choice.label}</strong><small>${choice.detail}</small></span></label>`).join('')}</fieldset>`
      : '';
    gameRoot.innerHTML = `
      <div class="intro-screen">
        <div class="result-icon">${activeGame.icon}</div>
        <div class="eyebrow">Ready when you are</div>
        <h2>${activeGame.title}</h2>
        <p>${activeGame.setup?.tip || activeGame.description}</p>
        ${setupControls}
        <p class="save-note">Take your time. You can pause whenever you like.</p>
        <div class="intro-actions"><button class="primary" data-action="start">${activeGame.startLabel || 'Start round'}</button><button class="soft" data-action="back">Back to games</button></div>
      </div>`;
    gameRoot.querySelector('[data-action="back"]').addEventListener('click', () => quit());
    gameRoot.querySelectorAll('[name="game-option"]').forEach((input) =>
      input.addEventListener('change', () => {
        options[activeGame.setup.key] = input.value;
        updateStatus();
      }),
    );
    gameRoot
      .querySelector('[data-action="start"]')
      .addEventListener('click', startRound, { once: true });
  }

  function showResult(resultData) {
    if (roundEnded || !activeGame) return;
    roundEnded = true;
    controller?.pause();
    const resultValue = {
      ...resultData,
      outcome: resultData.outcome || 'complete',
      title: resultData.title || 'Round complete',
      message: resultData.message || '',
    };
    result.dataset.outcome = resultValue.outcome;
    progressStore.recordResult({
      gameId: activeGame.id,
      title: activeGame.title,
      outcome: resultValue.outcome,
      level: currentLevel,
      score: resultValue.score,
    });
    root.querySelector('#resultIcon').textContent = resultValue.icon || activeGame.icon;
    root.querySelector('#resultTitle').textContent = resultValue.title;
    root.querySelector('#resultText').textContent = resultValue.message;
    const stats = root.querySelector('#resultStats');
    stats.replaceChildren();
    for (const [label, value] of resultValue.stats || []) {
      const item = document.createElement('div');
      const term = document.createElement('dt');
      const detail = document.createElement('dd');
      term.textContent = label;
      detail.textContent = value;
      item.append(term, detail);
      stats.append(item);
    }
    const review = root.querySelector('#resultReview');
    const entries = resultValue.review?.entries || [];
    review.open = false;
    review.hidden = entries.length === 0;
    review.querySelector('summary').textContent = resultValue.review?.label || '';
    review.querySelector('ul').replaceChildren(
      ...entries.map((entry) => {
        const item = document.createElement('li');
        item.textContent = entry;
        return item;
      }),
    );
    root.querySelector('#playAgain').textContent =
      activeGame.replayLabel || (activeGame.setup ? 'Play again · same settings' : 'Play again');
    setPauseVisible(false);
    setResultVisible(true);
  }

  async function startRound() {
    if (!activeGame || roundStarted) return;
    const requestGeneration = ++generation;
    const requestedGame = activeGame;
    const isCurrent = () => requestGeneration === generation && activeGame === requestedGame;
    roundStarted = true;
    root.querySelector('#pauseButton').hidden = false;
    roundEnded = false;
    setResultVisible(false);
    gameRoot.innerHTML = '<p class="toast" role="status">Loading game…</p>';
    try {
      const module = gameModule || (await activeGame.load());
      if (requestGeneration !== generation || !activeGame) return;
      gameModule = module;
      if (activeGame.setup) progressStore.saveGame(activeGame.id, { settings: { ...options } });
      gameRoot.replaceChildren();
      controller = module.mountGame({
        root: gameRoot,
        level: currentLevel,
        options: { ...options },
        progress: progressStore.load().games[activeGame.id] || {},
        finish: (data) => {
          if (isCurrent()) showResult(data);
        },
        saveProgress: (patch) => {
          if (isCurrent()) progressStore.saveGame(requestedGame.id, patch);
        },
        updateStatus: (status) => {
          if (isCurrent()) updateStatus(status);
        },
      });
      if (roundEnded || pauseMenu.classList.contains('show')) controller.pause();
      else if (document.hidden) pause();
      else gameRoot.focus({ preventScroll: true });
    } catch (error) {
      if (requestGeneration !== generation) return;
      generation += 1;
      disposeGameUI(gameRoot);
      controller = null;
      roundStarted = false;
      gameModule = null;
      root.querySelector('#pauseButton').hidden = true;
      gameRoot.innerHTML =
        '<p class="toast" role="alert">This game could not be opened.</p><button data-action="retry">Try again</button><button class="soft" data-action="back">Back to games</button>';
      gameRoot
        .querySelector('[data-action="retry"]')
        .addEventListener('click', startRound, { once: true });
      gameRoot.querySelector('[data-action="back"]').addEventListener('click', quit);
      if (!pauseMenu.classList.contains('show')) gameRoot.querySelector('button').focus();
      console.error(`Unable to load game "${activeGame.title}"`, error);
    }
  }

  function disposeController() {
    generation += 1;
    controller?.destroy();
    disposeGameUI(gameRoot);
    controller = null;
  }

  function open(gameId) {
    const game = games.find((entry) => entry.id === gameId);
    if (!game) return false;
    disposeController();
    if (!overlay.classList.contains('show')) focusBeforeOpen = document.activeElement;
    activeGame = game;
    const gameProgress = progressStore.load().games[game.id] || {};
    options = {};
    if (game.setup) {
      const { key, choices } = game.setup;
      const preferred = gameProgress.settings?.[key];
      options[key] =
        choices.find((choice) => choice.value === preferred)?.value ?? choices[0].value;
    }
    gameRoot.classList.toggle('reference-game', !!game.setup || game.showLevel === false);
    root.querySelector('#changeSettings').hidden = !game.setup;
    root.querySelector('#pauseSettings').hidden = !game.setup;
    currentLevel = Math.max(1, progressStore.load().best[game.title] || 1);
    gameModule = null;
    currentScore = null;
    roundStarted = false;
    roundEnded = false;
    title.textContent = game.title;
    updateStatus({ level: currentLevel, score: null });
    setPauseVisible(false);
    setResultVisible(false);
    setOverlayVisible(true);
    renderIntro();
    title.setAttribute('tabindex', '-1');
    title.focus();
    return true;
  }

  function pause() {
    if (!roundStarted || roundEnded || pauseMenu.classList.contains('show')) return;
    controller?.pause();
    setPauseVisible(true);
  }

  function resume() {
    if (document.hidden || !pauseMenu.classList.contains('show')) return;
    setPauseVisible(false);
    controller?.resume();
  }

  function restart() {
    if (!activeGame) return;
    setPauseVisible(false);
    setResultVisible(false);
    roundEnded = false;
    currentScore = null;
    updateStatus({ score: null });
    if (controller && roundStarted) {
      disposeController();
      roundStarted = false;
      startRound();
    } else {
      disposeController();
      roundStarted = false;
      renderIntro();
    }
  }

  function setup() {
    if (!activeGame || requestExit('settings')) return;
    showSetup();
  }

  function showSetup() {
    disposeController();
    roundStarted = false;
    roundEnded = false;
    setPauseVisible(false);
    setResultVisible(false);
    updateStatus({ score: null });
    renderIntro();
    gameRoot.focus({ preventScroll: true });
  }

  function quit({ confirmRound = true } = {}) {
    if (!activeGame) return true;
    if (confirmRound && requestExit('quit')) return false;
    closeGame();
    return true;
  }

  function closeGame() {
    disposeController();
    activeGame = null;
    gameModule = null;
    roundStarted = false;
    roundEnded = false;
    setPauseVisible(false);
    setResultVisible(false);
    setOverlayVisible(false);
    gameRoot.replaceChildren();
    onQuit();
  }

  function confirmExit() {
    if (exitAction === 'settings') showSetup();
    else if (exitAction === 'quit') {
      closeGame();
      return true;
    }
    return false;
  }

  function onVisibilityChange() {
    if (document.hidden && roundStarted && !roundEnded) pause();
  }
  document.addEventListener('visibilitychange', onVisibilityChange);
  document.addEventListener('keydown', blockGameKeysWhilePaused, true);
  document.addEventListener('keydown', trapDialogFocus, true);
  return {
    open,
    pause,
    resume,
    restart,
    setup,
    quit,
    cancelExit,
    confirmExit,
    destroy() {
      if (activeGame) {
        disposeController();
        activeGame = null;
        gameModule = null;
        roundStarted = false;
        roundEnded = false;
      }
      setPauseVisible(false);
      setResultVisible(false);
      setOverlayVisible(false);
      gameRoot.replaceChildren();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('keydown', blockGameKeysWhilePaused, true);
      document.removeEventListener('keydown', trapDialogFocus, true);
    },
  };
}
