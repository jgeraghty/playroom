import { createGameUI } from '../../shared/game-ui.js';

const moves = ['Rock', 'Paper', 'Scissors'];
const icons = ['✊', '✋', '✌️'];
const rule = ['Rock crushes Scissors.', 'Paper covers Rock.', 'Scissors cut Paper.'];

export function mountGame({ root, options, finish }) {
  const ui = createGameUI(root, '');
  const goal = options?.match === '3' ? 3 : 2;
  let you, computer, ties, history, phase, paused;

  function start() {
    you = computer = ties = 0;
    history = [];
    phase = 'choose';
    paused = false;
    ui.render(`
      <section class="arcade-stage quick-stage rps-stage">
        <div class="stage-heading"><h2>Choose your move</h2><span class="mode-chip">First to ${goal}</span></div>
        <div class="session-hud">
          <div><span>You</span><strong id="rps-you">0</strong></div>
          <div><span>Computer</span><strong id="rps-computer">0</strong></div>
        </div>
        <div class="rps-versus">
          <div><span>You</span><strong id="rps-your-hand">?</strong></div>
          <div><span>Computer</span><strong id="rps-their-hand">?</strong></div>
        </div>
        <p class="quick-feedback" id="rps-feedback" role="status">Pick Rock, Paper, or Scissors.</p>
        <div class="rps-choices" role="group" aria-label="Your moves">
          ${moves.map((move, i) => `<button type="button" data-move="${i}"><span aria-hidden="true">${icons[i]}</span>${move}</button>`).join('')}
        </div>
        <button type="button" class="quick-next" id="rps-next" disabled>Next round</button>
        <p class="control-note">Rock beats Scissors. Scissors beats Paper. Paper beats Rock.</p>
        <details class="quick-history" hidden><summary>Recent rounds</summary><ol></ol></details>
      </section>`);

    const buttons = [...root.querySelectorAll('[data-move]')];
    const next = root.querySelector('#rps-next');
    const yourHand = root.querySelector('#rps-your-hand');
    const theirHand = root.querySelector('#rps-their-hand');
    const feedback = root.querySelector('#rps-feedback');
    const recent = root.querySelector('.quick-history');

    ui.on('[data-move]', 'click', (event) => {
      if (paused || phase !== 'choose') return;
      phase = 'reveal';
      const move = Number(event.currentTarget.dataset.move);
      const reply = Math.floor(Math.random() * moves.length);
      const tied = move === reply;
      const won = (move - reply + moves.length) % moves.length === 1;
      if (tied) ties++;
      else if (won) you++;
      else computer++;
      const outcome = tied ? 'Tie' : won ? 'You won' : 'Computer won';
      const round = `${outcome} · ${moves[move]} vs. ${moves[reply]}`;
      yourHand.textContent = icons[move];
      theirHand.textContent = icons[reply];
      yourHand.parentElement.dataset.winner = String(!tied && won);
      theirHand.parentElement.dataset.winner = String(!tied && !won);
      root.querySelector('#rps-you').textContent = you;
      root.querySelector('#rps-computer').textContent = computer;
      feedback.textContent = `${round}. ${tied ? 'No point this round.' : rule[won ? move : reply]}`;
      history = [round, ...history].slice(0, 5);
      recent.hidden = false;
      recent.querySelector('ol').replaceChildren(
        ...history.map((entry) => {
          const item = document.createElement('li');
          item.textContent = entry;
          return item;
        }),
      );
      for (const button of buttons) {
        button.setAttribute('aria-disabled', 'true');
        button.tabIndex = -1;
      }
      next.textContent = you === goal || computer === goal ? 'See results' : 'Next round';
      next.disabled = false;
    });

    ui.on('#rps-next', 'click', () => {
      if (paused || phase !== 'reveal') return;
      next.disabled = true;
      if (you === goal || computer === goal) {
        phase = 'ended';
        finish({
          title: you === goal ? 'You win the match!' : 'Computer wins the match',
          message: `Final score: you ${you}, computer ${computer}.`,
          outcome: you === goal ? 'win' : 'loss',
          score: you,
          stats: [
            ['Round wins', you],
            ['Ties', ties],
          ],
        });
        return;
      }
      phase = 'choose';
      yourHand.textContent = theirHand.textContent = '?';
      delete yourHand.parentElement.dataset.winner;
      delete theirHand.parentElement.dataset.winner;
      feedback.textContent = 'Pick your next move.';
      next.textContent = 'Next round';
      for (const button of buttons) {
        button.removeAttribute('aria-disabled');
        button.tabIndex = 0;
      }
      buttons[0].focus({ preventScroll: true });
    });
  }

  start();
  return {
    pause: () => {
      paused = true;
    },
    resume: () => {
      paused = false;
    },
    restart: start,
    destroy: () => ui.destroy(),
  };
}
