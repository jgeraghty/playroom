const previews = {
  'memory-match': ['grid', '✦', '?', '?', '✦'],
  'tic-tac-toe': ['grid', '×', '○', '○', '×'],
  'number-guess': ['line', '↑', '42', '↓'],
  'rock-paper-scissors': ['line', '✊', '✋', '✌️'],
  'quick-math': ['line', '6', '+', '3'],
  'reaction-time': ['signal', 'GO!'],
  'word-scramble': ['line', 'A', 'T', 'C'],
  'color-clicker': ['grid', '●', '◆', '★', '▲'],
  snake: ['snake', '■', '■', '■', '●'],
  'whack-a-mole': ['grid', '◒', '🐹', '◒', '◒'],
  2048: ['grid', '2', '4', '8', '16'],
  'simon-says': ['grid', '●', '▲', '★', '◆'],
  pong: ['court', '▮', '●', '▮'],
  'connect-four': ['grid', '●', '○', '○', '●'],
};

export function gamePreview(game) {
  if (game.preview) return game.preview;
  const [type, ...tiles] = previews[game.id] || ['signal', game.icon];
  return `<div class="preview preview-${type}" aria-hidden="true">${tiles.map((tile) => `<span>${tile}</span>`).join('')}</div>`;
}
