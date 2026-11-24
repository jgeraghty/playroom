import { createGameUI } from '../../shared/game-ui.js';

const ranges = { 20: 5, 100: 7, 1000: 10 };

export function mountGame({ root, options, progress, finish, saveProgress }) {
  const ui = createGameUI(root, '');
  const max = Object.hasOwn(ranges, options?.range) ? Number(options.range) : 20;
  const limit = ranges[max];
  const recordKey = `bestGuesses_${max}`;
  let best = progress[recordKey];
  let paused = false;

  function start() {
    paused = false;
    const secret = 1 + Math.floor(Math.random() * max);
    let lower = 1;
    let upper = max;
    let tries = 0;
    let hints = 0;
    let ended = false;

    ui.render(`
      <section class="arcade-stage learning-stage guess-stage">
        <div class="stage-heading"><h2>Find the secret number</h2></div>
        <div class="session-hud">
          <div><span>Guesses left</span><strong id="guess-left">${limit}</strong></div>
          <div><span>Best without hints</span><strong>${best || '—'}</strong></div>
        </div>
        <div class="guess-range">
          <span>Still possible</span>
          <strong id="guess-range">1–${max}</strong>
          <div class="guess-track" aria-hidden="true"><span></span></div>
        </div>
        <form class="guess-form" novalidate>
          <label for="guess-input">Your guess</label>
          <div class="guess-entry">
            <input id="guess-input" inputmode="numeric" autocomplete="off" placeholder="1–${max}">
            <button type="submit">Guess</button>
          </div>
        </form>
        <p class="learning-feedback" id="guess-feedback" role="status">Pick any number in the range.</p>
        <div class="guess-clues">
          <button class="soft" type="button" id="guess-hint">Get a hint</button>
          <p id="guess-clue" role="status"></p>
        </div>
        <div class="guess-history" hidden><h3>Guess history</h3><ol></ol></div>
      </section>`);
    const input = root.querySelector('#guess-input');
    const feedback = root.querySelector('#guess-feedback');
    const range = root.querySelector('#guess-range');
    const track = root.querySelector('.guess-track span');
    const left = root.querySelector('#guess-left');
    const history = root.querySelector('.guess-history');
    const list = history.querySelector('ol');
    const hint = root.querySelector('#guess-hint');
    const clue = root.querySelector('#guess-clue');

    function updateRange() {
      range.textContent = lower === upper ? String(lower) : `${lower}–${upper}`;
      input.placeholder = range.textContent;
      track.style.left = `${((lower - 1) / max) * 100}%`;
      track.style.width = `${((upper - lower + 1) / max) * 100}%`;
    }

    ui.on('.guess-form', 'submit', (event) => {
      event.preventDefault();
      if (paused || ended) return;
      const value = input.value.trim();
      const guess = Number(value);
      if (!/^\d+$/.test(value) || guess < lower || guess > upper) {
        feedback.textContent = `Enter a whole number from ${lower} to ${upper}. Guesses left: ${limit - tries}.`;
        input.select();
        return;
      }

      tries++;
      left.textContent = limit - tries;
      if (guess === secret || tries === limit) {
        ended = true;
        const won = guess === secret;
        if (won && hints === 0) {
          best = Math.min(best || Infinity, tries);
          saveProgress({ [recordKey]: best });
        }
        finish({
          title: won ? 'You found it!' : 'Out of guesses',
          message: `The secret number was ${secret}.`,
          score: won ? limit - tries + 1 : 0,
          outcome: won ? 'win' : 'loss',
          stats: [
            ['Guesses used', `${tries}/${limit}`],
            ['Hints used', hints],
          ],
        });
        return;
      }

      const higher = guess < secret;
      if (higher) lower = guess + 1;
      else upper = guess - 1;
      updateRange();
      const entry = document.createElement('li');
      entry.textContent = `${guess} · ${higher ? 'Go higher ↑' : 'Go lower ↓'}`;
      list.prepend(entry);
      history.hidden = false;
      feedback.textContent = `${higher ? 'Go higher.' : 'Go lower.'} Still possible: ${range.textContent}. Guesses left: ${limit - tries}.`;
      input.value = '';
      input.focus();
    });

    ui.on('#guess-hint', 'click', () => {
      if (paused || ended || hints === 2) return;
      hints++;
      const parity = secret % 2 ? 'odd' : 'even';
      if (hints === 2 && lower < upper) {
        const middle = Math.floor((lower + upper) / 2);
        if (secret <= middle) upper = middle;
        else lower = middle + 1;
        updateRange();
        feedback.textContent = 'Use the updated range for your next guess.';
      }
      clue.textContent =
        hints === 1
          ? `The number is ${parity}.`
          : `Look in ${range.textContent}. The number is ${parity}.`;
      if (hints === 2) {
        hint.textContent = 'Hints used';
        hint.setAttribute('aria-disabled', 'true');
      } else hint.textContent = 'Narrow the range';
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
