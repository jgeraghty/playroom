export const preview =
  '<div class="preview preview-court" aria-hidden="true"><span>⛳</span><span>●</span><span>↗</span></div>';

export const miniGolfEntry = {
  id: 'mini-golf',
  title: 'Mini Golf',
  startLabel: 'Tee off',
  replayLabel: 'Play this course again',
  category: 'Classic',
  icon: '⛳',
  description:
    'Choose a shortcut or play a safer line on a five-hole course. Play solo or with a friend.',
  capabilities: ['twoPlayers', 'noTimer'],
  showLevel: false,
  background: 'linear-gradient(135deg,#d6f5c3,#9dddbb)',
  preview,
  setup: {
    key: 'mode',
    label: 'Choose who’s playing',
    tip: 'Press the ball, pull back, and release to putt. On a keyboard, use the arrows to aim and hold Space to charge, then release. You have six strokes per hole. The lowest total wins.',
    choices: [
      { value: 'solo', label: 'Solo', detail: 'Play five holes and try to beat your best' },
      {
        value: 'local',
        label: 'Two players',
        detail: 'Finish each hole before passing the device',
      },
    ],
  },
  load: () => import('./index.js'),
};
