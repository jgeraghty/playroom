import { createGameUI } from '../../shared/game-ui.js';

const total = 5;

export function mountGame({ root, progress, finish, saveProgress }) {
  const ui = createGameUI(root, '');
  let best = Number.isFinite(progress.bestMs) && progress.bestMs >= 0 ? progress.bestMs : Infinity;
  let times, early, state, startedAt, paused;

  function start() {
    ui.scheduler.clear();
    ui.scheduler.resume();
    times = [];
    early = 0;
    paused = false;
    ui.render(`
      <section class="arcade-stage quick-stage reaction-stage">
        <div class="stage-heading"><h2 id="reaction-trial">Trial 1 of ${total}</h2><span class="mode-chip">Best <span id="reaction-best">${displayBest()}</span></span></div>
        <p class="quick-feedback" id="reaction-note" role="status">Start the trial, then wait for GO.</p>
        <button type="button" id="reaction" data-state="ready">Start trial</button>
        <button type="button" class="quick-next" id="reaction-next" disabled>Next trial</button>
        <p class="control-note">Tap the panel or press Space or Enter on it as soon as you see GO.</p>
      </section>`);
    state = 'ready';
    ui.on('#reaction', 'pointerdown', (event) => {
      if (event.isPrimary === false || event.button !== 0 || event.defaultPrevented) return;
      activate();
    });
    ui.on('#reaction', 'keydown', (event) => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      event.preventDefault();
      if (!event.repeat) activate();
    });
    ui.on('#reaction', 'click', (event) => {
      // Assistive technology can activate a button without sending a pointer or key event.
      if (event.detail === 0) activate();
    });
    ui.on('#reaction-next', 'click', next);
  }

  function displayBest() {
    return Number.isFinite(best) ? `${best} ms` : '—';
  }

  function show(nextState, label, message) {
    state = nextState;
    const panel = root.querySelector('#reaction');
    panel.dataset.state = state;
    panel.textContent = label;
    panel.setAttribute(
      'aria-disabled',
      String(state === 'early' || state === 'measured' || state === 'ended'),
    );
    root.querySelector('#reaction-note').textContent = message;
  }

  function begin(note = 'Wait until you see GO.') {
    ui.scheduler.clear();
    show('wait', 'Wait…', note);
    root.querySelector('#reaction-trial').textContent = `Trial ${times.length + 1} of ${total}`;
    root.querySelector('#reaction-next').disabled = true;
    ui.scheduler.timeout(
      () => {
        startedAt = performance.now();
        show('go', 'GO!', 'Go!');
      },
      1200 + Math.random() * 2300,
    );
  }

  function unlockNext(label) {
    const button = root.querySelector('#reaction-next');
    button.textContent = label;
    button.disabled = false;
  }

  function activate() {
    if (paused) return;
    if (state === 'ready') begin();
    else if (state === 'wait') {
      ui.scheduler.clear();
      early++;
      show('early', 'Too soon', 'Start this trial again and wait for GO.');
      unlockNext('Retry trial');
    } else if (state === 'go') {
      const ms = Math.round(performance.now() - startedAt);
      times.push(ms);
      if (ms < best) {
        best = ms;
        saveProgress({ bestMs: best });
        root.querySelector('#reaction-best').textContent = displayBest();
      }
      show('measured', `${ms} ms`, `Trial ${times.length} recorded.`);
      unlockNext(times.length === total ? 'See results' : 'Next trial');
    }
  }

  function next() {
    if (paused || !['early', 'measured'].includes(state)) return;
    if (times.length === total) {
      state = 'ended';
      const median = [...times].sort((a, b) => a - b)[Math.floor(total / 2)];
      finish({
        title: 'Reaction set complete!',
        message: `You recorded ${total} reaction times.`,
        outcome: 'complete',
        score: Math.max(0, 1000 - median),
        stats: [
          ['Median', `${median} ms`],
          ['Fastest this set', `${Math.min(...times)} ms`],
          ['Personal best', displayBest()],
          ['Early taps', early],
        ],
        review: {
          label: 'Review trial times',
          entries: times.map((ms, i) => `Trial ${i + 1} · ${ms} ms`),
        },
      });
      return;
    }
    begin();
    root.querySelector('#reaction').focus({ preventScroll: true });
  }

  start();
  return {
    pause: () => {
      paused = true;
      ui.scheduler.pause();
    },
    resume: () => {
      if (!paused) return;
      paused = false;
      if (state === 'wait' || state === 'go') begin('Trial restarted. Wait for the new GO signal.');
      ui.scheduler.resume();
    },
    restart: start,
    destroy: () => ui.destroy(),
  };
}
