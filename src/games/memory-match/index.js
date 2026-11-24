import './style.css';
import { createGameUI } from '../../shared/game-ui.js';
const faces = [
  '🍓',
  '🍋',
  '🐸',
  '🐳',
  '🌈',
  '🍕',
  '🐝',
  '🦋',
  '🍉',
  '⭐',
  '🐙',
  '🍦',
  '🦄',
  '🚀',
  '🐼',
  '🎈',
];
export function mountGame({ root, progress, finish, saveProgress, updateStatus, options = {} }) {
  const ui = createGameUI(root, '');
  const size = ['small', 'medium', 'large'].includes(options.size) ? options.size : 'small';
  const pairs = { small: 4, medium: 6, large: 8 }[size];
  const bestKey = `bestMoves_${size}`;
  let bestMoves = progress[bestKey];
  let hints = 0;
  const time = () => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  let seconds = 0,
    moves = 0,
    misses = 0,
    cards = [],
    open = [],
    matched = 0,
    locked = false,
    ended = false,
    paused = false,
    hintJob = null,
    hinted = [];
  function start() {
    ui.scheduler.clear();
    ui.scheduler.resume();
    paused = false;
    hintJob = null;
    hinted = [];
    hints = 0;
    seconds = 0;
    moves = 0;
    misses = 0;
    matched = 0;
    open = [];
    locked = false;
    ended = false;

    cards = [...faces.slice(0, pairs), ...faces.slice(0, pairs)];
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    render();
    ui.scheduler.interval(() => {
      seconds++;
      const n = root.querySelector('#mem-time');
      if (n) n.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    }, 1000);
  }
  function render() {
    ui.render(
      `<section class="arcade-stage memory-stage"><div class="stage-heading"><div><span class="eyebrow">A little focus, a little discovery</span><h2>Find your pairs.</h2></div><span class="mode-chip">${pairs} pairs</span></div><div class="session-hud"><div><span>Moves</span><strong id="mem-moves">0</strong></div><div><span>Time</span><strong id="mem-time">0:00</strong></div><div><span>Best moves</span><strong>${bestMoves ?? '—'}</strong></div></div><div class="tiles memory-grid" style="--rows:${Math.ceil(cards.length / 4)}">${cards.map((_, i) => `<button class="tile" data-i="${i}" aria-label="Hidden card ${i + 1}"><span aria-hidden="true">✦</span></button>`).join('')}</div><div class="stage-bottom"><p id="mem-hint" role="status">0 of ${pairs} pairs found</p><button class="soft" id="mem-help">✧ Show a pair</button></div><p class="control-note">Turn over two cards. Hints are always welcome.</p></section>`,
    );
    ui.on('.tile', 'click', (e) => flip(Number(e.currentTarget.dataset.i)));
    ui.on('#mem-help', 'click', hint);
  }
  function flip(i) {
    if (
      paused ||
      locked ||
      ended ||
      open.includes(i) ||
      root.querySelector(`[data-i="${i}"]`).classList.contains('done')
    )
      return;
    clearHint();
    const b = root.querySelector(`[data-i="${i}"]`);
    b.textContent = cards[i];
    b.classList.add('revealed');
    b.setAttribute('aria-label', cards[i]);
    open.push(i);
    if (open.length < 2) return;
    moves++;
    root.querySelector('#mem-moves').textContent = moves;
    if (cards[open[0]] === cards[open[1]]) {
      open.forEach((k) => {
        const card = root.querySelector(`[data-i="${k}"]`);
        card.classList.add('done');
        card.setAttribute('aria-disabled', 'true');
        card.setAttribute('aria-label', `Matched ${cards[k]}`);
      });
      matched++;
      open = [];
      const h = root.querySelector('#mem-hint');
      if (h) h.textContent = `${matched} of ${cards.length / 2} pairs found`;
      if (matched === cards.length / 2) {
        ended = true;
        ui.scheduler.clear();
        const newBest = !Number.isFinite(bestMoves) || moves < bestMoves;
        bestMoves = Math.min(bestMoves ?? Infinity, moves);
        saveProgress({ [bestKey]: bestMoves, [`bestTime_${size}`]: seconds });
        updateStatus({ score: pairs });
        ui.scheduler.timeout(
          () =>
            finish({
              title: newBest ? 'A new personal best!' : 'Every pair found!',
              message: `${size[0].toUpperCase() + size.slice(1)} board complete. ${hints ? 'A little help, a lovely finish.' : 'Nicely remembered.'}`,
              outcome: 'win',
              icon: '✨',
              score: pairs,
              stats: [
                ['Moves', moves],
                ['Time', time()],
                ['Hints', hints],
                ['Best moves', bestMoves],
              ],
            }),
          650,
        );
        return;
      }
    } else {
      misses++;
      locked = true;
      const pair = [...open];
      ui.scheduler.timeout(() => {
        pair.forEach((k) => {
          const c = root.querySelector(`[data-i="${k}"]`);
          if (c) {
            c.textContent = '✦';
            c.classList.remove('revealed');
            c.setAttribute('aria-label', `Hidden card ${k + 1}`);
          }
        });
        open = [];
        locked = false;
      }, 700);
    }
  }
  function clearHint() {
    ui.scheduler.clearTimeout(hintJob);
    hintJob = null;
    for (const k of hinted) {
      const card = root.querySelector(`[data-i="${k}"]`);
      card.classList.remove('hint-card');
      if (!card.classList.contains('done') && !open.includes(k)) {
        card.textContent = '✦';
        card.setAttribute('aria-label', `Hidden card ${k + 1}`);
      }
    }
    hinted = [];
  }
  function hint() {
    if (paused || ended || locked || open.length) return;
    clearHint();
    const i = cards.findIndex(
      (_, k) => !root.querySelector(`[data-i="${k}"]`).classList.contains('done'),
    );
    if (i < 0) return;
    const j = cards.findIndex(
      (v, k) =>
        k !== i &&
        v === cards[i] &&
        !root.querySelector(`[data-i="${k}"]`).classList.contains('done'),
    );
    hints++;
    hinted = [i, j];
    for (const k of hinted) {
      const card = root.querySelector(`[data-i="${k}"]`);
      card.textContent = cards[k];
      card.setAttribute('aria-label', `Hint: ${cards[k]}`);
      card.classList.add('hint-card');
    }
    hintJob = ui.scheduler.timeout(clearHint, 900);
  }
  start();
  return {
    pause: () => {
      paused = true;
      ui.scheduler.pause();
    },
    resume: () => {
      paused = false;
      ui.scheduler.resume();
    },
    restart: start,
    destroy: () => ui.destroy(),
  };
}
