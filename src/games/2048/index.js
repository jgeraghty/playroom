import { createGameUI } from '../../shared/game-ui.js';
import { moveBoard, canMove } from './rules.js';
export function mountGame({ root, progress, finish, saveProgress, options = {} }) {
  const ui = createGameUI(root, '');
  const goal = options.goal === '256' ? 256 : 2048;
  const bestKey = `bestScore_${goal}`;
  let board,
    score,
    moves,
    best = progress[bestKey] || 0,
    undoState,
    paused = false,
    ended = false,
    blocked = false,
    locked = false;
  function spawn() {
    const free = [];
    board.forEach((row, r) =>
      row.forEach((v, c) => {
        if (!v) free.push([r, c]);
      }),
    );
    if (free.length) {
      const [r, c] = free[Math.floor(Math.random() * free.length)];
      board[r][c] = Math.random() < 0.9 ? 2 : 4;
      return r * 4 + c;
    }
  }
  function draw(merged = [], spawned) {
    root.querySelector('#tile-score').textContent = score;
    root.querySelector('#tile-best').textContent = best;
    root.querySelector('#tile-moves').textContent = moves;
    root.querySelectorAll('[data-tile]').forEach((el, i) => {
      const value = board[Math.floor(i / 4)][i % 4];
      el.textContent = value || '';
      el.dataset.value = value;
      el.className = `number-tile${merged.includes(i) ? ' merged' : ''}${spawned === i ? ' spawned' : ''}`;
      el.setAttribute(
        'aria-label',
        `Row ${Math.floor(i / 4) + 1}, column ${(i % 4) + 1}: ${value || 'empty'}`,
      );
    });
    root.querySelector('#undo').disabled = !undoState || ended;
    root.querySelector('#finish2048').hidden = !blocked;
    root.querySelector('#tile-status').textContent = blocked
      ? 'No moves left. Undo your last move, or finish this board.'
      : `Combine matching tiles. Your goal is ${goal}.`;
  }
  function move(direction) {
    if (paused || ended || blocked || locked) return;
    const moved = moveBoard(board, direction);
    if (!moved.changed) return;
    undoState = { board: board.map((r) => r.slice()), score, moves };
    board = moved.board;
    score += moved.gained;
    moves++;
    if (score > best) {
      best = score;
      saveProgress({ [bestKey]: best });
    }
    const spawned = spawn();
    blocked = !canMove(board);
    draw(moved.merged, spawned);
    locked = true;
    ui.scheduler.timeout(() => {
      locked = false;
    }, 140);
    if (board.flat().some((v) => v >= goal)) {
      ended = true;
      draw(moved.merged, spawned);
      ui.scheduler.timeout(() => complete(true), 650);
    }
  }
  function complete(won = false) {
    if (paused) return;
    ended = true;
    ui.scheduler.clear();
    finish({
      title: won ? `${goal}! You did it!` : 'Board complete',
      message: won ? 'A little planning, a lovely result.' : 'Every board is a fresh puzzle.',
      outcome: won ? 'win' : 'loss',
      score,
      icon: '🔢',
      stats: [
        ['Score', score],
        ['Best · ' + goal, best],
        ['Moves', moves],
        ['Largest tile', Math.max(...board.flat())],
      ],
    });
  }
  function undo() {
    if (paused || ended || !undoState) return;
    ui.scheduler.clear();
    locked = false;
    board = undoState.board;
    score = undoState.score;
    moves = undoState.moves;
    undoState = null;
    blocked = false;
    draw();
  }
  function start() {
    ui.scheduler.clear();
    ui.scheduler.resume();
    paused = false;
    ended = false;
    blocked = false;
    locked = false;
    undoState = null;
    score = 0;
    moves = 0;
    board = Array.from({ length: 4 }, () => Array(4).fill(0));
    spawn();
    spawn();
    ui.render(
      `<section class="arcade-stage tile-stage"><div class="stage-heading"><div><span class="eyebrow">Small moves. Bigger possibilities.</span><h2>Make room for ${goal}.</h2></div><span class="mode-chip">${goal === 256 ? 'Warm-up' : 'Classic'}</span></div><div class="session-hud"><div><span>Score</span><strong id="tile-score"></strong></div><div><span>Best · ${goal}</span><strong id="tile-best"></strong></div><div><span>Moves</span><strong id="tile-moves"></strong></div></div><p class="tile-status" id="tile-status" role="status"></p><div id="g2048" class="tile-board" role="group" aria-label="2048 board">${Array.from({ length: 16 }, (_, i) => `<div class="number-tile" data-tile="${i}"></div>`).join('')}</div><div class="touch-pad"><button class="up" data-dir="up" aria-label="Slide up">↑</button><button class="left" data-dir="left" aria-label="Slide left">←</button><button class="down" data-dir="down" aria-label="Slide down">↓</button><button class="right" data-dir="right" aria-label="Slide right">→</button></div><div class="tile-actions"><button class="soft" id="undo">Undo move</button><button class="soft" id="restart2048">Restart board</button><button id="finish2048" hidden>Finish board</button></div><p class="control-note">Arrow keys, swipe, or tap. One undo is always there for you.</p></section>`,
    );
    ui.on('[data-dir]', 'click', (e) => move(e.currentTarget.dataset.dir));
    ui.on('#undo', 'click', undo);
    ui.on('#finish2048', 'click', () => {
      if (blocked && !ended) complete();
    });
    ui.on('#restart2048', 'click', () => {
      if (!paused && window.confirm('Restart this board? Your best score will stay saved.'))
        start();
    });
    let gesture = null;
    const surface = root.querySelector('#g2048');
    ui.on('#g2048', 'pointerdown', (e) => {
      if (paused || ended || gesture) return;
      gesture = { id: e.pointerId, x: e.clientX, y: e.clientY };
      surface.setPointerCapture?.(e.pointerId);
    });
    ui.on('#g2048', 'pointerup', (e) => {
      if (!gesture || e.pointerId !== gesture.id) return;
      const dx = e.clientX - gesture.x,
        dy = e.clientY - gesture.y;
      gesture = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 28)
        move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    });
    ui.on('#g2048', 'pointercancel', () => {
      gesture = null;
    });
    ui.on('#g2048', 'lostpointercapture', () => {
      gesture = null;
    });
    draw();
  }
  function key(e) {
    const direction = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[
      e.key
    ];
    if (direction && !paused && !ended) {
      e.preventDefault();
      move(direction);
    }
  }
  ui.onDispose(() => document.removeEventListener('keydown', key));
  document.addEventListener('keydown', key);
  start();
  return {
    pause() {
      paused = true;
      ui.scheduler.pause();
    },
    resume() {
      paused = false;
      ui.scheduler.resume();
    },
    restart: start,
    destroy: () => ui.destroy(),
  };
}
