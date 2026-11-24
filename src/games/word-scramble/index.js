import { createGameUI } from '../../shared/game-ui.js';
import { shuffle } from '../../shared/shuffle.js';
import { words } from './words.js';

const total = 5;

function scramble(word) {
  const letters = shuffle(word);
  if (letters.join('') === word) {
    const other = letters.findIndex((letter) => letter !== letters[0]);
    [letters[0], letters[other]] = [letters[other], letters[0]];
  }
  return letters;
}

export function mountGame({ root, options, finish, saveProgress, progress }) {
  const ui = createGameUI(root, '');
  const length = options?.length === 'long' ? 'long' : 'short';
  const bank = words.filter(([, word]) =>
    length === 'long' ? word.length >= 5 : word.length <= 4,
  );
  const recordKey = `bestSolved_${length}`;
  const lastWordKey = `lastWord_${length}`;
  let best = progress[recordKey] || 0;
  let lastWord = progress[lastWordKey];
  let paused = false;
  let set, index, solved, unaided, skipped;

  function showWord(moveFocus = false) {
    const [category, word, clue] = set[index];
    lastWord = word;
    const letters = scramble(word);
    const placed = [];
    let revealed = 0;
    let locked = false;

    ui.render(`
      <section class="arcade-stage learning-stage word-stage">
        <div class="stage-heading"><h2 id="word-heading" tabindex="-1">Word ${index + 1} of ${total}</h2><span class="mode-chip">Solved ${solved}</span></div>
        <progress class="learning-progress" aria-label="Words finished" max="${total}" value="${index}"></progress>
        <p class="word-category">${category}</p>
        <div class="word-slots" aria-hidden="true">${letters.map(() => '<span></span>').join('')}</div>
        <p class="sr-only" id="word-built" aria-live="polite">No letters placed.</p>
        <div class="word-letters" role="group" aria-label="Letter tiles">
          ${letters.map((letter, tile) => `<button type="button" data-letter="${tile}">${letter}</button>`).join('')}
        </div>
        <div class="word-actions">
          <button class="soft" type="button" id="word-remove" aria-disabled="true">Undo letter</button>
          <button type="button" id="word-check">Check word</button>
          <button type="button" id="word-next" hidden>${index + 1 === total ? 'See results' : 'Next word'}</button>
        </div>
        <p class="learning-feedback" id="word-feedback" role="status">Tap letters to build the word.</p>
        <div class="word-actions">
          <button class="soft" type="button" id="word-hint">Get a clue</button>
          <button class="soft" type="button" id="word-skip">Reveal &amp; skip</button>
        </div>
        <p class="word-clue" id="word-clue" role="status" hidden></p>
        <p class="control-note">Keyboard: type letters, use Backspace to undo, and press Enter to check.</p>
      </section>`);
    const heading = root.querySelector('#word-heading');
    const slots = [...root.querySelectorAll('.word-slots span')];
    const tiles = [...root.querySelectorAll('[data-letter]')];
    const built = root.querySelector('#word-built');
    const feedback = root.querySelector('#word-feedback');
    const remove = root.querySelector('#word-remove');
    const check = root.querySelector('#word-check');
    const next = root.querySelector('#word-next');
    const hint = root.querySelector('#word-hint');
    const skip = root.querySelector('#word-skip');
    const clueText = root.querySelector('#word-clue');

    function updateLetters() {
      slots.forEach((slot, position) => {
        slot.textContent = letters[placed[position]] || '';
        slot.classList.toggle('hinted', revealed === 2 && position === 0);
      });
      tiles.forEach((tile, position) => {
        const used = placed.includes(position);
        tile.setAttribute('aria-disabled', String(used));
        tile.classList.toggle('used', used);
        tile.tabIndex = used ? -1 : 0;
      });
      built.textContent = placed.length
        ? `Letters placed: ${placed.map((tile) => letters[tile]).join(', ')}.`
        : 'No letters placed.';
      remove.setAttribute('aria-disabled', String(placed.length <= (revealed === 2 ? 1 : 0)));
    }

    function addLetter(tile) {
      if (locked || paused || placed.includes(tile)) return;
      placed.push(tile);
      feedback.textContent = '';
      updateLetters();
    }

    function undoLetter() {
      if (locked || paused || remove.getAttribute('aria-disabled') === 'true') return;
      placed.pop();
      feedback.textContent = '';
      updateLetters();
    }

    function resolve(correct) {
      locked = true;
      if (correct) {
        solved++;
        if (revealed === 0) unaided++;
        root.querySelector('.mode-chip').textContent = `Solved ${solved}`;
      } else skipped.push(word);
      [...word].forEach((letter, position) => {
        slots[position].textContent = letter;
      });
      feedback.textContent = correct ? `You solved ${word}!` : `The word was ${word}.`;
      root.querySelector('progress').value = index + 1;
      for (const control of [...tiles, remove, check, hint, skip]) control.disabled = true;
      check.hidden = true;
      next.hidden = false;
      next.focus();
    }

    function checkWord() {
      if (locked || paused) return;
      if (placed.length < word.length) {
        feedback.textContent = 'Fill every space before checking.';
        return;
      }
      if (placed.map((tile) => letters[tile]).join('') === word) resolve(true);
      else feedback.textContent = 'Try a new order. Undo letters to move them.';
    }

    ui.on('[data-letter]', 'click', (event) =>
      addLetter(Number(event.currentTarget.dataset.letter)),
    );
    ui.on('#word-remove', 'click', undoLetter);
    ui.on('#word-check', 'click', checkWord);
    ui.on('#word-skip', 'click', () => {
      if (!locked && !paused) resolve(false);
    });
    ui.on('#word-hint', 'click', () => {
      if (paused || locked || revealed === 2) return;
      revealed++;
      clueText.hidden = false;
      clueText.textContent = clue;
      if (revealed === 1) {
        hint.textContent = 'Place first letter';
        return;
      }
      const first = placed.findIndex((tile) => letters[tile] === word[0]);
      placed.unshift(first === -1 ? letters.indexOf(word[0]) : placed.splice(first, 1)[0]);
      clueText.textContent = `${clue} First letter: ${word[0]}.`;
      feedback.textContent = 'First letter placed. Build the rest of the word.';
      hint.textContent = 'Clues used';
      hint.setAttribute('aria-disabled', 'true');
      updateLetters();
    });
    ui.on('#word-next', 'click', () => {
      if (!locked || paused || next.disabled) return;
      next.disabled = true;
      index++;
      if (index < total) {
        showWord(true);
        return;
      }

      best = Math.max(best, solved);
      saveProgress({ [recordKey]: best, [lastWordKey]: lastWord });
      finish({
        title: solved === total ? 'Word whiz!' : 'Set complete!',
        message: `You solved ${solved} of ${total} words.`,
        score: solved,
        outcome: solved === total ? 'win' : 'loss',
        stats: [
          ['Without clues', unaided],
          ['Best in this mode', `${best}/${total}`],
        ],
        review: { label: 'Review revealed words', entries: skipped },
      });
    });
    if (moveFocus) heading.focus();

    root.onkeydown = (event) => {
      if (
        event.defaultPrevented ||
        paused ||
        locked ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      if (event.key === 'Enter' && !event.target.closest('button')) {
        event.preventDefault();
        checkWord();
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        undoLetter();
      } else if (/^[a-z]$/i.test(event.key)) {
        const tile = letters.findIndex(
          (letter, position) => letter === event.key.toUpperCase() && !placed.includes(position),
        );
        if (tile !== -1) addLetter(tile);
        else feedback.textContent = `No unused ${event.key.toUpperCase()} tiles.`;
        heading.focus();
      }
    };
  }

  function start() {
    paused = false;
    set = shuffle(bank.filter(([, word]) => word !== lastWord)).slice(0, total);
    index = 0;
    solved = 0;
    unaided = 0;
    skipped = [];
    showWord();
  }

  ui.onDispose(() => {
    root.onkeydown = null;
  });
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
