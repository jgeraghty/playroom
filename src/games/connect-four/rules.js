export function landingRow(board, col) {
  for (let row = 5; row >= 0; row--) if (!board[row][col]) return row;
  return -1;
}
export function winningCells(board, row, col, player) {
  for (const [dy, dx] of [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ]) {
    const cells = [[row, col]];
    for (const direction of [-1, 1]) {
      let y = row + dy * direction,
        x = col + dx * direction;
      while (y >= 0 && y < 6 && x >= 0 && x < 7 && board[y][x] === player) {
        cells.push([y, x]);
        y += dy * direction;
        x += dx * direction;
      }
    }
    if (cells.length >= 4) return cells;
  }
  return [];
}
export function chooseColumn(board, smart, random = Math.random) {
  const cols = [3, 2, 4, 1, 5, 0, 6].filter((c) => landingRow(board, c) >= 0);
  if (!smart) return cols[Math.floor(random() * cols.length)];
  const wins = (c, p) => {
    const r = landingRow(board, c);
    if (r < 0) return false;
    board[r][c] = p;
    const won = winningCells(board, r, c, p).length > 0;
    board[r][c] = 0;
    return won;
  };
  for (const player of [2, 1]) {
    const choice = cols.find((c) => wins(c, player));
    if (choice !== undefined) return choice;
  }
  // Prefer central columns that do not give away an immediate win.
  return (
    cols.find((c) => {
      const r = landingRow(board, c);
      board[r][c] = 2;
      const unsafe = cols.some((next) => wins(next, 1));
      board[r][c] = 0;
      return !unsafe;
    }) ?? cols[0]
  );
}
