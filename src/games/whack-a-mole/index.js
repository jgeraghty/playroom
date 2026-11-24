import { createGameUI } from '../../shared/game-ui.js';
import { startRoundClock } from '../../shared/round-clock.js';

const holes = 9;
const practiceGoal = 10;
const timedGoal = 8;

export function mountGame({ root, options, finish, saveProgress, progress }) {
  const ui = createGameUI(root, '');
  const timed = options?.mode === 'timed';
  let best = progress.bestScore_timed || 0;
  let paused = false;

  function start() {
    ui.scheduler.clear();
    ui.scheduler.resume();
    paused = false;
    let phase = timed ? 'ready' : 'play';
    let hits = 0;
    let escapes = 0;
    let emptyTaps = 0;
    let target = -1;
    let last = -1;
    let expiry;
    ui.render(`
      <section class="arcade-stage quick-stage mole-stage">
        <div class="stage-heading"><h2>Catch the mole</h2><span class="mode-chip">${timed ? 'Timed' : 'Relaxed'}</span></div>
        <div class="session-hud">
          <div><span>Hits</span><strong id="mole-score">${timed ? '0' : '0/10'}</strong></div>
          <div><span>${timed ? 'Time left' : 'Empty taps'}</span><strong id="mole-time">${timed ? '15s' : '0'}</strong></div>
        </div>
        <p class="quick-feedback" id="mole-feedback" role="status">${timed ? 'Get ready. The round starts in three seconds.' : 'Tap the hole with the mole.'}</p>
        <div class="mole-grid" role="group" aria-label="Mole holes">
          ${Array.from({ length: holes }, (_, i) => `<button type="button" data-hole="${i}" aria-label="Hole ${i + 1}, empty" aria-disabled="${timed}"><span aria-hidden="true"></span></button>`).join('')}
        </div>
      </section>`);
    const buttons = [...root.querySelectorAll('[data-hole]')];
    const score = root.querySelector('#mole-score');
    const clock = root.querySelector('#mole-time');
    const feedback = root.querySelector('#mole-feedback');

    function mark(index, state, icon = '') {
      const button = buttons[index];
      button.dataset.state = state;
      button.setAttribute('aria-label', `Hole ${index + 1}, ${state === 'up' ? 'mole' : 'empty'}`);
      button.firstElementChild.textContent = icon;
    }

    function complete() {
      if (phase === 'ended') return;
      phase = 'ended';
      ui.scheduler.clear();
      if (timed) {
        best = Math.max(best, hits);
        saveProgress({ bestScore_timed: best });
      }
      finish({
        title: timed ? 'Time’s up!' : 'All moles found!',
        message: `You caught ${hits} ${hits === 1 ? 'mole' : 'moles'}.`,
        score: hits,
        outcome: timed ? (hits >= timedGoal ? 'win' : 'loss') : 'complete',
        stats: timed
          ? [
              ['Timed best', best],
              ['Escaped', escapes],
              ['Empty taps', emptyTaps],
            ]
          : [
              ['Hits', hits],
              ['Empty taps', emptyTaps],
            ],
      });
    }

    function pop(prefix = '') {
      if (phase !== 'play') return;
      if (last >= 0) mark(last, 'empty');
      const pick = Math.floor(Math.random() * (holes - (last < 0 ? 0 : 1)));
      target = last < 0 || pick < last ? pick : pick + 1;
      last = target;
      mark(target, 'up', '🐹');
      feedback.textContent = `${prefix}Mole in hole ${target + 1}!`;
      if (timed)
        expiry = ui.scheduler.timeout(() => {
          mark(target, 'miss', '↘');
          target = -1;
          escapes++;
          feedback.textContent = 'That mole got away.';
          ui.scheduler.timeout(pop, 250);
        }, 1050);
    }

    ui.on('[data-hole]', 'click', (event) => {
      if (paused || phase !== 'play') return;
      const picked = Number(event.currentTarget.dataset.hole);
      if (picked !== target) {
        if (target < 0) return;
        emptyTaps++;
        if (!timed) clock.textContent = emptyTaps;
        feedback.textContent = `Empty hole. Look for the mole in hole ${target + 1}.`;
        return;
      }
      ui.scheduler.clearTimeout(expiry);
      mark(picked, 'hit', '✓');
      target = -1;
      hits++;
      score.textContent = timed ? hits : `${hits}/${practiceGoal}`;
      feedback.textContent = 'Got it!';
      if (!timed && hits === practiceGoal) {
        phase = 'finishing';
        ui.scheduler.timeout(complete, 350);
      } else ui.scheduler.timeout(() => pop('Got it! '), 300);
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
          pop();
        },
        complete,
      );
    } else pop();
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
