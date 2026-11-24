export const lines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];
export function winningLine(board, mark) {
  return lines.find((line) => line.every((i) => board[i] === mark));
}
export function bestMove(board, mark = 'O') {
  const other = mark === 'O' ? 'X' : 'O';
  function evaluate(turn) {
    if (winningLine(board, mark)) return 1;
    if (winningLine(board, other)) return -1;
    const free = board.map((v, i) => (v ? null : i)).filter((i) => i !== null);
    if (!free.length) return 0;
    const scores = free.map((i) => {
      board[i] = turn;
      const score = evaluate(turn === mark ? other : mark);
      board[i] = '';
      return score;
    });
    return turn === mark ? Math.max(...scores) : Math.min(...scores);
  }
  let best = -Infinity,
    choice;
  for (const i of [4, 0, 2, 6, 8, 1, 3, 5, 7]) {
    if (board[i]) continue;
    board[i] = mark;
    const score = evaluate(other);
    board[i] = '';
    if (score > best) {
      best = score;
      choice = i;
    }
  }
  return choice;
}
