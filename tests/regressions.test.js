import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import { games } from '../src/catalog/games.js';
import { createApp } from '../src/shell/app.js';
import { createGameHost } from '../src/shell/game-host.js';
import { createGameUI } from '../src/shared/game-ui.js';
import { advanceBall, clampPaddle, court, modes, serveBall } from '../src/games/pong/rules.js';
import { words } from '../src/games/word-scramble/words.js';

// Styles are verified by Vite/browser checks; Node tests exercise the real DOM logic.
registerHooks({
  load(url, context, next) {
    return url.endsWith('.css')
      ? { format: 'module', source: '', shortCircuit: true }
      : next(url, context);
  },
});
let dom, root, now, jobs, nextId, controllers, results, saved, statuses;
const originals = new Map();
const originalRandom = Math.random;
function global(name, value) {
  originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}
function advance(ms) {
  const end = now + ms;
  let iterations = 0;
  while (true) {
    const pending = [...jobs]
      .filter(([, job]) => job.at <= end)
      .sort((a, b) => a[1].at - b[1].at)[0];
    if (!pending) break;
    assert.ok(++iterations < 10000, 'timer loop must terminate');
    const [id, job] = pending;
    now = job.at;
    jobs.delete(id);
    job.fn();
  }
  now = end;
}
function click(selector) {
  const target = root.querySelector(selector);
  assert.ok(target, selector);
  target.click();
}
async function mount(id, options = {}, progress = {}) {
  const game = games.find((game) => game.id === id);
  const module = await game.load();
  const controller = module.mountGame({
    root,
    level: 1,
    options,
    progress,
    finish: (data) => results.push(data),
    saveProgress: (data) => saved.push(data),
    updateStatus: (data) => statuses.push(data),
  });
  controllers.push(controller);
  return controller;
}
beforeEach(() => {
  dom = new JSDOM('<main id="app"></main>', {
    url: 'https://playroom.test',
    pretendToBeVisual: true,
  });
  root = dom.window.document.querySelector('#app');
  now = 0;
  jobs = new Map();
  nextId = 0;
  controllers = [];
  results = [];
  saved = [];
  statuses = [];
  global('window', dom.window);
  global('document', dom.window.document);
  global('AbortController', dom.window.AbortController);
  global('performance', { now: () => now });
  dom.window.setTimeout = (fn, delay = 0) => {
    const id = ++nextId;
    jobs.set(id, { fn, at: now + delay });
    return id;
  };
  dom.window.clearTimeout = (id) => jobs.delete(id);
  global('requestAnimationFrame', (fn) => dom.window.setTimeout(() => fn(now), 16));
  global('cancelAnimationFrame', dom.window.clearTimeout);
  dom.window.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {} });
  dom.window.confirm = () => true;
  Math.random = () => 0.25;
});
afterEach(() => {
  controllers.reverse().forEach((controller) => controller.destroy());
  dom.window.close();
  Math.random = originalRandom;
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
  originals.clear();
});

for (const game of games) {
  test(`${game.title}: mount, pause, resume, restart and destroy`, async () => {
    const controller = await mount(game.id);
    assert.ok(root.textContent.trim());
    controller.pause();
    const pausedContent = root.innerHTML;
    advance(10000);
    assert.equal(root.innerHTML, pausedContent);
    controller.resume();
    controller.restart();
    assert.ok(root.textContent.trim());
    controller.destroy();
    assert.equal(jobs.size, 0);
    assert.equal(root.childElementCount, 0);
  });
}

test('Number Guess narrows the range, rejects invalid attempts, and saves an unaided record', async () => {
  await mount('number-guess', { range: '100' });
  const input = root.querySelector('#guess-input');
  for (const [guess, left, range] of [
    ['1.5', 7, '1–100'],
    ['10', 6, '11–100'],
    ['50', 5, '11–49'],
    ['10', 5, '11–49'],
  ]) {
    input.value = guess;
    click('.guess-form button');
    assert.equal(root.querySelector('#guess-left').textContent, String(left));
    assert.equal(root.querySelector('#guess-range').textContent, range);
  }
  assert.deepEqual(
    [...root.querySelectorAll('.guess-history li')].map((item) => item.textContent),
    ['50 · Go lower ↓', '10 · Go higher ↑'],
  );
  input.value = '26';
  click('.guess-form button');
  assert.equal(results[0].outcome, 'win');
  assert.deepEqual(saved, [{ bestGuesses_100: 3 }]);
});

test('Number Guess hints leave a reachable target and an assisted win outside the record', async () => {
  await mount('number-guess');
  click('#guess-hint');
  assert.match(root.querySelector('#guess-clue').textContent, /even/);
  click('#guess-hint');
  assert.equal(root.querySelector('#guess-range').textContent, '1–10');
  root.querySelector('#guess-input').value = '6';
  click('.guess-form button');
  assert.equal(results[0].outcome, 'win');
  assert.equal(saved.length, 0);
});

test('Quick Math accepts ten distinct questions with deliberate transitions and a missed-answer review', async () => {
  const controller = await mount('quick-math', { practice: 'addition' });
  const expressions = new Set();
  for (let i = 0; i < 10; i++) {
    const expression = root.querySelector('.math-expression').textContent;
    expressions.add(expression);
    const [a, b] = expression.match(/[0-9]+/g).map(Number);
    const correct = root.querySelector(`[data-answer="${a + b}"]`);
    const wrong = root.querySelector(`[data-answer]:not([data-answer="${a + b}"])`);
    click(
      i === 0
        ? `[data-answer="${wrong.dataset.answer}"]`
        : `[data-answer="${correct.dataset.answer}"]`,
    );
    correct.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
    advance(10000);
    assert.equal(root.querySelector('#math-heading').textContent, `Question ${i + 1} of 10`);
    assert.equal(Number(root.querySelector('#math-score').textContent), i);
    if (i === 0) {
      controller.pause();
      click('#math-next');
      assert.equal(root.querySelector('.math-expression').textContent, expression);
      controller.resume();
    }
    click('#math-next');
  }
  assert.equal(expressions.size, 10);
  assert.equal(results.length, 1);
  assert.equal(results[0].score, 9);
  assert.equal(results[0].review.entries.length, 1);
  assert.deepEqual(saved, [{ bestSet_addition: 9 }]);
});

test('Quick Math has three distinct choices throughout a subtraction set, including zero', async () => {
  await mount('quick-math', { practice: 'subtraction' });
  let sawZero = false;
  for (let i = 0; i < 10; i++) {
    const [a, b] = root
      .querySelector('.math-expression')
      .textContent.match(/[0-9]+/g)
      .map(Number);
    const choices = [...root.querySelectorAll('[data-answer]')].map((el) =>
      Number(el.dataset.answer),
    );
    assert.equal(new Set(choices).size, 3);
    assert.ok(a >= b && choices.includes(a - b));
    sawZero ||= a === b;
    click(`[data-answer="${a - b}"]`);
    click('#math-next');
  }
  assert.ok(sawZero);
});

test('Word Scramble supports a five-word set with changed scrambles, tiles, typing, clues, and skips', async () => {
  await mount('word-scramble', { length: 'long' });
  const played = new Set();
  function key(key) {
    root.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true }));
  }
  for (let i = 0; i < 5; i++) {
    const tiles = [...root.querySelectorAll('[data-letter]')];
    const scramble = tiles.map((tile) => tile.textContent).join('');
    const sorted = (value) => [...value].sort().join('');
    const category = root.querySelector('.word-category').textContent;
    const [, word] = words.find(
      ([group, word]) => group === category && sorted(word) === sorted(scramble),
    );
    assert.notEqual(scramble, word);
    played.add(word);
    if (i === 0) {
      click('#word-check');
      assert.match(root.querySelector('#word-feedback').textContent, /Fill every space/);
      click('#word-hint');
      click('#word-hint');
      assert.equal(root.querySelector('.word-slots span').textContent, word[0]);
      const first = root.querySelector('[data-letter][aria-disabled="true"]');
      for (const letter of word.slice(1)) {
        tiles
          .find(
            (tile) => tile.textContent === letter && tile.getAttribute('aria-disabled') !== 'true',
          )
          .click();
      }
      assert.equal(first.getAttribute('aria-disabled'), 'true');
      click('#word-remove');
      key(word.at(-1));
      key('Enter');
      assert.match(root.querySelector('#word-feedback').textContent, /You solved/);
    } else {
      click('#word-skip');
      assert.match(root.querySelector('#word-feedback').textContent, new RegExp(word));
    }
    click('#word-next');
  }
  assert.equal(played.size, 5);
  assert.equal(results[0].score, 1);
  assert.equal(results[0].review.entries.length, 4);
  assert.equal(saved[0].bestSolved_long, 1);
});

test('Connect Four locks AI turns and cancels pending moves on restart', async () => {
  const controller = await mount('connect-four');
  assert.equal(root.querySelectorAll('[data-col]').length, 7);
  click('[data-col="0"]');
  click('[data-col="1"]');
  assert.equal(root.querySelectorAll('.yellow').length, 0);
  advance(450);
  assert.equal(root.querySelectorAll('.yellow').length, 1);
  controller.restart();
  click('[data-col="0"]');
  controller.restart();
  advance(1000);
  assert.equal(root.querySelectorAll('.red, .yellow').length, 0);
});

test('Tic-Tac-Toe retains a match lead after a drawn final board', async () => {
  await mount('tic-tac-toe', { mode: 'local' });
  for (const cell of [0, 3, 1, 4, 2]) click(`[data-cell="${cell}"]`);
  click('#next-board');
  for (let round = 0; round < 2; round++) {
    for (const cell of [0, 1, 2, 4, 3, 5, 7, 6, 8]) click(`[data-cell="${cell}"]`);
    if (round === 0) click('#next-board');
    else advance(1000);
  }
  assert.equal(results.length, 1);
  assert.equal(results[0].title, 'X wins the match!');
  assert.equal(results[0].outcome, 'win');
  assert.match(results[0].message, /X 1 — 0 O/);
});

test('Connect Four credits a local Yellow winner', async () => {
  await mount('connect-four', { mode: 'local' });
  for (let round = 0; round < 2; round++) {
    for (const col of [0, 1, 0, 1, 2, 1, 2, 1]) click(`[data-col="${col}"]`);
    if (round === 0) click('#c4-next');
    else advance(1000);
  }
  assert.equal(results.length, 1);
  assert.equal(results[0].title, 'Yellow wins the match!');
  assert.equal(results[0].outcome, 'win');
});

test('Rock Paper Scissors locks each reveal, counts ties separately, and ends at the match goal', async () => {
  await mount('rock-paper-scissors', { match: '2' });
  click('[data-move="0"]');
  click('[data-move="1"]');
  assert.equal(root.querySelector('#rps-you').textContent, '0');
  assert.match(root.querySelector('#rps-feedback').textContent, /Tie/);
  click('#rps-next');
  for (let i = 1; i <= 2; i++) {
    click('[data-move="1"]');
    assert.equal(root.querySelector('#rps-you').textContent, String(i));
    assert.equal(results.length, 0);
    click('#rps-next');
  }
  assert.equal(results[0].outcome, 'win');
  assert.deepEqual(results[0].stats, [
    ['Round wins', 2],
    ['Ties', 1],
  ]);
});

test('Reaction Time preserves its panel and reports a median across five fresh trials', async () => {
  const controller = await mount('reaction-time');
  const panel = root.querySelector('#reaction');
  const press = (key, repeat = false) =>
    panel.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', { key, repeat, bubbles: true, cancelable: true }),
    );
  panel.focus();
  press('Enter');
  press('Enter', true);
  advance(1775);
  assert.equal(panel.textContent, 'GO!');
  assert.equal(document.activeElement, panel);
  controller.pause();
  advance(20000);
  press('Enter');
  controller.resume();
  assert.equal(panel.textContent, 'Wait…');
  press('Enter');
  assert.equal(panel.textContent, 'Too soon');
  click('#reaction-next');
  for (const ms of [200, 400, 300, 150, 250]) {
    advance(1775 + ms);
    assert.equal(root.querySelector('#reaction'), panel);
    press(' ');
    press('Enter');
    assert.equal(panel.textContent, `${ms} ms`);
    click('#reaction-next');
  }
  assert.equal(results.length, 1);
  assert.deepEqual(results[0].stats, [
    ['Median', '250 ms'],
    ['Fastest this set', '150 ms'],
    ['Personal best', '150 ms'],
    ['Early taps', 1],
  ]);
  assert.deepEqual(saved, [{ bestMs: 200 }, { bestMs: 150 }]);
});

test('Color Clicker retains a missed target and ends untimed practice after ten matches', async () => {
  await mount('color-clicker');
  const board = root.querySelector('#color-target');
  const first = board.textContent;
  click('[data-color="2"]');
  assert.equal(board.textContent, first);
  assert.match(root.querySelector('#color-feedback').textContent, /Try again/);
  for (let i = 0; i < 10; i++) {
    const previous = board.dataset.tone;
    click(`[data-color][data-tone="${previous}"]`);
    if (i < 9) assert.notEqual(board.dataset.tone, previous);
  }
  assert.equal(results[0].score, 10);
  assert.deepEqual(saved, []);
});

test('Color Clicker freezes its timed countdown on pause and ignores taps before Go', async () => {
  const controller = await mount('color-clicker', { mode: 'timed' });
  click('[data-color="1"]');
  advance(1500);
  controller.pause();
  advance(30000);
  assert.match(root.querySelector('#color-time').textContent, /Starting in 2/);
  controller.resume();
  advance(1500);
  click('[data-color="1"]');
  advance(15000);
  assert.equal(results[0].score, 1);
  assert.deepEqual(saved, [{ bestScore_timed: 1 }]);
});

test('Relaxed Whack-a-Mole keeps hole focus and one hit per mole until ten', async () => {
  await mount('whack-a-mole');
  const hole = root.querySelector('[data-state="up"]');
  hole.focus();
  advance(5000);
  assert.equal(root.querySelector('[data-state="up"]'), hole);
  for (let i = 0; i < 10; i++) {
    const target = root.querySelector('[data-state="up"]');
    target.click();
    target.click();
    assert.equal(root.querySelector('#mole-score').textContent, `${i + 1}/10`);
    advance(350);
  }
  assert.equal(results[0].score, 10);
  assert.equal(document.activeElement, hole);
  assert.deepEqual(saved, []);
});

test('Timed Whack-a-Mole distinguishes escaped moles and empty taps and ends once', async () => {
  await mount('whack-a-mole', { mode: 'timed' });
  advance(3000);
  click('[data-hole="0"]');
  advance(1050);
  assert.match(root.querySelector('#mole-feedback').textContent, /got away/);
  advance(14500);
  assert.equal(results.length, 1);
  assert.ok(results[0].stats.find(([label, count]) => label === 'Escaped' && count > 0));
  assert.ok(results[0].stats.find(([label, count]) => label === 'Empty taps' && count === 1));
});

test('Simon Says restarts interrupted playback and keeps a replay out of its unaided record', async () => {
  const controller = await mount('simon-says');
  const button = root.querySelector('[data-pad="1"]');
  advance(650);
  assert.equal(button.dataset.lit, 'true');
  controller.pause();
  advance(5000);
  button.click();
  controller.resume();
  assert.match(root.querySelector('#simon-state').textContent, /restarted/);
  advance(1750);
  button.click();
  assert.deepEqual(saved, [{ bestSequence_gentle: 1 }]);
  assert.match(root.querySelector('#simon-state').textContent, /Adding one more step/);
  advance(300);
  controller.pause();
  advance(5000);
  controller.resume();
  advance(399);
  assert.equal(root.querySelector('#simon-length').textContent, '1');
  advance(2851);
  button.click();
  assert.match(root.querySelector('#simon-count').textContent, /1 of 2/);
  click('#simon-replay');
  button.click();
  controller.pause();
  advance(3000);
  controller.resume();
  advance(2850);
  button.click();
  button.click();
  assert.equal(root.querySelector('[data-pad="1"]'), button);
  advance(4650);
  click('[data-pad="0"]');
  assert.equal(results[0].score, 2);
  assert.deepEqual(saved, [{ bestSequence_gentle: 1 }]);
  assert.equal(results[0].stats[1][1], 1);
});

test('Simon Says continues past twelve patterns and finishes on the first mistake', async () => {
  await mount('simon-says', { pace: 'steady' });
  const correctPad = root.querySelector('[data-pad="1"]');
  assert.equal(root.querySelector('#simon-next'), null);
  advance(1350);
  for (let round = 1; round <= 13; round++) {
    for (let tap = 0; tap < round; tap++) correctPad.click();
    click('[data-pad="0"]');
    assert.equal(results.length, 0);
    advance(700 + 650 + (round + 1) * 700);
    assert.equal(root.querySelector('#simon-length').textContent, String(round + 1));
  }
  click('[data-pad="0"]');
  assert.equal(results.length, 1);
  assert.equal(results[0].score, 13);
});

test('Memory Match hint expiry never hides a newly opened card', async () => {
  await mount('memory-match');
  click('#mem-help');
  const card = root.querySelector('.hint-card');
  const face = card.textContent;
  card.click();
  advance(1000);
  assert.equal(card.textContent, face);
  assert.equal(root.querySelectorAll('.hint-card').length, 0);
  click('#mem-help');
  assert.equal(root.querySelectorAll('.hint-card').length, 0);
});

test('2048 merges once, ignores no-op moves, and undo restores the board', async () => {
  Math.random = () => 0;
  await mount('2048');
  const board = () => [...root.querySelector('#g2048').children].map((el) => el.textContent);
  const initial = board();
  click('[data-dir="up"]');
  assert.deepEqual(board(), initial);
  click('[data-dir="left"]');
  assert.deepEqual(board().slice(0, 4), ['4', '2', '', '']);
  click('#undo');
  assert.deepEqual(board(), initial);
});

function hostWith(load) {
  const progressStore = {
    load: () => ({ games: {}, best: {}, badges: [], wins: 0, theme: 'classic' }),
    dailyGameId: () => 'test',
    recordResult: (data) => results.push(data),
    saveGame: (data) => saved.push(data),
  };
  const entries = [
    { id: 'test', title: 'Test', description: 'Test game', icon: '🎮', category: 'Puzzle', load },
  ];
  const app = createApp({ root, games: entries, progressStore });
  app.destroy();
  const host = createGameHost({ root, games: entries, progressStore });
  controllers.push(host);
  host.open('test');
  click('[data-action="start"]');
  return host;
}
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

test('Host applies pause to a game that finishes loading while paused', async () => {
  let resolve,
    pauses = 0,
    resumes = 0;
  const host = hostWith(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  host.pause();
  resolve({ mountGame: () => ({ pause: () => pauses++, resume: () => resumes++, destroy() {} }) });
  await flush();
  assert.equal(pauses, 1);
  host.resume();
  assert.equal(resumes, 1);
});

test('Host cleans partial mounts, exposes retry/back and ignores stale callbacks', async () => {
  let oldFinish,
    attempts = 0;
  const error = console.error;
  console.error = () => {};
  try {
    hostWith(async () => ({
      mountGame: ({ root, finish }) => {
        const ui = createGameUI(root, '<button>Partial</button>');
        ui.scheduler.interval(() => {}, 10);
        oldFinish = finish;
        attempts++;
        throw new Error('deliberate mount failure');
      },
    }));
    await flush();
    assert.equal(jobs.size, 0);
    assert.ok(root.querySelector('[data-action="retry"]'));
    const stale = oldFinish;
    click('[data-action="retry"]');
    await flush();
    assert.equal(attempts, 2);
    stale({ title: 'Stale', score: 99 });
    assert.equal(results.length, 0);
    click('[data-action="back"]');
    assert.equal(root.querySelector('#playOverlay').classList.contains('show'), false);
  } finally {
    console.error = error;
  }
});

test('Host auto-pauses when hidden and isolates finished games', async () => {
  let finish,
    pauses = 0;
  const host = hostWith(async () => ({
    mountGame: (args) => {
      finish = args.finish;
      return { pause: () => pauses++, resume() {}, destroy() {} };
    },
  }));
  await flush();
  Object.defineProperty(document, 'hidden', { value: true, configurable: true });
  document.dispatchEvent(new dom.window.Event('visibilitychange'));
  assert.equal(pauses, 1);
  assert.equal(root.querySelector('#pauseScreen').classList.contains('show'), true);
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  host.resume();
  finish({ title: 'Done', score: 1 });
  finish({ title: 'Duplicate', score: 2 });
  assert.equal(results.length, 1);
  assert.equal(root.querySelector('#gameRoot').inert, true);
  assert.equal(root.querySelector('.modalhead').inert, true);
});

test('Snake permits the departing tail, rejects occupied body, and handles a full board', async () => {
  const { chooseFood, collides } = await import('../src/games/snake/rules.js');
  const snake = [
    [1, 1],
    [1, 0],
    [0, 0],
    [0, 1],
  ];
  assert.equal(collides(snake, [0, 1], false, 3), false);
  assert.equal(collides(snake, [0, 1], true, 3), true);
  assert.equal(collides(snake, [1, 0], false, 3), true);
  assert.equal(collides(snake, [-1, 1], false, 3), true);
  assert.equal(chooseFood(snake, 2), null);
  assert.deepEqual(
    chooseFood(
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      2,
    ),
    [1, 1],
  );
});

test('Scheduler preserves timeout remainder across pause and cancels teardown jobs', async () => {
  const { createPausableScheduler } = await import('../src/shared/pausable-scheduler.js');
  const scheduler = createPausableScheduler();
  let count = 0;
  scheduler.timeout(() => count++, 1000);
  advance(300);
  scheduler.pause();
  advance(5000);
  assert.equal(count, 0);
  scheduler.resume();
  advance(699);
  assert.equal(count, 0);
  advance(1);
  assert.equal(count, 1);
  scheduler.interval(() => count++, 10);
  scheduler.destroy();
  advance(100);
  assert.equal(count, 1);
  assert.equal(jobs.size, 0);
});

test('Tic-Tac-Toe locks AI turns and cancels pending moves on restart', async () => {
  const controller = await mount('tic-tac-toe');
  click('[data-cell="0"]');
  click('[data-cell="1"]');
  assert.equal(root.querySelector('[data-cell="1"]').textContent, '');
  advance(450);
  assert.equal(
    [...root.querySelectorAll('[data-cell]')].filter((el) => el.textContent === 'O').length,
    1,
  );
  controller.restart();
  click('[data-cell="0"]');
  controller.restart();
  advance(1000);
  assert.ok([...root.querySelectorAll('[data-cell]')].every((el) => !el.textContent));
});

test('Hard Tic-Tac-Toe cannot lose against any human move sequence', async () => {
  const { bestMove, winningLine } = await import('../src/games/tic-tac-toe/rules.js');
  function explore(board) {
    assert.equal(!!winningLine(board, 'X'), false);
    if (winningLine(board, 'O') || board.every(Boolean)) return;
    for (let i = 0; i < 9; i++) {
      if (board[i]) continue;
      const next = board.slice();
      next[i] = 'X';
      assert.equal(!!winningLine(next, 'X'), false);
      if (next.every(Boolean)) continue;
      const before = next.slice();
      const move = bestMove(next);
      assert.deepEqual(next, before, 'search does not mutate the board');
      assert.equal(next[move], '');
      next[move] = 'O';
      explore(next);
    }
  }
  explore(Array(9).fill(''));
});

test('Memory boards use explicit size and save size-specific records', async () => {
  await mount('memory-match', { size: 'large' });
  assert.equal(root.querySelectorAll('[data-i]').length, 16);
  for (let i = 0; i < 8; i++) {
    click('#mem-help');
    const hinted = [...root.querySelectorAll('.hint-card')];
    assert.equal(hinted.length, 2);
    hinted[0].click();
    hinted[1].click();
  }
  assert.equal(results.length, 0, 'final board stays visible briefly');
  advance(650);
  assert.equal(results.length, 1);
  assert.equal(saved[0].bestMoves_large, 8);
  assert.equal(saved[0].bestMoves, undefined);
  assert.equal(results[0].stats.find(([key]) => key === 'Hints')[1], 8);
});

test('Snake buffers legal turns and gives a fresh countdown after resume', async () => {
  const { queueDirection } = await import('../src/games/snake/rules.js');
  assert.deepEqual(queueDirection('right', [], 'left'), []);
  const queue = queueDirection('right', [], 'up');
  assert.deepEqual(queueDirection('right', queue, 'left'), ['up', 'left']);
  assert.deepEqual(queueDirection('right', queue, 'down'), ['up']);
  const controller = await mount('snake', { speed: 'fast' });
  assert.equal(root.querySelector('#snake-ready').hidden, false);
  advance(2100);
  assert.equal(root.querySelector('#snake-ready').hidden, true);
  controller.pause();
  advance(5000);
  controller.resume();
  assert.equal(root.querySelector('#snake-ready').textContent, 'Ready? 3');
  assert.equal(results.length, 0);
  advance(2100);
  assert.equal(root.querySelector('#snake-ready').hidden, true);
});

test('Host retains selected settings for replay and exposes setup separately', async () => {
  const mounted = [];
  const savedGames = {};
  const progressStore = {
    load: () => ({ games: savedGames, best: {}, badges: [], wins: 0, theme: 'classic' }),
    dailyGameId: () => 'memory-match',
    recordResult() {},
    saveGame: (id, patch) => {
      savedGames[id] = { ...savedGames[id], ...patch };
    },
  };
  const entry = {
    ...games.find((game) => game.id === 'memory-match'),
    load: async () => ({
      mountGame: (args) => {
        mounted.push(args);
        return { pause() {}, resume() {}, destroy() {} };
      },
    }),
  };
  const app = createApp({ root, games: [entry], progressStore });
  controllers.push(app);
  click('.card');
  const radio = root.querySelector('[value="large"]');
  radio.checked = true;
  radio.dispatchEvent(new dom.window.Event('change'));
  click('[data-action="start"]');
  await flush();
  assert.deepEqual(mounted[0].options, { size: 'large' });
  mounted[0].finish({ title: 'Done', outcome: 'win', stats: [['Moves', 8]] });
  click('#playAgain');
  await flush();
  assert.deepEqual(mounted[1].options, { size: 'large' });
  mounted[1].finish({ title: 'Done', outcome: 'win' });
  click('#changeSettings');
  assert.equal(root.querySelector('[value="large"]').checked, true);
  assert.equal(root.querySelectorAll('.setup-options').length, 1);
  assert.deepEqual(savedGames['memory-match'].settings, { size: 'large' });
});

test('Quit uses an in-game confirmation, keeps the current round on cancel, and restores catalog focus', async () => {
  global('localStorage', dom.window.localStorage);
  const progressStore = await import('../src/shell/progress-store.js');
  let pauses = 0;
  let resumes = 0;
  let exits = 0;
  const entry = {
    ...games.find((game) => game.id === 'simon-says'),
    load: async () => ({
      mountGame: ({ root }) => {
        root.innerHTML = '<button id="gameControl">A pad</button>';
        return { pause: () => pauses++, resume: () => resumes++, destroy: () => exits++ };
      },
    }),
  };
  const app = createApp({ root, games: [entry], progressStore });
  controllers.push(app);
  window.confirm = () => assert.fail('Round navigation must use the in-game prompt');
  const card = root.querySelector('.card');
  card.focus();
  card.click();
  click('[data-action="start"]');
  await flush();
  const control = root.querySelector('#gameControl');
  control.focus();
  click('#pauseButton');
  click('#quitGame');
  assert.equal(root.querySelector('#roundExit').hidden, false);
  assert.equal(document.activeElement.id, 'keepPlaying');
  assert.equal(pauses, 1);
  assert.equal(exits, 0);
  document.activeElement.dispatchEvent(
    new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
  );
  assert.equal(root.querySelector('#roundExit').hidden, true);
  assert.equal(document.activeElement.id, 'quitGame');
  click('#quitGame');
  click('#keepPlaying');
  assert.equal(root.querySelector('#pauseScreen').classList.contains('show'), false);
  assert.equal(document.activeElement, control);
  assert.equal(resumes, 1);
  click('#pauseButton');
  click('#pauseSettings');
  assert.equal(root.querySelector('#exitTitle').textContent, 'Change settings?');
  click('#confirmExit');
  assert.ok(root.querySelector('[data-action="start"]'));
  click('[data-action="start"]');
  await flush();
  click('#pauseButton');
  click('#quitGame');
  click('#confirmExit');
  assert.equal(exits, 2);
  assert.equal(root.querySelector('#playOverlay').classList.contains('show'), false);
  assert.equal(document.activeElement, card);
});

test('Progress compares memory records within each board size', async () => {
  global('localStorage', dom.window.localStorage);
  const store = await import('../src/shell/progress-store.js');
  store.saveGame('memory-match', { bestMoves_small: 8, bestMoves_large: 20 });
  store.saveGame('memory-match', { bestMoves_small: 10, bestMoves_large: 17 });
  assert.deepEqual(store.load().games['memory-match'], { bestMoves_small: 8, bestMoves_large: 17 });
});

test('2048 merges once per tile in all directions without mutating the source', async () => {
  const { moveBoard, canMove } = await import('../src/games/2048/rules.js');
  const board = [
    [2, 2, 2, 2],
    [4, 4, 8, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const before = JSON.stringify(board);
  assert.deepEqual(moveBoard(board, 'left').board[0], [4, 4, 0, 0]);
  assert.deepEqual(moveBoard(board, 'left').board[1], [8, 8, 0, 0]);
  assert.equal(moveBoard(board, 'left').gained, 16);
  assert.deepEqual(moveBoard(board, 'right').board[1], [0, 0, 8, 8]);
  const vertical = [
    [2, 0, 0, 0],
    [2, 0, 0, 0],
    [2, 0, 0, 0],
    [2, 0, 0, 0],
  ];
  assert.deepEqual(
    moveBoard(vertical, 'up').board.map((row) => row[0]),
    [4, 4, 0, 0],
  );
  assert.deepEqual(
    moveBoard(vertical, 'down').board.map((row) => row[0]),
    [0, 0, 4, 4],
  );
  assert.equal(JSON.stringify(board), before);
  assert.equal(
    canMove([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ]),
    false,
  );
  assert.equal(
    canMove([
      [2, 2, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ]),
    true,
  );
});

test('2048 preserves controls and focus, confirms restart, and keeps best after undo', async () => {
  Math.random = () => 0;
  await mount('2048');
  const button = root.querySelector('[data-dir="left"]');
  button.focus();
  button.click();
  assert.equal(document.activeElement, button);
  assert.equal(root.querySelector('[data-dir="left"]'), button);
  assert.equal(root.querySelector('#tile-score').textContent, '4');
  assert.equal(saved[0].bestScore_2048, 4);
  click('#undo');
  assert.equal(root.querySelector('#tile-score').textContent, '0');
  assert.equal(root.querySelector('#tile-best').textContent, '4');
  button.click();
  advance(140);
  const before = root.querySelector('#g2048').textContent;
  window.confirm = () => false;
  click('#restart2048');
  assert.equal(root.querySelector('#g2048').textContent, before);
  window.confirm = () => true;
  click('#restart2048');
  assert.equal(root.querySelector('#tile-score').textContent, '0');
});

test('2048 offers undo on a blocked board before recording a result', async () => {
  let seed = 321;
  Math.random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  await mount('2048');
  const directions = ['up', 'left', 'down', 'right'];
  for (let i = 0; i < 2000 && root.querySelector('#finish2048').hidden && !results.length; i++) {
    click(`[data-dir="${directions[i % 4]}"]`);
    advance(150);
  }
  assert.equal(results.length, 0);
  assert.equal(root.querySelector('#finish2048').hidden, false);
  assert.equal(root.querySelector('#undo').disabled, false);
  click('#undo');
  assert.equal(root.querySelector('#finish2048').hidden, true);
  assert.equal(root.querySelector('#undo').disabled, true);
});

test('Connect Four finds all winning directions and Smart takes wins and blocks', async () => {
  const { winningCells, chooseColumn, landingRow } =
    await import('../src/games/connect-four/rules.js');
  for (const points of [
    [
      [5, 0],
      [5, 1],
      [5, 2],
      [5, 3],
    ],
    [
      [5, 0],
      [4, 0],
      [3, 0],
      [2, 0],
    ],
    [
      [5, 0],
      [4, 1],
      [3, 2],
      [2, 3],
    ],
    [
      [5, 6],
      [4, 5],
      [3, 4],
      [2, 3],
    ],
  ]) {
    const board = Array.from({ length: 6 }, () => Array(7).fill(0));
    points.forEach(([r, c]) => {
      board[r][c] = 1;
    });
    assert.equal(winningCells(board, ...points[0], 1).length, 4);
  }
  for (const player of [1, 2]) {
    const board = Array.from({ length: 6 }, () => Array(7).fill(0));
    board[5] = [player, player, player, 0, 0, 0, 0];
    const original = JSON.stringify(board);
    assert.equal(chooseColumn(board, true), 3);
    assert.equal(JSON.stringify(board), original);
  }
  const full = Array.from({ length: 6 }, () => Array(7).fill(1));
  assert.equal(landingRow(full, 0), -1);
  assert.equal(chooseColumn(full, true), undefined);
});

test('Connect Four reports full columns without losing a turn', async () => {
  await mount('connect-four', { mode: 'local' });
  for (let i = 0; i < 6; i++) click('[data-col="0"]');
  click('[data-col="0"]');
  assert.match(root.querySelector('#c4-status').textContent, /full/);
  click('[data-col="1"]');
  assert.equal(root.querySelector('[data-cell="36"]').textContent, '●');
});

test('Pong reflects wall overshoot and returns balls from both paddle faces at a bounded speed', () => {
  const mode = modes.normal;
  const wall = { x: 300, y: 8.5, vx: -300, vy: -240 };
  advanceBall(wall, 180, 180, mode);
  assert.equal(wall.y, 9.5);
  assert.equal(wall.vy, 240);

  const face = court.inset + court.paddleWidth + court.radius;
  for (const direction of [-1, 1]) {
    const x = direction === -1 ? face + 4 : court.width - face - 4;
    const ball = { x, y: 195, vx: direction * (mode.speedCap - 5), vy: 0 };
    const point = advanceBall(ball, 180, 180, mode);
    assert.equal(point, null);
    assert.equal(Math.sign(ball.vx), -direction);
    assert.ok(ball.vy > 0);
    assert.ok(Math.abs(Math.hypot(ball.vx, ball.vy) - mode.speedCap) < 0.001);
  }
  assert.equal(clampPaddle(-100, mode.playerSize), mode.playerSize / 2);
  assert.equal(clampPaddle(500, mode.opponentSize), court.height - mode.opponentSize / 2);
  assert.ok(serveBall(-1, mode, () => 0.3).vx < 0);
});

test('Pong only scores after the whole ball leaves and cannot return a ball from behind a paddle', () => {
  const mode = modes.easy;
  const face = court.inset + court.paddleWidth + court.radius;
  const ball = { x: face + 1, y: 18, vx: -290, vy: 0 };
  assert.equal(advanceBall(ball, 180, 180, mode), null);
  assert.ok(ball.x < face);
  assert.equal(advanceBall(ball, 18, 180, mode), null);
  assert.ok(ball.vx < 0);
  assert.equal(advanceBall({ ...ball, x: -5 }, 180, 180, mode), null);
  assert.equal(advanceBall({ ...ball, x: -7 }, 180, 180, mode), 'computer');
  assert.equal(advanceBall({ ...ball, x: 607, vx: 290 }, 180, 180, mode), 'player');
});

test('Pong holds keys and captured pointers, clamps drag, and freezes the rally on pause', async () => {
  let paddleY, ballXY;
  dom.window.HTMLCanvasElement.prototype.getContext = () =>
    new Proxy(
      {
        fillRect: (x, y) => {
          if (x === court.inset) paddleY = y;
        },
        arc: (x, y, radius) => {
          if (radius === court.radius) ballXY = [x, y];
        },
      },
      { get: (object, name) => object[name] || (() => {}) },
    );

  const controller = await mount('pong');
  const canvas = root.querySelector('canvas');
  const up = root.querySelector('[data-pong-direction="-1"]');
  canvas.getBoundingClientRect = () => ({ top: 50, height: 180 });
  function key(type, key) {
    up.dispatchEvent(new dom.window.KeyboardEvent(type, { key, bubbles: true, cancelable: true }));
  }
  function pointer(target, type, clientY, pointerId) {
    target.dispatchEvent(
      new dom.window.PointerEvent(type, { clientY, pointerId, button: 0, bubbles: true }),
    );
  }
  key('keydown', 'ArrowDown');
  advance(300);
  assert.ok(paddleY > 200);
  key('keyup', 'ArrowDown');
  pointer(up, 'pointerdown', 0, 1);
  advance(400);
  assert.ok(paddleY < 100);
  pointer(up, 'lostpointercapture', 0, 1);
  pointer(canvas, 'pointerdown', 100, 2);
  pointer(canvas, 'pointermove', -200, 2);
  advance(225);
  assert.equal(paddleY, 0);
  pointer(canvas, 'pointerup', -200, 2);
  advance(1400);
  const beforePause = ballXY;
  controller.pause();
  advance(5000);
  assert.deepEqual(ballXY, beforePause);
  controller.resume();
  advance(1900);
  assert.deepEqual(ballXY, beforePause);
  assert.match(root.querySelector('.pong-countdown').textContent, /Rally resumes/);
  advance(300);
  assert.notDeepEqual(ballXY, beforePause);
  controller.destroy();
  assert.equal(jobs.size, 0);
});

test('Pong shows the fifth point before recording the match result', async () => {
  await mount('pong');
  const computer = root.querySelector('#pong-computer');
  for (let i = 0; i < 750 && computer.textContent !== '5'; i++) advance(100);
  assert.equal(computer.textContent, '5');
  assert.equal(results.length, 0);
  assert.match(root.querySelector('#pong-feedback').textContent, /computer 5/);
  advance(850);
  assert.equal(results.length, 1);
  assert.equal(results[0].outcome, 'loss');
});

test('The catalog opens direct game links and clears an empty search without losing the project path', async () => {
  global('localStorage', dom.window.localStorage);
  const progressStore = await import('../src/shell/progress-store.js');
  window.history.replaceState(null, '', '/preview/?game=simon-says&from=test');
  const app = createApp({ root, games, progressStore });
  controllers.push(app);
  assert.equal(root.querySelector('#gameTitle').textContent, 'Simon Says');
  assert.equal(root.querySelector('#pauseButton').hidden, true);
  click('[data-action="back"]');
  assert.equal(window.location.pathname, '/preview/');
  assert.equal(window.location.search, '?from=test');

  click('[data-cat="Puzzle"]');
  const search = root.querySelector('#search');
  search.value = 'no such game';
  search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.equal(root.querySelector('#catalogEmpty').hidden, false);
  click('#clearSearch');
  assert.equal(document.activeElement, search);
  assert.equal(root.querySelectorAll('.card').length, games.length);
  assert.equal(root.querySelector('[data-cat="All"]').getAttribute('aria-pressed'), 'true');

  click('[aria-label="Play Number Guess"]');
  assert.equal(new URL(window.location.href).searchParams.get('game'), 'number-guess');
  assert.equal(root.querySelector('#gameTitle').textContent, 'Number Guess');
});

test('Progress remains usable for the visit when persistent storage is blocked', async () => {
  const blocked = () => {
    throw new Error('Storage blocked');
  };
  global('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked });
  const progressStore = await import('../src/shell/progress-store.js');
  try {
    assert.equal(progressStore.canSaveProgress(), false);
    progressStore.recordResult({ gameId: 'pong', title: 'Pong', outcome: 'win', score: 5 });
    assert.equal(progressStore.load().played, 1);
    assert.equal(progressStore.load().games.pong.bestScore, 5);
    progressStore.reset();
    assert.equal(progressStore.load().played, 0);
  } finally {
    Object.defineProperty(globalThis, 'localStorage', {
      value: dom.window.localStorage,
      configurable: true,
    });
    progressStore.reset();
  }
});

test('Discovery combines category, player count, timing and search, and restores focus on setup exit', async () => {
  global('localStorage', dom.window.localStorage);
  const store = await import('../src/shell/progress-store.js');
  controllers.push(createApp({ root, games, progressStore: store }));
  const search = root.querySelector('#search');
  function searchFor(query) {
    search.value = query;
    search.dispatchEvent(new dom.window.Event('input'));
  }
  searchFor('two players');
  assert.ok(root.querySelector('[aria-label="Play Tic-Tac-Toe"]'));
  assert.ok(root.querySelector('[aria-label="Play Connect Four"]'));
  click('[data-cap="twoPlayers"]');
  click('[data-cap="noTimer"]');
  click('[data-cat="Classic"]');
  searchFor('untimed');
  const card = root.querySelector('[aria-label="Play Connect Four"]');
  card.click();
  assert.equal(root.querySelector('#pauseButton').hidden, true);
  click('[data-action="back"]');
  assert.equal(document.activeElement, card);
  assert.equal(store.load().played, 0);
  assert.equal(search.value, 'untimed');
  assert.equal(root.querySelector('[data-cap="twoPlayers"]').getAttribute('aria-pressed'), 'true');
  searchFor('Snake');
  assert.equal(root.querySelector('#catalogEmpty').hidden, false);
  click('#clearSearch');
  assert.equal(root.querySelectorAll('.card').length, games.length);
  assert.equal(root.querySelectorAll('[data-cap][aria-pressed="true"]').length, 0);
});

test('Finished rounds unlock themes across outcomes and preserve saved progress', async () => {
  global('localStorage', dom.window.localStorage);
  const store = await import('../src/shell/progress-store.js');
  localStorage.setItem(
    'playroom-progress-v1',
    JSON.stringify({
      played: 2,
      wins: 0,
      theme: 'classic',
      badges: ['First round'],
      games: { pong: { settings: { difficulty: 'easy' } } },
    }),
  );
  assert.equal(store.chooseTheme('berry').theme, 'classic');
  store.recordResult({ gameId: 'pong', title: 'Pong', outcome: 'loss' });
  assert.equal(store.chooseTheme('berry').theme, 'berry');
  for (let i = 0; i < 4; i++) store.recordResult({ outcome: 'draw' });
  assert.equal(store.chooseTheme('ocean').theme, 'berry');
  store.recordResult({ outcome: 'win' });
  const progress = store.chooseTheme('ocean');
  assert.equal(progress.theme, 'ocean');
  assert.equal(progress.wins, 1);
  assert.equal(progress.games.pong.settings.difficulty, 'easy');
});

test('Only wins count toward the Five wins badge', async () => {
  global('localStorage', dom.window.localStorage);
  const store = await import('../src/shell/progress-store.js');
  localStorage.setItem(
    'playroom-progress-v1',
    JSON.stringify({ played: 7, wins: 4, theme: 'berry', badges: ['First round'] }),
  );
  store.recordResult({ gameId: 'reaction-time', title: 'Reaction Time', outcome: 'complete' });
  const completed = store.load();
  assert.equal(completed.played, 8);
  assert.equal(completed.wins, 4);
  assert.equal(completed.theme, 'berry');
  assert.deepEqual(completed.badges, ['First round']);

  store.recordResult({ gameId: 'pong', title: 'Pong', outcome: 'win' });
  store.recordResult({ gameId: 'reaction-time', title: 'Reaction Time', outcome: 'complete' });
  const progress = store.load();
  assert.equal(progress.played, 10);
  assert.equal(progress.wins, 5);
  assert.deepEqual(progress.badges, ['First round', 'Five wins']);
});

test('Simon recognizes a pace-specific improvement and does not celebrate a tie', async () => {
  const controller = await mount('simon-says', { pace: 'steady' }, { bestSequence_gentle: 5 });
  function playOne() {
    advance(1350);
    click('[data-pad="1"]');
    advance(2750);
    click('[data-pad="0"]');
  }
  playOne();
  assert.equal(results[0].title, 'New personal best!');
  controller.restart();
  playOne();
  assert.equal(results[1].title, 'Pattern ended');
});
