import { createGameUI } from '../../shared/game-ui.js';
import { winningLine, bestMove } from './rules.js';

export function mountGame({ root, finish, options = {} }) {
  const ui = createGameUI(root, '');
  const mode = ['easy', 'medium', 'hard', 'local'].includes(options.mode) ? options.mode : 'easy';
  const local = mode === 'local';
  let wins,
    round,
    board,
    turn,
    ended,
    paused = false;
  function start() {
    ui.scheduler.clear();
    ui.scheduler.resume();
    paused = false;
    wins = [0, 0];
    round = 0;
    ui.render(
      `<section class="arcade-stage ttt-stage"><div class="stage-heading"><div><span class="eyebrow">Three in a row, one good move at a time</span><h2>Make your mark.</h2></div><span class="mode-chip">${local ? 'Two players' : mode + ' computer'}</span></div><div class="session-hud match-hud"><div class="player-x"><span>${local ? 'Player X' : 'You · X'}</span><strong id="x-wins">0</strong></div><div><span>Board</span><strong id="ttt-round">1 / 3</strong></div><div class="player-o"><span>${local ? 'Player O' : 'Computer · O'}</span><strong id="o-wins">0</strong></div></div><p class="turn-status" id="ttt-status" role="status"></p><div class="board ttt-grid">${Array.from({ length: 9 }, (_, i) => `<button class="cell" data-cell="${i}" aria-label="Empty square ${i + 1}"></button>`).join('')}</div><button class="soft" id="next-board" hidden>Next board →</button><p class="control-note">Most wins across three boards takes the match.</p></section>`,
    );
    ui.on('[data-cell]', 'click', (e) => play(Number(e.currentTarget.dataset.cell)));
    ui.on('#next-board', 'click', () => {
      if (!paused && ended) newRound();
    });
    newRound();
  }
  function status(message) {
    root.querySelector('#ttt-status').textContent =
      message ||
      (turn === 'X'
        ? local
          ? 'X’s turn — find your line.'
          : 'Your turn — make a move.'
        : local
          ? 'O’s turn — find your line.'
          : 'Computer is thinking…');
    root.querySelector('#x-wins').textContent = wins[0];
    root.querySelector('#o-wins').textContent = wins[1];
    root.querySelector('#ttt-round').textContent = `${round} / 3`;
    root.querySelectorAll('[data-cell]').forEach((cell, i) => {
      cell.setAttribute('aria-disabled', String(ended || !!board[i] || (!local && turn === 'O')));
    });
  }
  function newRound() {
    round++;
    board = Array(9).fill('');
    turn = 'X';
    ended = false;
    root.querySelector('#next-board').hidden = true;
    root.querySelectorAll('[data-cell]').forEach((cell, i) => {
      cell.textContent = '';
      cell.className = 'cell';
      cell.setAttribute('aria-label', `Empty square ${i + 1}`);
    });
    status();
    if (round > 1) root.querySelector('[data-cell]').focus({ preventScroll: true });
  }
  function play(i, fromComputer = false) {
    if (paused || ended || !Number.isInteger(i) || i < 0 || i > 8 || board[i]) return;
    if (!local && (turn === 'O') !== fromComputer) return;
    board[i] = turn;
    const cell = root.querySelector(`[data-cell="${i}"]`);
    cell.textContent = turn;
    cell.classList.add(turn === 'X' ? 'mark-x' : 'mark-o', 'placed');
    cell.setAttribute('aria-label', `${turn} in square ${i + 1}`);
    const line = winningLine(board, turn);
    if (line || board.every(Boolean)) {
      ended = true;
      if (line) {
        wins[turn === 'X' ? 0 : 1]++;
        line.forEach((i) => root.querySelector(`[data-cell="${i}"]`).classList.add('winner'));
      }
      status(line ? `${turn} wins this board!` : 'A draw — well defended.');
      endRound();
      return;
    }
    turn = turn === 'X' ? 'O' : 'X';
    status();
    if (!local && turn === 'O') ui.scheduler.timeout(computerMove, 450);
  }
  function endRound() {
    if (Math.max(...wins) < 2 && round < 3) {
      root.querySelector('#next-board').hidden = false;
      root.querySelector('#next-board').focus({ preventScroll: true });
      return;
    }
    const tied = wins[0] === wins[1],
      firstWon = wins[0] > wins[1];
    const won = !tied && (local || firstWon);
    ui.scheduler.timeout(
      () =>
        finish({
          title: tied
            ? 'Match drawn'
            : local
              ? firstWon
                ? 'X wins the match!'
                : 'O wins the match!'
              : firstWon
                ? 'You win the match!'
                : 'Computer wins the match',
          message: `Final score: X ${wins[0]} — ${wins[1]} O. ${tied ? 'Good defense on both sides.' : 'Another match is a fresh start.'}`,
          outcome: tied ? 'draw' : won ? 'win' : 'loss',
          icon: tied ? '🤝' : '🏁',
          score: local ? Math.max(...wins) : wins[0],
          stats: [
            ['X wins', wins[0]],
            ['O wins', wins[1]],
            ['Draws', round - wins[0] - wins[1]],
          ],
        }),
      1000,
    );
  }
  function computerMove() {
    if (ended || paused || local || turn !== 'O') return;
    const free = board.map((v, i) => (v ? null : i)).filter((i) => i !== null);
    let choice;
    if (mode === 'hard') choice = bestMove(board);
    if (mode === 'medium') {
      for (const mark of ['O', 'X']) {
        choice = free.find((i) => {
          board[i] = mark;
          const won = !!winningLine(board, mark);
          board[i] = '';
          return won;
        });
        if (choice !== undefined) break;
      }
    }
    if (choice === undefined) choice = free[Math.floor(Math.random() * free.length)];
    if (choice !== undefined) play(choice, true);
  }
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
