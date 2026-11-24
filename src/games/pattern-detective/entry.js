export const preview =
  '<div class="preview preview-line" aria-hidden="true"><span>●</span><span>▲</span><span>?</span></div>';

export const patternDetectiveEntry = {
  id: 'pattern-detective',
  title: 'Pattern Detective',
  category: 'Puzzle',
  icon: '🔍',
  description:
    'Fill gaps, repair patterns, and predict what comes next. Keep your streak going until the first missed answer.',
  background: 'linear-gradient(135deg,#e6defa,#cdebe3)',
  startLabel: 'Start investigation',
  replayLabel: 'Start a new investigation',
  showLevel: false,
  capabilities: ['noTimer'],
  preview,
  load: () => import('./index.js'),
};
