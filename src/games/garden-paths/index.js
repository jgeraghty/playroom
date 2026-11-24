import './style.css';
import { createGameUI } from '../../shared/game-ui.js';
import { createGardenSequence } from './generator.js';
import { rotateClockwise, sides, traceWater } from './rules.js';

const flower = '<span class="garden-flower-marker" aria-hidden="true"><span>✿</span></span>';
const weed = '<span class="garden-weed-marker" aria-hidden="true">✦</span>';
const can = '<span class="garden-can" aria-hidden="true"></span>';

export const gardenClearDelay = 1250;

export function mountGame({ root, progress = {}, saveProgress }) {
  const ui = createGameUI(root, '');
  let best = Number.isFinite(progress.bestBedsCleared) ? progress.bestBedsCleared : 0;
  let nextGarden;
  let board;
  let openings;
  let water;
  let cleared;
  let paused = false;
  let solved = false;

  function renderState(feedback) {
    root.querySelector('#garden-watered').textContent = `${water.watered} of ${water.flowers}`;
    root.querySelector('#garden-cleared').textContent = cleared;
    root.querySelector('#garden-best').textContent = best;
    const hint = root.querySelector('#garden-feedback');
    hint.textContent = solved
      ? 'Bed cleared. A new garden is coming.'
      : water.wetWeeds
        ? 'A weed is getting water. Turn a path to cut off its supply.'
        : feedback;
    const weedCount = root.querySelector('#garden-weeds');
    if (weedCount) {
      weedCount.textContent = `${water.weeds - water.wetWeeds} of ${water.weeds}`;
      weedCount.classList.toggle('garden-warning', water.wetWeeds > 0);
    }
    board.tiles.forEach((tile, index) => {
      if (!tile) return;
      const element = root.querySelector(`[data-garden-tile="${index}"]`);
      const wet = water.reached.has(index);
      const row = Math.floor(index / board.columns) + 1;
      const column = (index % board.columns) + 1;
      const openingsHere = sides.filter(({ bit }) => openings[index] & bit);
      const connections = openingsHere.map(({ name }) => name).join(', ');
      const position = `Row ${row}, column ${column}`;
      const flowingSides = openingsHere
        .filter(({ bit }) => water.links[index] & bit)
        .map(({ name }) => name)
        .join(', ');
      const state = wet ? `Water flowing ${flowingSides}` : 'Dry';
      const label = {
        source: `Watering can, ${position}. Outlet ${connections}.`,
        flower: `${wet ? 'Watered' : 'Dry'} flower, ${position}. Inlet ${connections}.`,
        weed: `${wet ? 'Watered' : 'Dry'} weed, ${position}. Inlet ${connections}.`,
        path: `Path, ${position}. Open ${connections}. ${state}.`,
      }[tile.type];
      element.classList.toggle('garden-wet', wet);
      element.setAttribute('aria-label', label);
      if (tile.type === 'path') {
        element.setAttribute('aria-disabled', String(solved));
        element.tabIndex = solved ? -1 : 0;
      }
      element.innerHTML =
        openingsHere
          .map(({ name, bit }) => {
            const flowing = water.links[index] & bit;
            return `<span aria-hidden="true" class="garden-arm garden-${name}${flowing ? ' garden-flow' : ''}"></span>`;
          })
          .join('') + { source: can, flower, weed, path: '' }[tile.type];
    });
  }

  function resetBoard() {
    solved = false;
    openings = [...board.openings];
    water = traceWater(board, openings);
    renderState(boardHint());
  }

  function boardHint() {
    return water.weeds
      ? 'Water the flowers and keep every weed dry.'
      : 'Turn paths to match their openings. Follow the blue water from the can.';
  }

  function turn(index) {
    if (paused || solved || ui.disposed) return;
    const reachedBeforeTurn = water.reached.size;
    openings[index] = rotateClockwise(openings[index]);
    water = traceWater(board, openings);
    solved = water.won;
    if (solved) {
      cleared++;
      if (cleared > best) {
        best = cleared;
        saveProgress({ bestBedsCleared: best });
      }
      ui.scheduler.timeout(advance, gardenClearDelay);
    }
    const feedback =
      !cleared && water.reached.size > reachedBeforeTurn
        ? 'The water reached another path. Follow the new blue openings.'
        : boardHint();
    renderState(feedback);
  }

  function advance() {
    const restoreBoardFocus = root.contains(root.ownerDocument.activeElement);
    board = nextGarden();
    renderBoard();
    if (restoreBoardFocus) root.querySelector('#garden-heading').focus({ preventScroll: true });
  }

  function renderBoard() {
    const hasWeeds = board.tiles.some((tile) => tile?.type === 'weed');
    ui.render(`
    <section class="arcade-stage garden-stage">
      <div class="stage-heading">
        <h2 id="garden-heading" tabindex="-1">Garden bed ${cleared + 1}</h2>
        <span class="mode-chip">Best run <span id="garden-best"></span></span>
      </div>
      <div class="session-hud">
        <div role="status"><span>Flowers watered</span><strong id="garden-watered"></strong></div>
        ${hasWeeds ? '<div role="status"><span>Weeds dry</span><strong id="garden-weeds"></strong></div>' : ''}
        <div><span>Beds cleared</span><strong id="garden-cleared"></strong></div>
      </div>
      <div class="garden-grid" style="--garden-columns:${board.columns}" role="group" aria-label="Garden bed ${cleared + 1} paths">
        ${board.tiles
          .map((tile, index) => {
            if (!tile) return '<div class="garden-empty" aria-hidden="true"></div>';
            const attributes = `data-garden-tile="${index}" class="garden-tile garden-${tile.type}"`;
            return tile.type === 'path'
              ? `<button type="button" ${attributes} aria-describedby="garden-rotate-note"></button>`
              : `<div role="img" ${attributes}></div>`;
          })
          .join('')}
      </div>
      <span class="garden-step-name" id="garden-rotate-note">Activate to rotate clockwise.</span>
      <p class="control-note" id="garden-feedback" role="status"></p>
      <div class="stage-bottom garden-actions">
        <button class="soft" type="button" id="garden-reset">Reset board</button>
      </div>
    </section>
  `);

    ui.on('button[data-garden-tile]', 'click', (event) =>
      turn(Number(event.currentTarget.dataset.gardenTile)),
    );
    ui.on('#garden-reset', 'click', () => {
      if (!paused && !solved) resetBoard();
    });
    resetBoard();
  }

  function start() {
    ui.scheduler.clear();
    ui.scheduler.resume();
    paused = false;
    cleared = 0;
    nextGarden = createGardenSequence();
    root.classList.remove('garden-paused');
    advance();
  }

  start();

  return {
    pause() {
      paused = true;
      ui.scheduler.pause();
      root.classList.add('garden-paused');
    },
    resume() {
      paused = false;
      ui.scheduler.resume();
      root.classList.remove('garden-paused');
    },
    restart: start,
    destroy() {
      root.classList.remove('garden-paused');
      ui.destroy();
    },
  };
}
