export const gardenPathsPreview =
  '<div class="preview preview-line" aria-hidden="true"><span>💧</span><span>┐</span><span>✿</span></div>';

export const gardenPathsEntry = {
  id: 'garden-paths',
  title: 'Garden Paths',
  category: 'Puzzle',
  icon: '🌷',
  description: 'Turn paths to water every flower. A new garden appears after each solve.',
  background: 'linear-gradient(135deg,#e9f3c6,#aee0ca)',
  capabilities: ['noTimer'],
  preview: gardenPathsPreview,
  showLevel: false,
  startLabel: 'Start gardening',
  load: () => import('./index.js'),
};
