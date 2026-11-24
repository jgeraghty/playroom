import { createGameUI } from '../../shared/game-ui.js';
import { landingRow, winningCells, chooseColumn } from './rules.js';
export function mountGame({ root, finish, options = {} }) {
  const ui = createGameUI(root, '');
  const mode = ['easy', 'smart', 'local'].includes(options.mode) ? options.mode : 'easy';
  const local = mode === 'local';
  let board,
    turn,
    wins,
    round,
    ended,
    paused = false,
    line = [];
  const name = (p) => (p === 1 ? 'Red' : 'Yellow');
  function start() {
    ui.scheduler.clear();
    ui.scheduler.resume();
    paused = false;
    wins = [0, 0];
    round = 0;
    ui.render(
      `<section class="arcade-stage c4-stage"><div class="stage-heading"><div><span class="eyebrow">Find the line before they do</span><h2>Four makes a win.</h2></div><span class="mode-chip">${local ? 'Two players' : mode + ' computer'}</span></div><div class="session-hud"><div><span>${local ? 'Red · ●' : 'You · ●'}</span><strong id="red-wins">0</strong></div><div><span>Board</span><strong id="c4-round"></strong></div><div><span>${local ? 'Yellow · ◆' : 'Computer · ◆'}</span><strong id="yellow-wins">0</strong></div></div><p class="turn-status" id="c4-status" role="status"></p><div class="c4-surface"><div class="c4-columns">${Array.from({ length: 7 }, (_, c) => `<button data-col="${c}" aria-label="Drop in column ${c + 1}">${c + 1}<span aria-hidden="true">↓</span></button>`).join('')}</div><div class="c4-grid" role="img" aria-label="Empty Connect Four board">${Array.from({ length: 42 }, (_, i) => `<span class="c4-disc" data-cell="${i}"></span>`).join('')}</div></div><button class="soft" id="c4-next" hidden>Next board →</button><p class="control-note">Choose a column. Connect four across, down, or diagonally.</p></section>`,
    );
    ui.on('[data-col]', 'click', (e) => drop(Number(e.currentTarget.dataset.col)));
    ui.on('[data-col]', 'focus', (e) => preview(Number(e.currentTarget.dataset.col)));
    ui.on('[data-col]', 'pointerenter', (e) => preview(Number(e.currentTarget.dataset.col)));
    ui.on('[data-col]', 'pointerleave', clearPreview);
    ui.on('[data-col]', 'blur', clearPreview);
    ui.on('#c4-next', 'click', () => {
      if (!paused && ended) newRound();
    });
    newRound();
  }
  function clearPreview() {
    root.querySelectorAll('.preview').forEach((el) => el.classList.remove('preview'));
  }
  function preview(col) {
    clearPreview();
    if (paused || ended || (!local && turn === 2)) return;
    const row = landingRow(board, col);
    if (row >= 0) root.querySelector(`[data-cell="${row * 7 + col}"]`).classList.add('preview');
  }
  function draw(message, last) {
    root.querySelector('#red-wins').textContent = wins[0];
    root.querySelector('#yellow-wins').textContent = wins[1];
    root.querySelector('#c4-round').textContent = `${round} / 3`;
    root.querySelector('#c4-status').textContent =
      message ||
      (!local && turn === 2 ? 'Computer is thinking…' : `${name(turn)}’s turn — choose a column.`);
    root.querySelectorAll('[data-cell]').forEach((el, i) => {
      const r = Math.floor(i / 7),
        c = i % 7,
        v = board[r][c];
      el.className = `c4-disc ${v === 1 ? 'red' : v === 2 ? 'yellow' : ''}${line.some(([y, x]) => y === r && x === c) ? ' winning' : ''}${last === i ? ' dropped' : ''}`;
      el.textContent = v === 1 ? '●' : v === 2 ? '◆' : '';
    });
    root
      .querySelector('.c4-grid')
      .setAttribute(
        'aria-label',
        board
          .map((row, i) => `Row ${i + 1}: ${row.map((v) => (v ? name(v) : 'empty')).join(', ')}`)
          .join('. '),
      );
    root.querySelectorAll('[data-col]').forEach((el, c) => {
      el.setAttribute('aria-disabled', String(ended || (!local && turn === 2)));
      el.setAttribute(
        'aria-label',
        `${landingRow(board, c) < 0 ? 'Full column' : 'Drop in column'} ${c + 1}`,
      );
    });
  }
  function newRound() {
    round++;
    board = Array.from({ length: 6 }, () => Array(7).fill(0));
    turn = 1;
    ended = false;
    line = [];
    root.querySelector('#c4-next').hidden = true;
    draw();
    if (round > 1) root.querySelector('[data-col]').focus({ preventScroll: true });
  }
  function drop(col, computer = false) {
    if (
      paused ||
      ended ||
      !Number.isInteger(col) ||
      col < 0 ||
      col > 6 ||
      (!local && (turn === 2) !== computer)
    )
      return;
    const row = landingRow(board, col);
    if (row < 0) {
      draw('That column is full. Try another one.');
      return;
    }
    board[row][col] = turn;
    line = winningCells(board, row, col, turn);
    if (line.length || board[0].every(Boolean)) {
      ended = true;
      if (line.length) wins[turn - 1]++;
      draw(
        line.length ? `${name(turn)} connects four!` : 'Board drawn — well defended.',
        row * 7 + col,
      );
      if (Math.max(...wins) < 2 && round < 3) {
        const next = root.querySelector('#c4-next');
        next.hidden = false;
        next.focus({ preventScroll: true });
        return;
      }
      const tied = wins[0] === wins[1],
        first = wins[0] > wins[1],
        won = !tied && (local || first);
      ui.scheduler.timeout(
        () =>
          finish({
            title: tied
              ? 'Match drawn'
              : local
                ? `${first ? 'Red' : 'Yellow'} wins the match!`
                : first
                  ? 'You win the match!'
                  : 'Computer wins the match',
            message: `Final score: Red ${wins[0]} — ${wins[1]} Yellow.`,
            outcome: tied ? 'draw' : won ? 'win' : 'loss',
            score: local ? Math.max(...wins) : wins[0],
            icon: '🏁',
            stats: [
              ['Red wins', wins[0]],
              ['Yellow wins', wins[1]],
              ['Draws', round - wins[0] - wins[1]],
            ],
          }),
        1000,
      );
      return;
    }
    turn = 3 - turn;
    draw(null, row * 7 + col);
    if (!local && turn === 2)
      ui.scheduler.timeout(() => {
        if (!paused && !ended) drop(chooseColumn(board, mode === 'smart'), true);
      }, 450);
  }
  start();
  return {
    pause() {
      paused = true;
      clearPreview();
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
