import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import { patternDetectiveEntry } from '../src/games/pattern-detective/entry.js';
import {
  createPuzzleRun,
  fallbackBank,
  signatureOf,
  tileLabel,
} from '../src/games/pattern-detective/puzzles.js';
import { createApp } from '../src/shell/app.js';
import * as store from '../src/shell/progress-store.js';

registerHooks({
  load(url, context, next) {
    return url.endsWith('.css')
      ? { format: 'module', source: '', shortCircuit: true }
      : next(url, context);
  },
});

function independentlySolves(kind, tiles) {
  if (kind === 'combined') {
    const values = tiles.map((tile) => tile.split('/').map(Number));
    return (
      independentlySolves(
        'rotation',
        values.map(([arrow]) => arrow),
      ) &&
      independentlySolves(
        'quantity',
        values.map(([, count]) => count),
      )
    );
  }
  if (kind === 'repetition') {
    for (let length = 2; length * 2 < tiles.length && length <= 4; length++) {
      if (tiles.slice(length).every((tile, index) => tile === tiles[index])) return true;
    }
    return false;
  }
  const modular = kind === 'rotation';
  const step = (start, end) => (modular ? (end + 4 - start) % 4 : end - start);
  const first = step(tiles[0], tiles[1]);
  const second = step(tiles[1], tiles[2]);
  if (!first || !second) return false;
  return tiles
    .slice(1)
    .every((tile, index) => step(tiles[index], tile) === (index % 2 === 0 ? first : second));
}

function candidates(puzzle) {
  const { mode, shown, positions, choices } = puzzle;
  if (mode === 'repair') {
    return shown.flatMap((original, index) =>
      choices.filter((choice) => choice !== original).map((choice) => [[index, choice]]),
    );
  }
  let drafts = [[]];
  for (const position of positions) {
    drafts = drafts.flatMap((draft) => choices.map((choice) => [...draft, [position, choice]]));
  }
  return drafts;
}

function assertUniqueAnswer(puzzle) {
  const correct = candidates(puzzle).filter((draft) => {
    const completed = [...puzzle.shown];
    for (const [index, value] of draft) completed[index] = value;
    return independentlySolves(puzzle.kind, completed);
  });
  assert.deepEqual(correct, [
    puzzle.positions.map((position, index) => [position, puzzle.answers[index]]),
  ]);
}

test('1,000 deterministic procedural puzzles have one solution and never repeat recent patterns', () => {
  for (let seed = 0; seed < 10; seed++) {
    const run = createPuzzleRun(seed);
    const duplicate = createPuzzleRun(seed);
    const signatures = [];
    const order = [];
    for (let level = 1; level <= 100; level++) {
      const puzzle = run.next();
      assert.deepEqual(puzzle, duplicate.next());
      assert.equal(puzzle.level, level);
      const prior = order.at(-1);
      if (prior) assert.notEqual(puzzle.mode, prior[0]);
      order.push([puzzle.mode, puzzle.kind]);
      assert.equal(new Set(puzzle.choices).size, puzzle.choices.length);
      assert.ok(puzzle.choices.length >= 3 && puzzle.choices.length <= 4);
      assert.ok(puzzle.shown.length <= 10);
      const signature = signatureOf(puzzle);
      assert.equal(signatureOf({ ...puzzle, choices: [...puzzle.choices].reverse() }), signature);
      assert.ok(!signatures.slice(-12).includes(signature));
      signatures.push(signature);
      assertUniqueAnswer(puzzle);
      if (level % 5 === 0)
        assert.equal(new Set(order.slice(-5).map((item) => item.join('/'))).size, 5);
      if (puzzle.mode === 'extend') assert.equal(puzzle.positions.length, level > 15 ? 3 : 2);
    }
    assert.ok(
      new Set(
        Array.from({ length: 19 }, (_, index) =>
          JSON.stringify(order.slice((index + 1) * 5, (index + 2) * 5)),
        ),
      ).size > 1,
    );
  }
});

test('Every difficulty has more verified fallback signatures than the recent window can hold', () => {
  for (const [kind, mode] of [
    ['repetition', 'fill'],
    ['rotation', 'repair'],
    ['quantity', 'extend'],
    ['repetition', 'repair'],
    ['combined', 'extend'],
  ]) {
    for (let tier = 0; tier < 4; tier++) {
      const bank = fallbackBank(kind, mode, tier);
      assert.equal(bank.size, 13, `${kind}/${mode}/${tier}`);
      for (const [signature, puzzle] of bank) {
        assert.equal(signatureOf(puzzle), signature);
        assert.ok(puzzle.choices.length >= 3);
        assertUniqueAnswer(puzzle);
      }
    }
  }
});

test('Pattern Detective plays 100 levels through the host, pauses a reveal, and ends once on a wrong answer', async (t) => {
  const dom = new JSDOM('<div id="app"></div>', {
    url: 'https://playroom.test/arcade/?game=pattern-detective',
    pretendToBeVisual: true,
  });
  const root = dom.window.document.querySelector('#app');
  const unavailable = () => {
    throw new Error('Persistent storage is unavailable');
  };
  let now = 0;
  let id = 0;
  let seed = 23;
  const jobs = new Map();
  const globals = {
    document: dom.window.document,
    window: dom.window,
    AbortController: dom.window.AbortController,
    performance: { now: () => now },
    localStorage: { getItem: unavailable, setItem: unavailable, removeItem: unavailable },
  };
  const originals = Object.fromEntries(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  const originalRandom = Math.random;
  Math.random = () => seed / 4294967296;
  dom.window.setTimeout = (callback, delay) => {
    jobs.set(++id, { callback, at: now + delay });
    return id;
  };
  dom.window.clearTimeout = (task) => jobs.delete(task);
  const module = await patternDetectiveEntry.load();
  const app = createApp({
    root,
    games: [{ ...patternDetectiveEntry, load: async () => module }],
    progressStore: store,
  });

  t.after(() => {
    app.destroy();
    Math.random = originalRandom;
    globalThis.localStorage = dom.window.localStorage;
    store.reset();
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    dom.window.close();
  });

  function advance(milliseconds) {
    const to = now + milliseconds;
    for (const [task, job] of jobs) {
      if (job.at > to) continue;
      now = job.at;
      jobs.delete(task);
      job.callback();
    }
    now = to;
  }
  const select = (selector) => {
    const element = root.querySelector(selector);
    assert.ok(element, selector);
    return element;
  };
  const click = (selector) => select(selector).click();
  const key = (value, repeat = false) =>
    dom.window.document.activeElement.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', {
        key: value,
        repeat,
        bubbles: true,
        cancelable: true,
      }),
    );
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  const slot = (position) => select(`[data-slot="${position}"]`);
  const buttons = () => [...root.querySelectorAll('[data-choice]')];
  const paletteTile = (kind, value) =>
    buttons().find(
      (button) =>
        button.querySelector('.detective-content > span:last-child').textContent ===
        tileLabel(kind, value),
    );
  function solve(puzzle) {
    for (const [index, position] of puzzle.positions.entries()) {
      if (puzzle.mode !== 'fill') slot(position).click();
      paletteTile(puzzle.kind, puzzle.answers[index]).click();
    }
    click('#detective-check');
    assert.match(select('#detective-feedback').textContent, /Pattern solved/);
  }

  assert.match(select('.intro-screen').textContent, /Pattern Detective/);
  store.saveGame('pattern-detective', { bestScore: 5, bestCasebook: 4 });
  click('[data-action="start"]');
  await tick();
  const run = createPuzzleRun(seed);
  const first = run.next();
  const correct = paletteTile(first.kind, first.answers[0]);
  const wrong = buttons().find((button) => button !== correct);
  click('#pauseButton');
  wrong.click();
  assert.equal(select('#detective-check').disabled, true);
  click('#resumeGame');
  key(wrong.getAttribute('aria-keyshortcuts'), true);
  assert.equal(select('#detective-check').disabled, true);
  key(wrong.getAttribute('aria-keyshortcuts'));
  assert.equal(select('#detective-check').disabled, false);
  click('#detective-clue');
  assert.match(select('#detective-feedback').textContent, /short group/);
  solve(first);
  click('#detective-check');
  assert.equal(store.load().games['pattern-detective'].bestStreak, 1);
  advance(100);
  click('#pauseButton');
  advance(10000);
  assert.match(select('.mode-chip').textContent, /Level 1$/);
  click('#resumeGame');
  advance(4000);
  assert.match(select('.mode-chip').textContent, /Level 2$/);
  assert.ok(buttons().every((button) => button.disabled));
  assert.equal(select('#detective-check').disabled, true);

  for (let level = 2; level <= 100; level++) {
    const puzzle = run.next();
    assert.equal(select('.mode-chip').textContent, `Level ${level}`);
    assert.equal(select('#detective-check').disabled, true);
    solve(puzzle);
    assert.equal(store.load().games['pattern-detective'].bestStreak, level);
    advance(4000);
  }
  assert.equal(select('.mode-chip').textContent, 'Level 101');
  const final = run.next();
  for (const [index, position] of final.positions.entries()) {
    if (final.mode !== 'fill') slot(position).click();
    const correctTile = paletteTile(final.kind, final.answers[index]);
    const choice = index === 0 ? buttons().find((button) => button !== correctTile) : correctTile;
    choice.click();
  }
  const staleCheck = select('#detective-check');
  staleCheck.click();
  staleCheck.click();
  assert.match(select('#resultText').textContent, /100 patterns in a row/);
  assert.match(select('#resultReview ul').textContent, /Your answer.*Correct answer/);
  assert.match(select('#resultReview li').textContent, new RegExp(final.title));
  assert.equal(store.load().played, 1);
  assert.equal(store.load().games['pattern-detective'].bestScore, 5);
  assert.equal(store.load().games['pattern-detective'].bestCasebook, 4);
  assert.equal(store.canSaveProgress(), false);

  seed += 100;
  click('#playAgain');
  await tick();
  assert.equal(select('.mode-chip').textContent, 'Level 1');
  const fresh = createPuzzleRun(seed).next();
  assert.notEqual(signatureOf(fresh), signatureOf(first));
  buttons()
    .find((button) => button !== paletteTile(fresh.kind, fresh.answers[0]))
    .click();
  click('#detective-check');
  assert.match(select('#resultText').textContent, /0 patterns in a row/);
  assert.equal(store.load().games['pattern-detective'].bestStreak, 100);

  seed += 100;
  click('#playAgain');
  await tick();
  solve(createPuzzleRun(seed).next());
  click('#pauseButton');
  click('#quitGame');
  click('#confirmExit');
  advance(4000);
  assert.equal(jobs.size, 0);
  assert.equal(store.load().played, 2);
  assert.equal(dom.window.location.search, '');
  assert.equal(root.querySelector('.detective-stage'), null);
});
