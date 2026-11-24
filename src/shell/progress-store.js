const STORAGE_KEY = 'playroom-progress-v1';
export const themes = [
  { id: 'classic', label: 'Classic', rounds: 0 },
  { id: 'berry', label: 'Berry', rounds: 3 },
  { id: 'ocean', label: 'Ocean', rounds: 8 },
];

export function themeUnlocked(theme, progress) {
  return theme.rounds <= (progress.played || 0);
}
const LOWER_IS_BETTER = new Set(['bestMs', 'bestTime', 'bestMoves', 'bestGuesses']);
let unsaved = null;

function emptyProgress() {
  return { played: 0, wins: 0, best: {}, badges: [], theme: 'classic', games: {} };
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeProgress(value) {
  if (!isRecord(value)) return emptyProgress();
  const best = isRecord(value.best)
    ? Object.fromEntries(
        Object.entries(value.best).filter(([, level]) => Number.isFinite(level) && level >= 1),
      )
    : {};
  const games = isRecord(value.games) ? value.games : {};
  const badges = Array.isArray(value.badges)
    ? value.badges.filter((badge) => typeof badge === 'string')
    : [];
  const theme = themes.some((entry) => entry.id === value.theme) ? value.theme : 'classic';
  return {
    ...emptyProgress(),
    ...value,
    played: Number.isFinite(value.played) ? Math.max(0, value.played) : 0,
    wins: Number.isFinite(value.wins) ? Math.max(0, value.wins) : 0,
    best: { ...best },
    badges: [...new Set(badges)],
    theme,
    games: Object.fromEntries(
      Object.entries(games).filter(([, gameProgress]) => isRecord(gameProgress)),
    ),
  };
}

function write(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    unsaved = null;
  } catch {
    unsaved = progress;
  }
}

export function canSaveProgress() {
  if (unsaved) return false;
  try {
    const probe = `${STORAGE_KEY}-probe`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function load() {
  if (unsaved) return normalizeProgress(unsaved);
  try {
    return normalizeProgress(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return emptyProgress();
  }
}

export function saveGame(gameId, patch) {
  if (typeof gameId !== 'string' || !gameId || !isRecord(patch)) return load();
  const progress = load();
  const previous = progress.games[gameId] || {};
  const next = { ...previous };
  for (const [key, value] of Object.entries(patch)) {
    if (key.startsWith('best') && Number.isFinite(value) && Number.isFinite(previous[key])) {
      next[key] =
        LOWER_IS_BETTER.has(key) || /^best(Moves|Time|Guesses|Ms)_/.test(key)
          ? Math.min(previous[key], value)
          : Math.max(previous[key], value);
    } else {
      next[key] = value;
    }
  }
  progress.games[gameId] = next;
  write(progress);
  return progress;
}

export function recordResult({ gameId, title, outcome, level = 1, score }) {
  const progress = load();
  progress.played += 1;
  if (outcome === 'win') progress.wins += 1;
  if (typeof title === 'string' && title) {
    progress.best[title] = Math.max(progress.best[title] || 0, level);
  }
  if (gameId && Number.isFinite(score)) {
    const game = progress.games[gameId] || {};
    progress.games[gameId] = {
      ...game,
      bestScore: Math.max(game.bestScore || 0, score),
    };
  }
  if (!progress.badges.includes('First round')) progress.badges.push('First round');
  if (progress.wins >= 5 && !progress.badges.includes('Five wins')) {
    progress.badges.push('Five wins');
  }
  if (Object.keys(progress.best).length >= 5 && !progress.badges.includes('Game explorer')) {
    progress.badges.push('Game explorer');
  }
  write(progress);
  return progress;
}

export function chooseTheme(theme) {
  const progress = load();
  const entry = themes.find(({ id }) => id === theme);
  if (!entry || !themeUnlocked(entry, progress)) return progress;
  progress.theme = theme;
  write(progress);
  return progress;
}

export function dailyGameId(gameIds, now = new Date()) {
  if (!Array.isArray(gameIds) || gameIds.length === 0) return null;
  const dateKey = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  return gameIds[dateKey % gameIds.length];
}

export function reset() {
  const cleared = emptyProgress();
  try {
    localStorage.removeItem(STORAGE_KEY);
    unsaved = null;
  } catch {
    unsaved = cleared;
  }
  return cleared;
}
