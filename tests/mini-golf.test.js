import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import {
  chargeMs,
  course,
  holes,
  inRough,
  launch,
  pullAim,
  stepBall,
  strokeLimit,
  winner,
} from '../src/games/mini-golf/rules.js';

registerHooks({
  load(url, context, next) {
    return url.endsWith('.css')
      ? { format: 'module', source: '', shortCircuit: true }
      : next(url, context);
  },
});

const solutions = [
  [[0, 90]],
  [
    [0, 70],
    [270, 50],
  ],
  [[35, 80]],
  [[60, 85]],
  [[350, 75]],
];

function shoot(hole, position, angle, power) {
  const ball = launch(position, angle, power);
  for (let i = 0; i < 700; i++) {
    const status = stepBall(ball, hole);
    if (status !== 'moving') return { status, ball };
  }
  assert.fail('putt did not settle');
}

test('all five holes are reachable with keyboard aim and power increments', () => {
  for (const [index, hole] of holes.entries()) {
    let shot = { ball: hole.tee };
    for (const [angle, power] of solutions[index]) {
      shot = shoot(hole, shot.ball, angle, power);
    }
    assert.equal(shot.status, 'sunk', hole.name);
    assert.deepEqual(shot.ball, { ...hole.cup, vx: 0, vy: 0 });
    assert.equal(shoot(hole, hole.tee, 0, 40).status, 'stopped');
  }
  assert.notEqual(shoot(holes[2], holes[2].tee, 0, 80).status, 'sunk');
});

test('rough shortens a putt and both the shortcut and layup routes are playable', () => {
  const meadow = holes[0];
  const normal = shoot({ ...meadow, rough: [] }, meadow.tee, 0, 40);
  const throughRough = shoot(meadow, meadow.tee, 0, 40);
  assert.ok(inRough(throughRough.ball, meadow));
  assert.ok(throughRough.ball.x < normal.ball.x);
  const meadowLayup = shoot(meadow, meadow.tee, 30, 60);
  assert.ok(!inRough(meadowLayup.ball, meadow));
  assert.equal(shoot(meadow, meadowLayup.ball, 310, 45).status, 'sunk');

  for (const [index, first, second] of [
    [3, [140, 95], [10, 70]],
    [4, [25, 75], [50, 70]],
  ]) {
    const hole = holes[index];
    const approach = shoot(hole, hole.tee, ...first);
    assert.equal(approach.status, 'stopped');
    assert.equal(shoot(hole, approach.ball, ...second).status, 'sunk');
  }

  const bank = holes[2];
  const bankLayup = shoot(bank, bank.tee, 20, 60);
  assert.equal(bankLayup.status, 'stopped');
  assert.ok(bankLayup.ball.x > bank.walls[0].x + bank.walls[0].width);
  assert.equal(shoot(bank, bankLayup.ball, 310, 40).status, 'sunk');
});

test('rebound at rail and island corners stays on the green', () => {
  const minimum = course.rail + course.ballRadius;
  const railBall = { x: minimum + 1, y: minimum + 1, vx: -190, vy: -190 };
  assert.equal(stepBall(railBall, holes[0]), 'moving');
  assert.deepEqual([railBall.x, railBall.y], [minimum, minimum]);
  assert.ok(railBall.vx > 0 && railBall.vy > 0);
  const island = holes[2].walls[0];
  const left = island.x - course.ballRadius;
  const top = island.y - course.ballRadius;
  const islandBall = { x: left - 1, y: top - 1, vx: 150, vy: 150 };
  assert.equal(stepBall(islandBall, holes[2]), 'moving');
  assert.deepEqual([islandBall.x, islandBall.y], [left, top]);
  assert.ok(islandBall.vx < 0 && islandBall.vy < 0);
});

test('a slow putt drops into the cup and a fast putt rolls through', () => {
  const hole = holes[0];
  const slow = { x: hole.cup.x - course.cupRadius - 0.1, y: hole.cup.y, vx: 15, vy: 0 };
  const fast = { x: hole.cup.x, y: hole.cup.y, vx: 200, vy: 0 };
  assert.equal(stepBall(slow, hole), 'sunk');
  assert.equal(stepBall(fast, hole), 'moving');
});

async function game(t, mode, progress = {}) {
  const { mountGame } = await import('../src/games/mini-golf/index.js');
  const { window } = new JSDOM('<main tabindex="-1"></main>');
  const { document } = window;
  const root = document.querySelector('main');
  const frames = new Map();
  const results = [];
  const saved = [];
  let now = 0;
  let frameId = 0;
  const globals = {
    window,
    document,
    performance: { now: () => now },
    AbortController: window.AbortController,
    requestAnimationFrame: (callback) => {
      frames.set(++frameId, callback);
      return frameId;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
  };
  const descriptors = Object.fromEntries(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { value, configurable: true });
  }
  const context = new Proxy({}, { get: () => () => {} });
  window.HTMLCanvasElement.prototype.getContext = () => context;
  const controller = mountGame({
    root,
    options: { mode },
    progress,
    finish: (result) => results.push(result),
    saveProgress: (patch) => saved.push(patch),
  });
  t.after(() => {
    controller.destroy();
    window.close();
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });

  const find = (selector) => root.querySelector(selector);
  const click = (selector) => find(selector).click();
  const canvas = find('canvas');
  const captures = new Set();
  canvas.setPointerCapture = (id) => captures.add(id);
  canvas.hasPointerCapture = (id) => captures.has(id);
  canvas.releasePointerCapture = (id) => captures.delete(id);
  function pointer(type, x, y, properties = {}) {
    canvas.dispatchEvent(
      new window.PointerEvent(type, {
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        button: 0,
        clientX: x,
        clientY: y,
        bubbles: true,
        cancelable: true,
        ...properties,
      }),
    );
  }
  function key(value, type = 'keydown', extra = {}) {
    canvas.dispatchEvent(
      new window.KeyboardEvent(type, { key: value, bubbles: true, cancelable: true, ...extra }),
    );
  }
  function advance(ms) {
    const pending = [...frames.values()];
    frames.clear();
    now += ms;
    for (const callback of pending) callback(now);
  }
  function runFrames() {
    for (let i = 0; frames.size && i < 200; i++) {
      advance(20);
    }
    assert.equal(frames.size, 0);
  }
  function putt(angle, power) {
    const currentAngle = Number(find('#golf-direction').textContent.match(/\d+/)[0]);
    const turn = ((angle - currentAngle + 540) % 360) - 180;
    for (let i = 0; i < Math.abs(turn) / 5; i++) {
      key(turn > 0 ? 'ArrowRight' : 'ArrowLeft');
    }
    key(' ');
    advance((power / 100) * chargeMs + 1);
    key(' ', 'keyup');
    runFrames();
  }
  return {
    controller,
    root,
    window,
    find,
    click,
    key,
    putt,
    pointer,
    captures,
    advance,
    runFrames,
    frames,
    results,
    saved,
  };
}

test('putt is guarded during motion, pause freezes frames, and aim survives a resize', async (t) => {
  const { find, root, window, controller, runFrames, frames, results, pointer, captures, key } =
    await game(t, 'solo');
  const canvas = find('canvas');
  canvas.getBoundingClientRect = () => ({ width: 180, height: 106, left: 0, top: 0 });
  pointer('pointerdown', 34.5, 54, { pointerType: 'touch' });
  pointer('pointermove', 3.25, 54, { pointerType: 'touch' });
  assert.equal(find('#golf-power').textContent, 'Power 90%');
  assert.ok(captures.has(1));
  pointer('pointerup', 3.25, 54, { pointerId: 2, pointerType: 'touch', isPrimary: false });
  assert.equal(find('#golf-strokes').textContent, '0/6');
  canvas.getBoundingClientRect = () => ({ width: 360, height: 212, left: 0, top: 0 });
  window.dispatchEvent(new window.Event('resize'));
  assert.match(find('#golf-direction').textContent, /0°/);
  pointer('pointerup', 6.5, 108, { pointerType: 'touch' });
  pointer('pointerup', 6.5, 108, { pointerType: 'touch' });
  key(' ');
  key(' ', 'keyup');
  assert.equal(captures.size, 0);
  assert.equal(find('#golf-strokes').textContent, '1/6');
  controller.pause();
  assert.equal(frames.size, 0);
  runFrames();
  assert.match(find('.golf-feedback').textContent, /rolling/);
  controller.resume();
  runFrames();
  assert.match(find('.golf-feedback').textContent, /1 stroke/);
  assert.equal(root.ownerDocument.activeElement, find('.golf-scorecard summary'));
  assert.equal(find('.golf-scorecard').open, true);
  assert.equal(results.length, 0);
  controller.restart();
  assert.equal(find('#golf-strokes').textContent, '0/6');
  key(' ');
  key(' ', 'keyup');
  controller.destroy();
  assert.equal(frames.size, 0);
  assert.equal(results.length, 0);
});

test('mouse pulls cancel cleanly and space charges once per press', async (t) => {
  const { find, pointer, key, controller, advance, captures, window } = await game(t, 'solo');
  const canvas = find('canvas');
  canvas.getBoundingClientRect = () => ({ width: 360, height: 212, left: 0, top: 0 });
  const strokes = () => find('#golf-strokes').textContent;
  assert.equal(find('[data-golf-putt], [data-aim], input[type="range"]'), null);
  pointer('pointerdown', 130, 108);
  pointer('pointerup', 6.5, 108);
  assert.equal(strokes(), '0/6');
  pointer('pointerdown', 69, 108);
  pointer('pointerup', 68, 108);
  assert.equal(strokes(), '0/6');

  for (const cancel of [
    () => controller.pause(),
    () => pointer('pointercancel', 6.5, 108),
    () => pointer('lostpointercapture', 6.5, 108),
    () => window.dispatchEvent(new window.Event('blur')),
    () => {
      Object.defineProperty(window.document, 'hidden', { value: true, configurable: true });
      window.document.dispatchEvent(new window.Event('visibilitychange'));
      delete window.document.hidden;
    },
    () => key('Escape'),
  ]) {
    pointer('pointerdown', 69, 108);
    pointer('pointermove', 6.5, 108);
    assert.equal(find('#golf-power').textContent, 'Power 90%');
    cancel();
    controller.resume();
    assert.equal(find('#golf-power').textContent, 'Power 0%');
    assert.equal(captures.size, 0);
    pointer('pointerup', 6.5, 108);
    assert.equal(strokes(), '0/6');
  }

  key(' ');
  advance(300);
  key('Escape');
  key(' ', 'keyup');
  assert.equal(strokes(), '0/6');
  key(' ');
  advance(800);
  key(' ', 'keydown', { repeat: true });
  assert.equal(find('#golf-power').textContent, 'Power 50%');
  assert.equal(find('.golf-announcement').textContent, 'Power 50 percent');
  advance(645);
  assert.equal(find('#golf-power').textContent, 'Power 90%');
  key(' ', 'keyup');
  key(' ', 'keyup');
  assert.equal(strokes(), '1/6');
});

test('even a ball near a rail can pull away from it at full power', () => {
  const rightRail = course.width - course.rail - course.ballRadius;
  const aim = pullAim({ x: rightRail, y: 110 }, { x: course.width, y: 110 });
  assert.equal(aim.angle, 180);
  assert.equal(aim.power, 100);
  assert.equal(pullAim({ x: rightRail, y: 110 }, { x: rightRail + 3, y: 110 }), null);
});

test('six unsuccessful strokes score six and hand the same hole to Player 2', async (t) => {
  const { putt, find, click, results, saved } = await game(t, 'local');
  for (let i = 0; i < strokeLimit; i++) putt(180, 5);
  assert.match(find('.golf-feedback').textContent, /Stroke limit reached.*Pass to Player 2/);
  assert.equal(find('[data-golf-total="0"]').textContent, '6');
  click('[data-golf-next]');
  assert.match(find('#golf-hole').textContent, /1\/5/);
  assert.equal(find('#golf-stroke-label').textContent, 'Player 2’s strokes');
  assert.equal(find('#golf-strokes').textContent, '0/6');
  putt(0, 90);
  click('[data-golf-next]');
  assert.match(find('#golf-hole').textContent, /2\/5/);
  assert.equal(find('#golf-stroke-label').textContent, 'Player 1’s strokes');
  assert.equal(results.length, 0);
  assert.equal(saved.length, 0);
});

test('a capped final hole explains the result and shows both final totals', async (t) => {
  const { putt, find, click, results, saved } = await game(t, 'local');
  for (const [index, shots] of solutions.entries()) {
    for (const [angle, power] of shots) putt(angle, power);
    click('[data-golf-next]');
    if (index === solutions.length - 1) break;
    for (const [angle, power] of shots) putt(angle, power);
    click('[data-golf-next]');
  }
  for (let i = 0; i < strokeLimit; i++) putt(180, 5);
  assert.equal(results.length, 0);
  assert.equal(saved.length, 0);
  assert.equal(find('.golf-scorecard').open, true);
  assert.equal(find('[data-golf-next]').textContent, 'Finish course');
  assert.match(find('.golf-feedback').textContent, /Stroke limit reached.*Player 2/);
  assert.match(find('.golf-scorecard tfoot').textContent, /Total13611/);
  click('[data-golf-next]');
  click('[data-golf-next]');
  assert.equal(results.length, 1);
  assert.match(results[0].message, /Player 2 reached the six-stroke limit on The Needle/);
  assert.equal(results[0].title, 'Player 1 wins!');
  assert.equal(find('#golf-strokes').textContent, '6/6');
  assert.equal(find('[data-golf-total="0"]').textContent, '6');
  assert.equal(find('[data-golf-total="1"]').textContent, '11');
  assert.deepEqual(saved[0].meadowRunFiveMatches.lastTotals, [6, 11]);
});

test('solo and two-player rounds score separately and finish once', async (t) => {
  await t.test('solo best', async (t) => {
    const { putt, click, find, key, results, saved } = await game(t, 'solo', {
      bestMoves_miniGolfCourse: 1,
      bestMoves_meadowRunFive: 7,
    });
    for (const shots of solutions) {
      for (const [angle, power] of shots) putt(angle, power);
      if (!find('[data-golf-next]').hidden) click('[data-golf-next]');
    }
    assert.equal(results.length, 1);
    assert.equal(results[0].title, 'New personal best!');
    assert.deepEqual(saved, [{ bestMoves_meadowRunFive: 6 }]);
    key(' ');
    key(' ', 'keyup');
    assert.equal(results.length, 1);
  });
  await t.test('solo tie keeps the previous best', async (t) => {
    const { putt, click, find, results, saved } = await game(t, 'solo', {
      bestMoves_meadowRunFive: 6,
    });
    for (const shots of solutions) {
      for (const [angle, power] of shots) putt(angle, power);
      if (!find('[data-golf-next]').hidden) click('[data-golf-next]');
    }
    assert.equal(results.length, 1);
    assert.equal(results[0].title, 'Course complete!');
    assert.deepEqual(saved, []);
  });
  await t.test('local tie', async (t) => {
    const { putt, click, find, results, saved } = await game(t, 'local', {
      bestMoves_meadowRunFive: 3,
      localMatches: { played: 8 },
    });
    for (const shots of solutions) {
      for (const player of [0, 1]) {
        assert.equal(find('#golf-stroke-label').textContent, `Player ${player + 1}’s strokes`);
        for (const [angle, power] of shots) putt(angle, power);
        if (!find('[data-golf-next]').hidden) click('[data-golf-next]');
      }
    }
    assert.equal(results.length, 1);
    assert.equal(results[0].outcome, 'draw');
    assert.deepEqual(saved, [
      {
        meadowRunFiveMatches: {
          played: 1,
          ties: 1,
          playerOneWins: 0,
          playerTwoWins: 0,
          lastTotals: [6, 6],
        },
      },
    ]);
    assert.equal(winner([4, 4]), null);
    assert.equal(winner([5, 4]), 1);
    assert.equal(winner([4, 5]), 0);
  });
});
