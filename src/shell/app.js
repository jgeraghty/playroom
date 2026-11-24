import { themes, themeUnlocked } from './progress-store.js';
import { createGameHost } from './game-host.js';
import { gamePreview } from '../catalog/previews.js';

const capabilityFilters = {
  twoPlayers: {
    label: 'Two players',
    aliases: 'two player 2 players multiplayer local pass and play',
  },
  noTimer: { label: 'No timer', aliases: 'untimed no time limit at your own pace' },
};

export function createApp({ root, games, progressStore }) {
  root.innerHTML = `
    <header class="top">
      <a class="brand" href="./"><span class="logo" aria-hidden="true">✦</span> Playroom</a>
      <nav class="nav" aria-label="Site"><a href="#games">Games</a><a href="#about">About</a><a href="#settings">Settings</a></nav>
    </header>
    <main class="wrap">
      <p class="catalog-empty" id="routeNotice" role="status" hidden>That game link is unavailable. Choose a game below.</p>
      <div class="catalog-lead">
        <section class="hero">
          <h1>Big fun.<br>Little games.</h1>
          <p>${games.length} free browser games for a quick break.</p>
          <a class="browse-button" href="#games">Browse games</a>
        </section>
        <section class="daily-card" aria-labelledby="dailyHeading">
          <h2 id="dailyHeading">Today’s pick</h2>
          <div id="dailyPreview" class="art"></div>
          <strong id="dailyTitle"></strong>
          <button class="primary" id="playDaily">Play today’s game</button>
        </section>
      </div>
      <section id="games" aria-labelledby="gamesHeading">
        <div class="section">
          <h2 id="gamesHeading" tabindex="-1">Explore games</h2>
          <input class="search" id="search" type="search" aria-label="Search games" placeholder="Search games">
        </div>
        <div class="filters" role="group" aria-label="Game categories">
          <button class="filter active" data-cat="All" aria-pressed="true">All games</button>
          <button class="filter" data-cat="Puzzle" aria-pressed="false">Puzzle</button>
          <button class="filter" data-cat="Quick play" aria-pressed="false">Quick play</button>
          <button class="filter" data-cat="Classic" aria-pressed="false">Classic</button>
        </div>
        <div class="filters capability-filters" role="group" aria-label="Ways to play">
          ${Object.entries(capabilityFilters)
            .map(
              ([id, { label }]) =>
                `<button class="filter" data-cap="${id}" aria-pressed="false">${label}</button>`,
            )
            .join('')}
        </div>
        <p id="gameCount" class="game-count" role="status"></p>
        <div class="grid" id="grid"></div>
        <div class="catalog-empty" id="catalogEmpty" hidden>
          <p>No games match your search and filters.</p>
          <button type="button" id="clearSearch">Show all games</button>
        </div>
      </section>
      <div class="catalog-info">
        <section id="about">
          <h2>About Playroom</h2>
          <p>Pick a game, choose a mode, and start a round. Each game explains its controls before you play. Use the Pause button at any time, or press Escape on a keyboard.</p>
          <p>Game links open the setup screen so you can share a favorite game without sharing your scores.</p>
        </section>
        <section id="settings">
          <h2>Playroom settings</h2>
          <p id="progressSummary"></p>
          <p class="catalog-progress" id="badgeSummary"></p>
          <div class="theme-row" id="themeRow" role="group" aria-label="Unlocked themes"></div>
          <p id="nextTheme" hidden></p>
          <button class="reset-progress" id="resetProgress">Reset saved progress</button>
          <dialog class="reset-dialog" id="resetDialog" aria-labelledby="resetTitle">
            <form method="dialog">
              <h2 id="resetTitle">Clear your saved progress?</h2>
              <p>This clears scores, badges, themes, and game settings for this browser.</p>
              <button value="cancel" autofocus>Keep progress</button>
              <button value="reset" class="reset-submit">Clear progress</button>
            </form>
          </dialog>
          <p id="resetStatus" role="status"></p>
        </section>
      </div>
    </main>
    <div class="overlay" id="playOverlay" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="gameTitle" tabindex="-1">
      <div class="modal">
        <div class="modalhead">
          <h2 id="gameTitle">Game</h2>
          <span class="levelBadge" id="levelBadge">Level 1</span>
          <span class="levelBadge" id="scoreBadge" hidden></span>
          <button class="game-share" id="copyGameLink" type="button">Copy link</button>
          <button class="doneBtn" id="pauseButton">Ⅱ &nbsp; Pause</button>
        </div>
        <p class="share-status" id="shareStatus" role="status" hidden></p>
        <div class="game" id="gameRoot"></div>
        <div class="result-overlay" id="resultPopup" aria-hidden="true" role="alertdialog" aria-modal="true" aria-labelledby="resultTitle" aria-describedby="resultText" tabindex="-1">
          <div class="result-card">
            <div class="result-confetti">🎉 ✨ 🎊 ✨ 🎉</div>
            <div class="result-icon" id="resultIcon">🎮</div>
            <h3 id="resultTitle">Round complete</h3>
            <p id="resultText"></p><dl class="result-stats" id="resultStats"></dl>
            <details class="result-review" id="resultReview" hidden>
              <summary></summary><ul></ul>
            </details>
            <div class="result-actions">
              <button id="playAgain">Play again</button>
              <button class="soft" id="changeSettings" hidden>Change settings</button>
              <button class="soft" id="resultBack">Back to games</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="pause-screen" id="pauseScreen" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="pauseTitle" aria-describedby="pauseText">
      <div class="pause-card">
        <div id="pauseActions">
          <h3 id="pauseTitle">Paused</h3>
          <p id="pauseText">Your round is saved right here.</p>
          <button id="resumeGame">Resume</button>
          <button class="soft" id="restartGame">Restart</button>
          <button class="soft" id="pauseSettings" hidden>Change settings</button>
          <button class="soft" id="quitGame">Quit to games</button>
        </div>
        <div id="roundExit" hidden>
          <h3 id="exitTitle"></h3>
          <p id="exitText">Leaving now ends this round.</p>
          <button id="keepPlaying">Keep playing</button>
          <button class="soft" id="confirmExit"></button>
        </div>
      </div>
    </div>`;

  const { history, location } = window;
  const catalogTitle = document.title;
  const grid = root.querySelector('#grid');
  const search = root.querySelector('#search');
  const filters = [...root.querySelectorAll('[data-cat]')];
  const capabilities = new Set();
  const capabilityButtons = [...root.querySelectorAll('[data-cap]')];
  const empty = root.querySelector('#catalogEmpty');
  const shareStatus = root.querySelector('#shareStatus');
  const gameHost = createGameHost({ root, games, progressStore, onQuit: onGameClosed });
  let openId = null;
  let syncingRoute = false;
  let catalogFilter = 'All';
  let dailyGame;

  function gameURL(id) {
    const url = new URL(location.href);
    if (id) {
      url.searchParams.set('game', id);
      url.hash = '';
    } else {
      url.searchParams.delete('game');
    }
    return url;
  }

  function openFromURL() {
    const id = new URL(location.href).searchParams.get('game');
    const game = games.find((entry) => entry.id === id);
    root.querySelector('#routeNotice').hidden = !id || !!game;
    if (openId === game?.id) return;
    if (game) {
      openId = game.id;
      shareStatus.hidden = true;
      document.title = `${game.title} | Playroom`;
      gameHost.open(game.id);
    } else if (openId) {
      syncingRoute = true;
      gameHost.quit({ confirmRound: false });
      syncingRoute = false;
    }
  }

  function selectGame(id, trigger) {
    trigger.focus({ preventScroll: true });
    history.pushState({ playroomGame: true }, '', gameURL(id));
    openFromURL();
  }

  function onGameClosed() {
    openId = null;
    document.title = catalogTitle;
    if (!syncingRoute) {
      if (history.state?.playroomGame) history.back();
      else history.replaceState(null, '', gameURL(null));
    }
    refreshProgress();
  }

  function renderGames() {
    const query = search.value.trim().toLowerCase();
    const visible = games.filter((game) => {
      const supported = game.capabilities || [];
      if (catalogFilter !== 'All' && game.category !== catalogFilter) return false;
      if (![...capabilities].every((capability) => supported.includes(capability))) return false;
      const keywords = supported.map(
        (id) => capabilityFilters[id].label + ' ' + capabilityFilters[id].aliases,
      );
      return [game.title, game.description, game.category, ...keywords]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
    grid.replaceChildren();
    for (const game of visible) {
      const card = document.createElement('a');
      card.className = 'card';
      card.href = gameURL(game.id);
      card.setAttribute('aria-label', `Play ${game.title}`);
      card.setAttribute('aria-describedby', `desc-${game.id}`);
      card.innerHTML = `<div class="art" style="background:${game.background}">${gamePreview(game)}</div><div class="card-detail"><span class="tag">${game.category}</span><h3 class="title">${game.title}</h3><p class="desc" id="desc-${game.id}">${game.description}</p></div>`;
      card.addEventListener('click', (event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey)
          return;
        event.preventDefault();
        selectGame(game.id, card);
      });
      grid.append(card);
    }
    root.querySelector('#gameCount').textContent =
      `${visible.length} ${visible.length === 1 ? 'game' : 'games'}`;
    empty.hidden = visible.length > 0;
  }

  function filterGames(button) {
    catalogFilter = button.dataset.cat;
    for (const filter of filters) {
      filter.classList.toggle('active', filter === button);
      filter.setAttribute('aria-pressed', String(filter === button));
    }
    renderGames();
  }

  function refreshProgress() {
    const progress = progressStore.load();
    const dailyId = progressStore.dailyGameId(games.map((game) => game.id));
    dailyGame = games.find((game) => game.id === dailyId);
    const dailyPreview = root.querySelector('#dailyPreview');
    dailyPreview.innerHTML = dailyGame ? gamePreview(dailyGame) : '';
    dailyPreview.style.background = dailyGame?.background || '';
    root.querySelector('#playDaily').disabled = !dailyGame;
    root.querySelector('#dailyTitle').textContent = dailyGame?.title || 'No game selected today';
    const canSave = progressStore.canSaveProgress?.() !== false;
    const saveNote = canSave
      ? 'Progress stays in this browser.'
      : 'Progress is available for this visit only because browser storage is unavailable.';
    const rounds = progress.played === 1 ? '1 round' : `${progress.played} rounds`;
    const wins = progress.wins === 1 ? '1 win' : `${progress.wins} wins`;
    root.querySelector('#progressSummary').textContent = progress.played
      ? `${rounds} · ${wins}. ${saveNote}`
      : saveNote;
    root.querySelector('#badgeSummary').textContent = progress.badges.length
      ? `Badges: ${progress.badges.join(' · ')}`
      : 'Badges unlock as you play and win.';
    const themeRow = root.querySelector('#themeRow');
    themeRow.replaceChildren();
    const next = themes.find((theme) => !themeUnlocked(theme, progress));
    const nextTheme = root.querySelector('#nextTheme');
    nextTheme.hidden = !next;
    if (next) {
      const remaining = next.rounds - (progress.played || 0);
      nextTheme.textContent = `Finish ${remaining} more ${remaining === 1 ? 'round' : 'rounds'} to unlock ${next.label}.`;
    }
    for (const entry of themes) {
      if (!themeUnlocked(entry, progress)) continue;
      const { id: theme, label } = entry;
      const button = document.createElement('button');
      button.className = `theme-option${progress.theme === theme ? ' active' : ''}`;
      button.textContent = label;
      button.setAttribute('aria-pressed', String(progress.theme === theme));
      button.addEventListener('click', () => {
        progressStore.chooseTheme(theme);
        refreshProgress();
        themeRow.querySelector('[aria-pressed="true"]')?.focus();
      });
      themeRow.append(button);
    }
    document.body.dataset.theme = progress.theme;
  }

  search.addEventListener('input', renderGames);
  for (const button of filters) button.addEventListener('click', () => filterGames(button));
  function updateCapability(button, selected) {
    const id = button.dataset.cap;
    if (selected) capabilities.add(id);
    else capabilities.delete(id);
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
  for (const button of capabilityButtons) {
    button.addEventListener('click', () => {
      updateCapability(button, !capabilities.has(button.dataset.cap));
      renderGames();
    });
  }
  root.querySelector('#clearSearch').addEventListener('click', () => {
    search.value = '';
    for (const button of capabilityButtons) updateCapability(button, false);
    filterGames(filters[0]);
    search.focus();
  });
  root.querySelector('#playDaily').addEventListener('click', () => {
    if (dailyGame) selectGame(dailyGame.id, root.querySelector('#playDaily'));
  });
  const resetDialog = root.querySelector('#resetDialog');
  root.querySelector('#resetProgress').addEventListener('click', () => {
    resetDialog.returnValue = '';
    resetDialog.showModal();
  });
  resetDialog.addEventListener('close', () => {
    if (resetDialog.returnValue === 'reset') {
      progressStore.reset();
      refreshProgress();
      root.querySelector('#resetStatus').textContent = 'Progress cleared.';
    }
  });
  root.querySelector('#copyGameLink').addEventListener('click', async () => {
    if (!openId) return;
    const id = openId;
    const url = gameURL(id);
    try {
      await window.navigator.clipboard.writeText(url.href);
      if (openId !== id) return;
      shareStatus.textContent = 'Game link copied.';
    } catch {
      if (openId !== id) return;
      shareStatus.textContent = url.href;
    }
    shareStatus.hidden = false;
  });

  root.querySelector('#pauseButton').addEventListener('click', () => gameHost.pause());
  root.querySelector('#resumeGame').addEventListener('click', () => gameHost.resume());
  root.querySelector('#restartGame').addEventListener('click', () => gameHost.restart());
  root.querySelector('#quitGame').addEventListener('click', () => gameHost.quit());
  root.querySelector('#keepPlaying').addEventListener('click', () => gameHost.resume());
  root.querySelector('#confirmExit').addEventListener('click', () => gameHost.confirmExit());
  root.querySelector('#changeSettings').addEventListener('click', () => gameHost.setup());
  root.querySelector('#pauseSettings').addEventListener('click', () => gameHost.setup());
  root.querySelector('#playAgain').addEventListener('click', () => gameHost.restart());
  root.querySelector('#resultBack').addEventListener('click', () => gameHost.quit());
  const onKeyDown = (event) => {
    if (event.key === 'Escape' && root.querySelector('#playOverlay').classList.contains('show')) {
      if (!gameHost.cancelExit()) gameHost.pause();
    }
  };
  document.addEventListener('keydown', onKeyDown);

  window.addEventListener('popstate', openFromURL);
  renderGames();
  refreshProgress();
  openFromURL();
  return {
    destroy() {
      gameHost.destroy();
      window.removeEventListener('popstate', openFromURL);
      document.title = catalogTitle;
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('playing');
    },
  };
}
