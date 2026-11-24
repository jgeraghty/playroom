import { createGameUI } from '../../shared/game-ui.js';
import { startRoundClock } from '../../shared/round-clock.js';

const palette = [
  ['Red', '●', 'red'],
  ['Blue', '◆', 'blue'],
  ['Yellow', '★', 'yellow'],
  ['Green', '▲', 'green'],
];
const goal = 10;

export function mountGame({ root, options, progress, finish, saveProgress }) {
  const ui = createGameUI(root, '');
  const timed = options?.mode === 'timed';
  let best = progress.bestScore_timed || 0;
  let paused = false;

  function start() {
    ui.scheduler.clear();
    ui.scheduler.resume();
    paused = false;
    let phase = timed ? 'ready' : 'play';
    let score = 0;
    let misses = 0;
    let target = -1;
    ui.render(`
      <section class="arcade-stage quick-stage color-stage">
        <div class="stage-heading"><h2>Match the target</h2><span class="mode-chip">${timed ? 'Timed' : 'Practice'}</span></div>
        <div class="session-hud">
          <div><span>Matches</span><strong id="color-score">${timed ? '0' : '0/10'}</strong></div>
          <div><span>${timed ? 'Time left' : 'Wrong picks'}</span><strong id="color-time">${timed ? '15s' : '0'}</strong></div>
        </div>
        <div class="color-target" id="color-target">Get ready</div>
        <p class="quick-feedback" id="color-feedback" role="status">${timed ? 'Get ready. The round starts in three seconds.' : 'Choose the tile that matches the target.'}</p>
        <div class="quick-pad-grid" role="group" aria-label="Color tiles">
          ${palette.map(([name, symbol, tone], index) => `<button type="button" data-color="${index}" data-tone="${tone}" aria-disabled="${timed}"><span aria-hidden="true">${symbol}</span>${name}</button>`).join('')}
        </div>
      </section>`);
    const board = root.querySelector('#color-target');
    const clock = root.querySelector('#color-time');
    const feedback = root.querySelector('#color-feedback');
    const buttons = [...root.querySelectorAll('[data-color]')];

    function nextTarget() {
      const count = palette.length - (target < 0 ? 0 : 1);
      const index = Math.floor(Math.random() * count);
      target = target < 0 || index < target ? index : index + 1;
      const [name, symbol, tone] = palette[target];
      board.dataset.tone = tone;
      board.textContent = `${symbol} ${name}`;
      return name;
    }

    function complete() {
      phase = 'ended';
      if (timed) {
        best = Math.max(best, score);
        saveProgress({ bestScore_timed: best });
      }
      const won = score >= goal;
      const accuracy = score + misses ? `${Math.round((score / (score + misses)) * 100)}%` : '—';
      finish({
        title: timed ? 'Time’s up!' : 'Practice complete!',
        message: `You found ${score} ${score === 1 ? 'match' : 'matches'}.`,
        outcome: timed ? (won ? 'win' : 'loss') : 'complete',
        score,
        stats: [
          ['Accuracy', accuracy],
          ['Wrong picks', misses],
          ...(timed ? [['Timed best', best]] : []),
        ],
      });
    }

    ui.on('[data-color]', 'click', (event) => {
      if (paused || phase !== 'play') return;
      const picked = Number(event.currentTarget.dataset.color);
      if (picked !== target) {
        misses++;
        if (!timed) clock.textContent = misses;
        feedback.textContent = `Try again. Look for ${palette[target][0]}.`;
        return;
      }
      score++;
      root.querySelector('#color-score').textContent = timed ? score : `${score}/${goal}`;
      if (!timed && score === goal) complete();
      else feedback.textContent = `Matched! Next target: ${nextTarget()}.`;
    });

    if (timed) {
      startRoundClock(
        ui.scheduler,
        15,
        (label) => {
          clock.textContent = label;
        },
        () => {
          phase = 'play';
          for (const button of buttons) button.setAttribute('aria-disabled', 'false');
          feedback.textContent = `Go! Look for ${nextTarget()}.`;
        },
        complete,
      );
    } else nextTarget();
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
