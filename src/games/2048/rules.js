export function moveBoard(board, direction) {
  const next = board.map((row) => row.slice());
  let gained = 0;
  const merged = [];
  if (!['left', 'right', 'up', 'down'].includes(direction))
    return { board: next, gained, merged, changed: false };
  for (let line = 0; line < 4; line++) {
    const coords = Array.from({ length: 4 }, (_, i) =>
      direction === 'left'
        ? [line, i]
        : direction === 'right'
          ? [line, 3 - i]
          : direction === 'up'
            ? [i, line]
            : [3 - i, line],
    );
    const values = coords.map(([r, c]) => board[r][c]).filter(Boolean),
      out = [];
    for (let i = 0; i < values.length; i++) {
      let value = values[i];
      if (value === values[i + 1]) {
        value *= 2;
        gained += value;
        i++;
        merged.push(coords[out.length][0] * 4 + coords[out.length][1]);
      }
      out.push(value);
    }
    coords.forEach(([r, c], i) => {
      next[r][c] = out[i] || 0;
    });
  }
  return {
    board: next,
    gained,
    merged,
    changed: next.some((row, r) => row.some((v, c) => v !== board[r][c])),
  };
}
export function canMove(board) {
  return board.some((row, r) =>
    row.some((v, c) => !v || (c < 3 && v === row[c + 1]) || (r < 3 && v === board[r + 1][c])),
  );
}
