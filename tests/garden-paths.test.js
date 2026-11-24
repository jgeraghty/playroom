import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import { createGardenSequence, generateGarden } from '../src/games/garden-paths/generator.js';
import { gardenPathsEntry } from '../src/games/garden-paths/entry.js';
import { rotateClockwise, traceWater } from '../src/games/garden-paths/rules.js';

registerHooks({
  load(url, context, next) {
    return url.endsWith('.css')
      ? { format: 'module', source: '', shortCircuit: true }
      : next(url, context);
  },
});

function assertPlayable(board, level) {
  const solution = board.tiles.map((tile) => tile?.openings ?? 0);
  const solved = traceWater(board, solution);
  assert.equal(solved.won, true);
  assert.ok(solved.flowers >= 2);
  assert.ok(solved.links.some((mask) => [7, 11, 13, 14].includes(mask)));
  assert.ok(board.columns <= 5);
  assert.equal(solved.weeds > 0, level >= 4);

  const moves = board.tiles.flatMap((tile, index) => (tile?.type === 'path' ? [index] : []));
  const candidate = [...board.openings];
  const wins = () => traceWater(board, candidate).won;
  assert.equal(wins(), false);
  if (level === 1) assert.ok(traceWater(board, candidate).reached.size >= 2);
  for (const first of moves) {
    candidate[first] = rotateClockwise(candidate[first]);
    assert.equal(wins(), false);
    for (const second of moves) {
      candidate[second] = rotateClockwise(candidate[second]);
      assert.equal(wins(), false, 'two clockwise turns cannot solve the garden');
      candidate[second] =
        second === first ? rotateClockwise(board.openings[first]) : board.openings[second];
    }
    candidate[first] = rotateClockwise(rotateClockwise(candidate[first]));
    assert.equal(wins(), false, 'no single tile solves the garden');
    candidate[first] = board.openings[first];
  }
}

test('1,000 seeded gardens branch, have a solution, and need multiple tiles and three turns', () => {
  const startingLayouts = new Set();
  for (let seed = 0; seed < 50; seed++) {
    const next = createGardenSequence(seed);
    let previous;
    for (let level = 1; level <= 20; level++) {
      const board = next();
      assertPlayable(board, level);
      assert.notDeepEqual(board.tiles, previous?.tiles);
      if (level === 1) startingLayouts.add(JSON.stringify(board.tiles));
      previous = board;
    }
  }
  assert.ok(startingLayouts.size > 35);
});

test('identical random outputs still terminate and avoid repeating the fallback layout', () => {
  for (const level of [1, 4, 9, 10, 24, 50]) {
    for (const sample of [0, 0.25, 0.5, 0.75]) {
      const random = () => sample;
      const board = generateGarden(level, random);
      const next = generateGarden(level, random, board);
      assertPlayable(board, level);
      assertPlayable(next, level);
      if (level >= 9) {
        for (const fallback of [board, next]) {
          const solved = traceWater(
            fallback,
            fallback.tiles.map((tile) => tile?.openings ?? 0),
          );
          assert.equal(fallback.columns, 5);
          assert.equal(fallback.tiles.filter(Boolean).length, 14);
          assert.equal(solved.flowers, 4);
          assert.equal(solved.weeds, 2);
          assert.equal(
            fallback.tiles.filter(
              (tile, index) => tile?.type === 'path' && tile.openings !== fallback.openings[index],
            ).length,
            7,
          );
        }
      }
      assert.notDeepEqual(board.tiles, next.tiles);
    }
  }
});

test('a watered weed prevents a clear even when both flowers are watered', () => {
  const board = {
    columns: 3,
    tiles: [
      null,
      { type: 'flower' },
      null,
      { type: 'source' },
      { type: 'path' },
      { type: 'weed' },
      null,
      { type: 'flower' },
      null,
    ],
  };
  const safe = traceWater(board, [0, 4, 0, 2, 13, 8, 0, 1, 0]);
  assert.equal(safe.won, true);
  const unsafe = traceWater(board, [0, 4, 0, 2, 15, 8, 0, 1, 0]);
  assert.equal(unsafe.watered, 2);
  assert.equal(unsafe.wetWeeds, 1);
  assert.equal(unsafe.won, false);
});

test('garden waits on the solved bed, pauses auto-advance, and restarts without stale timers', async (t) => {
  const dom = new JSDOM('<main></main>');
  const root = dom.window.document.querySelector('main');
  const origWindow = globalThis.window;
  const origAbortController = globalThis.AbortController;
  const origPerformance = globalThis.performance;
  globalThis.window = dom.window;
  globalThis.AbortController = dom.window.AbortController;
  const seedSample = 0.25;
  t.mock.method(Math, 'random', () => seedSample);
  const next = createGardenSequence(seedSample * 2 ** 32);
  const { mountGame, gardenClearDelay } = await gardenPathsEntry.load();
  const jobs = new Map();
  const saves = [];
  const results = [];
  let now = 0;
  let jobId = 0;
  let controller;
  globalThis.performance = { now: () => now };
  t.mock.method(dom.window, 'setTimeout', (callback, delay) => {
    jobs.set(++jobId, { callback, at: now + delay });
    return jobId;
  });
  t.mock.method(dom.window, 'clearTimeout', (id) => jobs.delete(id));

  function passTime(delay) {
    now += delay;
    for (const [id, job] of jobs) {
      if (job.at > now) continue;
      jobs.delete(id);
      job.callback();
    }
  }

  function solve(board) {
    const first = root.querySelector('button[data-garden-tile]');
    first.focus();
    for (const [index, tile] of board.tiles.entries()) {
      if (tile?.type !== 'path') continue;
      const button = root.querySelector(`[data-garden-tile="${index}"]`);
      let mask = board.openings[index];
      while (mask !== tile.openings) {
        button.click();
        mask = rotateClockwise(mask);
      }
    }
    first.click();
  }

  const cleared = () => root.querySelector('#garden-cleared').textContent;
  const heading = () => root.querySelector('#garden-heading').textContent;
  try {
    controller = mountGame({
      root,
      saveProgress: (patch) => saves.push(patch),
      finish: (value) => results.push(value),
    });
    assert.equal(gardenPathsEntry.setup, undefined);
    assert.equal(heading(), 'Garden bed 1');
    const first = next();
    solve(first);
    assert.equal(cleared(), '1');
    assert.equal(heading(), 'Garden bed 1');
    assert.match(root.querySelector('#garden-feedback').textContent, /Bed cleared/);
    assert.equal(jobs.size, 1);
    assert.deepEqual(saves, [{ bestBedsCleared: 1 }]);
    assert.deepEqual(results, []);

    passTime(gardenClearDelay - 1);
    controller.pause();
    passTime(gardenClearDelay * 2);
    assert.equal(heading(), 'Garden bed 1');
    controller.resume();
    passTime(1);
    assert.equal(heading(), 'Garden bed 2');
    assert.equal(dom.window.document.activeElement.id, 'garden-heading');

    solve(next());
    assert.equal(cleared(), '2');
    controller.restart();
    assert.equal(cleared(), '0');
    assert.equal(heading(), 'Garden bed 1');
    passTime(gardenClearDelay * 2);
    assert.equal(heading(), 'Garden bed 1');
    assert.deepEqual(saves, [{ bestBedsCleared: 1 }, { bestBedsCleared: 2 }]);
    assert.deepEqual(results, []);

    solve(first);
    controller.destroy();
    passTime(gardenClearDelay * 2);
    assert.equal(root.childElementCount, 0);
    assert.equal(jobs.size, 0);
  } finally {
    controller?.destroy();
    globalThis.window = origWindow;
    globalThis.AbortController = origAbortController;
    globalThis.performance = origPerformance;
    dom.window.close();
  }
});
