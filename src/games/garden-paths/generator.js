import { rotateClockwise, sides, traceWater } from './rules.js';

function pick(items, random) {
  return items[Math.floor(random() * items.length)];
}

function neighbors(index, width) {
  const x = index % width;
  const y = Math.floor(index / width);
  return sides.flatMap(({ dx, dy, ...direction }) => {
    const column = x + dx;
    const row = y + dy;
    return column >= 0 && column < width && row >= 0 && row < width
      ? [{ ...direction, index: row * width + column }]
      : [];
  });
}

function addWeed(tiles, columns, random) {
  const traps = [];
  for (const [index, tile] of tiles.entries()) {
    if (tile?.type !== 'path' || ![5, 10].includes(tile.openings)) continue;
    const spare = neighbors(index, columns).filter(({ bit }) => !(tile.openings & bit));
    if (spare.length === 2 && spare.every(({ index: next }) => !tiles[next])) {
      const weed = pick(spare, random);
      const empty = spare.find((side) => side !== weed);
      traps.push({ tile, weed, empty });
    }
  }
  if (!traps.length) return false;
  const { tile, weed, empty } = pick(traps, random);
  tile.openings |= empty.bit;
  tiles[weed.index] = { type: 'weed', openings: weed.opposite };
  return true;
}

function growGarden(level, random) {
  const columns = level < 4 ? 4 : 5;
  const target = Math.min(15, 6 + level);
  const edge = columns - 1;
  const source = pick([0, edge, columns * edge, columns * columns - 1], random);
  const tiles = Array(columns * columns).fill(null);
  tiles[source] = { type: 'source', openings: 0 };
  const occupied = [source];

  while (occupied.length < target) {
    const starts = occupied.length === 1 ? occupied : occupied.slice(1);
    const frontier = starts.flatMap((from) =>
      neighbors(from, columns)
        .filter(({ index }) => !tiles[index])
        .map((next) => ({ ...next, from })),
    );
    if (!frontier.length) break;
    // Favor recent growth some of the time for longer routes among the branches.
    const recent = frontier.filter(({ from }) => occupied.slice(-3).includes(from));
    const { from, index, bit, opposite } = pick(
      recent.length && random() < 0.65 ? recent : frontier,
      random,
    );
    tiles[from].openings |= bit;
    tiles[index] = { type: 'path', openings: opposite };
    occupied.push(index);
  }

  for (const tile of tiles) {
    if (tile?.type === 'path' && sides.some(({ bit }) => tile.openings === bit)) {
      tile.type = 'flower';
    }
  }
  const hasFlowerBranch = tiles.some(
    (tile) => tile?.type === 'path' && [7, 11, 13, 14].includes(tile.openings),
  );
  if (!hasFlowerBranch) return null;
  if (level >= 4 && !addWeed(tiles, columns, random)) return null;
  if (level >= 9) addWeed(tiles, columns, random);
  return { columns, tiles };
}

function needsThreeTurns(board, openings, paths) {
  if (traceWater(board, openings).won) return false;
  const candidate = [...openings];
  for (const [i, index] of paths.entries()) {
    candidate[index] = rotateClockwise(openings[index]);
    if (traceWater(board, candidate).won) return false;
    for (const other of paths.slice(i + 1)) {
      candidate[other] = rotateClockwise(openings[other]);
      if (traceWater(board, candidate).won) return false;
      candidate[other] = openings[other];
    }
    for (let turn = 2; turn < 4; turn++) {
      candidate[index] = rotateClockwise(candidate[index]);
      if (traceWater(board, candidate).won) return false;
    }
    candidate[index] = openings[index];
  }
  return true;
}

function scramble(board, level, random) {
  const paths = board.tiles.flatMap((tile, index) =>
    tile?.type === 'path' && tile.openings !== 15 ? [index] : [],
  );
  if (paths.length < 2) return null;
  const solution = board.tiles.map((tile) => tile?.openings ?? 0);
  if (!traceWater(board, solution).won) return null;
  for (let attempt = 0; attempt < 12; attempt++) {
    const openings = [...solution];
    const candidates = [...paths];
    const count = Math.min(candidates.length, 2 + Math.floor((level - 1) / 2));
    for (let i = 0; i < count; i++) {
      const [index] = candidates.splice(Math.floor(random() * candidates.length), 1);
      const turns =
        solution[index] === 5 || solution[index] === 10 ? 1 : 1 + Math.floor(random() * 3);
      for (let turn = 0; turn < turns; turn++) openings[index] = rotateClockwise(openings[index]);
    }
    if (level === 1 && traceWater(board, openings).reached.size < 2) continue;
    if (needsThreeTurns(board, openings, paths)) return { ...board, openings };
  }
  return null;
}

function fallbackGarden(level, rotation) {
  // The advanced layout keeps four separate flower branches and two dry weeds.
  const advanced = level >= 9;
  const templateWidth = advanced ? 5 : 4;
  const columns = level < 4 ? 4 : 5;
  const masks = advanced
    ? [
        [0, 0, 4, 0, 0],
        [2, 14, 11, 12, 0],
        [0, 13, 10, 7, 0],
        [2, 9, 2, 13, 8],
        [0, 0, 0, 1, 0],
      ].flat()
    : [0, 0, 4, 0, 0, 6, 13, level >= 4 ? 8 : 0, 2, 9, 1, 0];
  const tileTypes = advanced
    ? { 2: 'flower', 5: 'source', 12: 'weed', 15: 'flower', 17: 'flower', 19: 'weed', 23: 'flower' }
    : { 2: 'flower', 7: 'weed', 8: 'source', 10: 'flower' };
  const scrambleTurns = advanced
    ? { 6: 3, 7: 1, 8: 2, 11: 2, 13: 2, 16: 3, 18: 2 }
    : { 5: 3, 6: 2 };
  const tiles = Array(columns * columns).fill(null);
  const openings = Array(tiles.length).fill(0);
  for (const [index, original] of masks.entries()) {
    if (!original) continue;
    let column = index % templateWidth;
    let row = Math.floor(index / templateWidth);
    let mask = original;
    for (let turn = 0; turn < rotation; turn++) {
      [column, row] = [columns - 1 - row, column];
      mask = rotateClockwise(mask);
    }
    const next = row * columns + column;
    tiles[next] = { type: tileTypes[index] || 'path', openings: mask };
    const turns = scrambleTurns[index] ?? 0;
    for (let turn = 0; turn < turns; turn++) mask = rotateClockwise(mask);
    openings[next] = mask;
  }
  return { columns, tiles, openings };
}

function layoutKey(board) {
  return board.tiles.map((tile) => (tile ? `${tile.type[0]}${tile.openings}` : '-')).join(',');
}

export function generateGarden(level, random, previous) {
  const previousKey = previous && layoutKey(previous);
  for (let attempt = 0; attempt < 24; attempt++) {
    const board = growGarden(level, random);
    const garden = board && layoutKey(board) !== previousKey && scramble(board, level, random);
    if (garden) return garden;
  }
  const rotation = Math.floor(random() * 4);
  const fallback = fallbackGarden(level, rotation);
  return layoutKey(fallback) !== previousKey ? fallback : fallbackGarden(level, (rotation + 1) % 4);
}

export function createGardenSequence(seed = Math.floor(Math.random() * 2 ** 32)) {
  let state = seed >>> 0;
  function random() {
    state = (state + 0x6d2b79f5) | 0;
    let bits = Math.imul(state ^ (state >>> 15), 1 | state);
    bits ^= bits + Math.imul(bits ^ (bits >>> 7), 61 | bits);
    return ((bits ^ (bits >>> 14)) >>> 0) / 2 ** 32;
  }

  let previous;
  let level = 0;
  return () => {
    previous = generateGarden(++level, random, previous);
    return previous;
  };
}
