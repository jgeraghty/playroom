export const sides = [
  { bit: 1, opposite: 4, dx: 0, dy: -1, name: 'north' },
  { bit: 2, opposite: 8, dx: 1, dy: 0, name: 'east' },
  { bit: 4, opposite: 1, dx: 0, dy: 1, name: 'south' },
  { bit: 8, opposite: 2, dx: -1, dy: 0, name: 'west' },
];

export function rotateClockwise(openings) {
  return ((openings << 1) | (openings >> 3)) & 15;
}

export function traceWater(board, openings) {
  const source = board.tiles.findIndex((tile) => tile?.type === 'source');
  const reached = new Set([source]);
  const links = Array(openings.length).fill(0);
  for (const index of reached) {
    const type = board.tiles[index].type;
    if (type === 'flower' || type === 'weed') continue;
    const row = Math.floor(index / board.columns);
    const column = index % board.columns;
    for (const { bit, opposite, dx, dy } of sides) {
      const nextColumn = column + dx;
      if (!(openings[index] & bit) || nextColumn < 0 || nextColumn >= board.columns) continue;
      const next = (row + dy) * board.columns + nextColumn;
      if (!(openings[next] & opposite)) continue;
      reached.add(next);
      links[index] |= bit;
      links[next] |= opposite;
    }
  }
  const flowers = board.tiles.reduce((count, tile) => count + (tile?.type === 'flower'), 0);
  const weeds = board.tiles.filter((tile) => tile?.type === 'weed').length;
  const watered = [...reached].filter((index) => board.tiles[index].type === 'flower').length;
  const wetWeeds = [...reached].filter((index) => board.tiles[index].type === 'weed').length;
  return {
    reached,
    links,
    watered,
    flowers,
    weeds,
    wetWeeds,
    won: watered === flowers && wetWeeds === 0,
  };
}
