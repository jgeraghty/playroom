import { chooseFood, collides, queueDirection } from './rules.js';
import { createGameUI } from '../../shared/game-ui.js';

export function mountGame({ root, progress, finish, saveProgress, updateStatus, options = {} }) {
  const ui = createGameUI(root, '');
  const speed = ['slow', 'normal', 'fast'].includes(options.speed) ? options.speed : 'slow';
  const delay = { slow: 220, normal: 150, fast: 100 }[speed];
  let best = progress[`bestScore_${speed}`] || 0;
  let snake,
    food,
    dir,
    queued,
    score,
    ended,
    paused = false,
    ready = false,
    canvas,
    ctx,
    stepJob;
  const size = 20;
  function draw() {
    ctx.fillStyle = '#edf5e9';
    ctx.fillRect(0, 0, 400, 400);
    ctx.fillStyle = '#e3eedf';
    for (let y = 0; y < 20; y++)
      for (let x = 0; x < 20; x++)
        if ((x + y) % 2 === 0) ctx.fillRect(x * size, y * size, size, size);
    snake.forEach(([x, y], i) => {
      ctx.fillStyle = i === 0 ? '#245b3d' : '#4b9361';
      ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    });
    const [hx, hy] = snake[0];
    ctx.fillStyle = '#fff';
    const eyes =
      dir === 'right'
        ? [
            [14, 5],
            [14, 13],
          ]
        : dir === 'left'
          ? [
              [4, 5],
              [4, 13],
            ]
          : dir === 'up'
            ? [
                [5, 4],
                [13, 4],
              ]
            : [
                [5, 14],
                [13, 14],
              ];
    eyes.forEach(([x, y]) => ctx.fillRect(hx * size + x, hy * size + y, 3, 3));
    if (food) {
      ctx.fillStyle = '#d95b4f';
      ctx.beginPath();
      ctx.arc(food[0] * size + 10, food[1] * size + 10, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#386b42';
      ctx.fillRect(food[0] * size + 10, food[1] * size + 1, 3, 5);
    }
    root.querySelector('#snake-score').textContent = score;
    root.querySelector('#snake-best').textContent = Math.max(best, score);
  }
  function render() {
    ui.render(
      `<section class="arcade-stage snake-stage"><div class="stage-heading"><div><span class="eyebrow">One more fruit. One more turn.</span><h2>Room to grow.</h2></div><span class="mode-chip">${speed} pace</span></div><div class="session-hud"><div><span>Fruit</span><strong id="snake-score">0</strong></div><div><span>Best · ${speed}</span><strong id="snake-best">${best}</strong></div></div><div class="snake-board"><canvas width="400" height="400" aria-label="Snake board. Use arrow keys, swipe, or the direction buttons."></canvas><div class="ready-overlay" id="snake-ready" role="status"></div></div><div class="touch-pad"><button class="up" data-dir="up" aria-label="Move up">↑</button><button class="left" data-dir="left" aria-label="Move left">←</button><button class="down" data-dir="down" aria-label="Move down">↓</button><button class="right" data-dir="right" aria-label="Move right">→</button></div><p class="control-note">Arrow keys, swipe, or tap. Avoid the walls and your tail.</p></section>`,
    );
    canvas = root.querySelector('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 400 * dpr;
    canvas.height = 400 * dpr;
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ui.on('[data-dir]', 'click', (e) => change(e.currentTarget.dataset.dir));
    let gesture = null;
    ui.on('canvas', 'pointerdown', (e) => {
      if (paused || ended || gesture) return;
      gesture = { id: e.pointerId, x: e.clientX, y: e.clientY };
      canvas.setPointerCapture?.(e.pointerId);
    });
    ui.on('canvas', 'pointerup', (e) => {
      if (!gesture || gesture.id !== e.pointerId) return;
      const dx = e.clientX - gesture.x,
        dy = e.clientY - gesture.y;
      gesture = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 20)
        change(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    });
    ui.on('canvas', 'pointercancel', () => {
      gesture = null;
    });
    ui.on('canvas', 'lostpointercapture', () => {
      gesture = null;
    });
    draw();
  }
  function change(next) {
    if (!paused && !ended) queued = queueDirection(dir, queued, next);
  }
  function countdown() {
    ui.scheduler.clear();
    ui.scheduler.resume();
    ready = false;
    const overlay = root.querySelector('#snake-ready');
    overlay.hidden = false;
    overlay.textContent = 'Ready? 3';
    ui.scheduler.timeout(() => {
      overlay.textContent = '2';
    }, 700);
    ui.scheduler.timeout(() => {
      overlay.textContent = '1';
    }, 1400);
    ui.scheduler.timeout(() => {
      overlay.hidden = true;
      ready = true;
      stepJob = ui.scheduler.interval(step, delay);
    }, 2100);
  }
  function end(won) {
    ended = true;
    ready = false;
    ui.scheduler.clear();
    const previous = best;
    best = Math.max(best, score);
    saveProgress({ [`bestScore_${speed}`]: best });
    updateStatus({ score });
    ui.scheduler.timeout(
      () =>
        finish({
          title: won
            ? 'You filled the board!'
            : score > previous
              ? 'A new personal best!'
              : 'A good little run.',
          message: `${speed[0].toUpperCase() + speed.slice(1)} pace. ${won ? 'Every space, earned.' : 'Take a breath and try another route.'}`,
          outcome: won ? 'win' : 'loss',
          icon: '🐍',
          score,
          stats: [
            ['Fruit', score],
            ['Previous best', previous],
            ['Best · ' + speed, best],
          ],
        }),
      550,
    );
  }
  function step() {
    if (ended || paused || !ready) return;
    dir = queued.shift() || dir;
    const [x, y] = snake[0];
    const head = [x + (dir === 'right') - (dir === 'left'), y + (dir === 'down') - (dir === 'up')];
    const growing = head[0] === food[0] && head[1] === food[1];
    if (collides(snake, head, growing, 20)) {
      end(false);
      return;
    }
    snake.unshift(head);
    if (growing) {
      score++;
      food = chooseFood(snake, 20);
    } else snake.pop();
    draw();
    if (!food) end(true);
  }
  function key(e) {
    const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    if (!paused && !ended && map[e.key]) {
      e.preventDefault();
      change(map[e.key]);
    }
  }
  function start() {
    ui.scheduler.clear();
    paused = false;
    ended = false;
    score = 0;
    snake = [
      [10, 10],
      [9, 10],
      [8, 10],
    ];
    dir = 'right';
    queued = [];
    food = chooseFood(snake, 20);
    render();
    countdown();
  }
  document.addEventListener('keydown', key);
  ui.onDispose(() => document.removeEventListener('keydown', key));
  start();
  return {
    pause() {
      paused = true;
      ui.scheduler.pause();
    },
    resume() {
      if (!paused) return;
      paused = false;
      if (ended) ui.scheduler.resume();
      else {
        ui.scheduler.clearInterval(stepJob);
        queued = [];
        countdown();
      }
    },
    restart: start,
    destroy: () => ui.destroy(),
  };
}
