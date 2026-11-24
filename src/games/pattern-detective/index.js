import { createGameUI } from '../../shared/game-ui.js';
import { shuffle } from '../../shared/shuffle.js';
import { arrows, createPuzzleRun, shapeSymbols, tileLabel } from './puzzles.js';
import './style.css';

function dots(count) {
  return `<span class="detective-dots" aria-hidden="true">${'<span></span>'.repeat(count)}</span>`;
}

function tile(kind, value) {
  if (value === null) {
    return '<span class="detective-symbol" aria-hidden="true">?</span><span>Empty</span>';
  }
  const label = tileLabel(kind, value);
  if (kind === 'quantity') return `${dots(value)}<span>${label}</span>`;
  if (kind === 'combined') {
    const [direction, count] = value.split('/').map(Number);
    return `<span class="detective-combined-tile"><span class="detective-symbol" aria-hidden="true">${arrows[direction]}</span>${dots(count)}</span><span>${label}</span>`;
  }
  const symbol = kind === 'rotation' ? arrows[value] : shapeSymbols[value];
  return `<span class="detective-symbol" aria-hidden="true">${symbol}</span><span>${label}</span>`;
}

export function mountGame({ root, progress = {}, finish, saveProgress }) {
  const ui = createGameUI(root, '');
  let best =
    Number.isSafeInteger(progress.bestStreak) && progress.bestStreak > 0 ? progress.bestStreak : 0;
  let paused = false;
  let run, streak;

  function showPuzzle(moveFocus = false) {
    const puzzle = run.next();
    const { level, mode, kind, shown, positions, answers } = puzzle;
    const choices = shuffle(puzzle.choices);
    const repair = mode === 'repair';
    const extend = mode === 'extend';
    const editable = (position) => repair || (extend && positions.includes(position));
    let active = repair ? null : positions[0];
    const draft = new Map();
    let solved = false;

    ui.render(`
      <section class="arcade-stage detective-stage" aria-labelledby="detective-heading">
        <div class="stage-heading">
          <h2 id="detective-heading" tabindex="-1">${puzzle.title}</h2>
          <span class="mode-chip">Level ${level}</span>
        </div>
        <p class="detective-streak">Streak <strong>${streak}</strong> · Best <strong>${best}</strong></p>
        <p id="detective-prompt">${puzzle.instruction}</p>
        <ol class="detective-sequence detective-${kind}" aria-label="Pattern sequence" role="list">
          ${shown
            .map((value, position) => {
              const key = editTile(position);
              const tag = editable(position) ? 'button' : 'div';
              return `<li><${tag} class="detective-tile${value === null ? ' detective-gap' : ''}" data-slot="${position}"${key}>
              <span class="detective-position">${position + 1}</span><span class="detective-content">${tile(kind, value)}</span>
            </${tag}></li>`;
            })
            .join('')}
        </ol>
        <div class="detective-choices" role="group" aria-label="Available tiles">
          ${choices
            .map(
              (
                value,
                choice,
              ) => `<button class="detective-tile soft" type="button" data-choice="${choice}" aria-keyshortcuts="${choice + 1}">
            <span class="detective-shortcut" aria-hidden="true">${choice + 1}</span>
            <span class="detective-content">${tile(kind, value)}</span>
          </button>`,
            )
            .join('')}
        </div>
        <p class="detective-selection" id="detective-selection" role="status"></p>
        <div class="detective-actions">
          <button type="button" class="soft" id="detective-clue">Get a clue</button>
          <button type="button" id="detective-check">Check pattern</button>
        </div>
        <p class="detective-feedback" id="detective-feedback" role="status"></p>
        <p class="control-note">Use Tab to move between controls. Press 1–${choices.length} to choose a tile.</p>
      </section>`);

    function editTile(position) {
      return editable(position) ? ' type="button" aria-pressed="false"' : '';
    }

    const heading = root.querySelector('#detective-heading');
    const buttons = [...root.querySelectorAll('[data-choice]')];
    const tiles = [...root.querySelectorAll('[data-slot]')];
    const selection = root.querySelector('#detective-selection');
    const feedback = root.querySelector('#detective-feedback');
    const check = root.querySelector('#detective-check');
    const clue = root.querySelector('#detective-clue');

    function renderDraft() {
      tiles.forEach((element, position) => {
        const value = draft.get(position) ?? shown[position];
        const selected = !solved && editable(position) && position === active;
        const revealed = solved && positions.includes(position);
        element.querySelector('.detective-content').innerHTML = tile(kind, value);
        element.classList.toggle('detective-gap', value === null);
        element.classList.toggle('detective-highlight', revealed);
        if (editable(position)) {
          element.setAttribute('aria-pressed', String(selected));
          const label = value === null ? 'empty' : tileLabel(kind, value);
          const original =
            repair && draft.has(position) && !solved
              ? `, was ${tileLabel(kind, shown[position])}`
              : '';
          element.setAttribute('aria-label', `Tile ${position + 1}, ${label}${original}`);
          element.disabled = solved;
        }
      });
      for (const button of buttons) button.disabled = active === null || solved;
      check.disabled = solved || draft.size < answers.length;
      selection.textContent = solved
        ? ''
        : active === null
          ? 'Select a tile in the pattern.'
          : `Placing tiles in position ${active + 1}.`;
    }

    ui.on('button[data-slot]', 'click', (event) => {
      if (paused || solved) return;
      const position = Number(event.currentTarget.dataset.slot);
      if (repair && position !== active) draft.clear();
      active = position;
      renderDraft();
    });
    ui.on('[data-choice]', 'click', (event) => {
      if (paused || solved || active === null) return;
      draft.set(active, choices[Number(event.currentTarget.dataset.choice)]);
      if (extend) active = positions.find((position) => !draft.has(position)) ?? active;
      renderDraft();
    });
    ui.on('#detective-clue', 'click', () => {
      if (paused || solved) return;
      feedback.textContent = puzzle.clue;
    });
    function describeEdits(edits) {
      return edits
        .map(([position, value]) => `tile ${position + 1}, ${tileLabel(kind, value)}`)
        .join('; ');
    }

    ui.on('#detective-check', 'click', () => {
      if (paused || check.disabled || solved) return;
      solved = true;
      if (!positions.every((position, item) => draft.get(position) === answers[item])) {
        check.disabled = true;
        const submitted = describeEdits([...draft].sort(([a], [b]) => a - b));
        const correct = describeEdits(
          positions.map((position, index) => [position, answers[index]]),
        );
        finish({
          title: 'Streak complete',
          message: `You solved ${streak} ${streak === 1 ? 'pattern' : 'patterns'} in a row. ${puzzle.rule}`,
          outcome: 'complete',
          stats: [
            ['Streak', streak],
            ['Best streak', best],
            ['Level reached', level],
          ],
          review: {
            label: 'Review the last pattern',
            entries: [
              `${puzzle.title} · ${shown.map((value, index) => `${index + 1}. ${value === null ? 'Empty' : tileLabel(kind, value)}`).join(' · ')}`,
              `Your answer · ${submitted}`,
              `Correct answer · ${correct}`,
              puzzle.rule,
            ],
          },
        });
        return;
      }

      streak++;
      if (streak > best) {
        best = streak;
        saveProgress({ bestStreak: best });
      }
      root.querySelector('.detective-streak').innerHTML =
        `Streak <strong>${streak}</strong> · Best <strong>${best}</strong>`;
      renderDraft();
      check.hidden = true;
      clue.hidden = true;
      feedback.textContent = `Pattern solved. ${puzzle.rule}`;
      heading.focus({ preventScroll: true });
      ui.scheduler.timeout(() => showPuzzle(true), 3000);
    });
    renderDraft();
    if (moveFocus) heading.focus();
  }

  function onKeyDown(event) {
    if (event.defaultPrevented || paused || event.altKey || event.ctrlKey || event.metaKey) return;
    if (/^[1-4]$/.test(event.key)) {
      const choice = root.querySelector(`[data-choice="${Number(event.key) - 1}"]`);
      if (choice && !choice.disabled) {
        event.preventDefault();
        if (!event.repeat) choice.click();
      }
    } else if (event.key === 'Enter' && event.repeat) {
      event.preventDefault();
    }
  }

  function start() {
    if (ui.disposed) return;
    ui.scheduler.clear();
    ui.scheduler.resume();
    paused = false;
    streak = 0;
    run = createPuzzleRun();
    showPuzzle();
  }

  root.addEventListener('keydown', onKeyDown);
  ui.onDispose(() => root.removeEventListener('keydown', onKeyDown));
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
    destroy: ui.destroy,
  };
}
