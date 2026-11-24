import { createGameUI } from '../../shared/game-ui.js';

const pads = [
  { name: 'Green circle', shape: '●', tone: 'green', pitch: 261.6 },
  { name: 'Red triangle', shape: '▲', tone: 'red', pitch: 329.6 },
  { name: 'Yellow star', shape: '★', tone: 'yellow', pitch: 392 },
  { name: 'Blue diamond', shape: '◆', tone: 'blue', pitch: 523.3 },
];
const roundBreak = 700;

export function mountGame({ root, options, progress, finish, saveProgress }) {
  const ui = createGameUI(root, '');
  const pace = options?.pace === 'steady' ? 'steady' : 'gentle';
  const beat = pace === 'steady' ? 700 : 1100;
  const recordKey = `bestSequence_${pace}`;
  let best = progress[recordKey] || 0;
  let startingBest;
  let soundEnabled = progress.soundEnabled === true;
  let audioContext;
  let activeTone;
  let phase, sequence, input, completed, unassisted, assisted, paused;
  let buttons, feedback, count, bestValue, replay, sound, clearFlash;

  function start() {
    ui.scheduler.clear();
    ui.scheduler.resume();
    stopTone();
    paused = false;
    startingBest = best;
    sequence = [Math.floor(Math.random() * pads.length)];
    input = completed = unassisted = 0;
    assisted = false;
    ui.render(`
      <section class="arcade-stage quick-stage simon-stage">
        <div class="stage-heading"><h2>Repeat the pattern</h2><span class="mode-chip">${pace}</span></div>
        <div class="session-hud">
          <div><span>Pattern length</span><strong id="simon-length">1</strong></div>
          <div><span>Best without replay</span><strong id="simon-best">${best || '—'}</strong></div>
        </div>
        <p class="quick-feedback" id="simon-state" role="status">Watch the pattern.</p>
        <div class="quick-pad-grid" role="group" aria-label="Pattern pads">
          ${pads.map(({ name, shape, tone }, i) => `<button type="button" data-pad="${i}" data-tone="${tone}" aria-disabled="true"><span aria-hidden="true">${shape}</span>${name}</button>`).join('')}
        </div>
        <p class="simon-count" id="simon-count">Watch first</p>
        <div class="quick-actions">
          <button type="button" class="soft" id="simon-replay" aria-disabled="true">Replay pattern</button>
          <button type="button" class="soft" id="simon-sound" aria-pressed="${soundEnabled}">Sound</button>
        </div>
        <p class="control-note">Replaying lets you practice. Patterns from that point don’t count toward your unaided best.</p>
      </section>`);

    buttons = [...root.querySelectorAll('[data-pad]')];
    feedback = root.querySelector('#simon-state');
    count = root.querySelector('#simon-count');
    bestValue = root.querySelector('#simon-best');
    replay = root.querySelector('#simon-replay');
    sound = root.querySelector('#simon-sound');

    ui.on('[data-pad]', 'click', (event) => hit(Number(event.currentTarget.dataset.pad)));
    ui.on('#simon-replay', 'click', () => {
      if (paused || phase !== 'input') return;
      assisted = true;
      playPattern('Practice replay. Watch again.');
    });
    ui.on('#simon-sound', 'click', () => {
      if (paused || phase === 'ended') return;
      soundEnabled = !soundEnabled;
      if (soundEnabled && !prepareAudio()) {
        soundEnabled = false;
        sound.disabled = true;
        sound.textContent = 'Sound unavailable';
      } else if (!soundEnabled) stopTone();
      sound.setAttribute('aria-pressed', String(soundEnabled));
      saveProgress({ soundEnabled });
    });

    if (soundEnabled) prepareAudio();
    playPattern();
  }

  function prepareAudio() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return false;
    try {
      audioContext ||= new Audio();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  function stopTone() {
    if (!activeTone) return;
    activeTone.stop();
    activeTone = null;
  }

  function clearPads() {
    ui.scheduler.clearTimeout(clearFlash);
    for (const button of buttons) delete button.dataset.lit;
  }

  function flash(index, duration) {
    clearPads();
    buttons[index].dataset.lit = 'true';
    clearFlash = ui.scheduler.timeout(clearPads, duration);
    if (!soundEnabled || !prepareAudio() || audioContext.state !== 'running') return;
    stopTone();
    const oscillator = audioContext.createOscillator();
    const volume = audioContext.createGain();
    const now = audioContext.currentTime;
    oscillator.frequency.value = pads[index].pitch;
    volume.gain.setValueAtTime(0.12, now);
    volume.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    oscillator.connect(volume).connect(audioContext.destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      volume.disconnect();
      if (activeTone === oscillator) activeTone = null;
    };
    activeTone = oscillator;
    oscillator.start(now);
    oscillator.stop(now + 0.22);
  }

  function setControls(enabled) {
    for (const button of [...buttons, replay])
      button.setAttribute('aria-disabled', String(!enabled));
  }

  function playPattern(message = 'Watch the pattern.') {
    phase = 'watch';
    input = 0;
    ui.scheduler.clear();
    clearPads();
    setControls(false);
    feedback.textContent = message;
    count.textContent = assisted ? 'Practice · watch first' : 'Watch first';
    root.querySelector('#simon-length').textContent = sequence.length;
    const lead = 650;
    sequence.forEach((index, step) => {
      ui.scheduler.timeout(
        () => {
          feedback.textContent = `Watch ${step + 1} of ${sequence.length}: ${pads[index].name}.`;
          flash(index, Math.round(beat * 0.7));
        },
        lead + step * beat,
      );
    });
    ui.scheduler.timeout(
      () => {
        phase = 'input';
        setControls(true);
        count.textContent = `0 of ${sequence.length} matched`;
        feedback.textContent = 'Your turn. Repeat the pattern.';
      },
      lead + sequence.length * beat,
    );
  }

  function hit(index) {
    if (paused || phase !== 'input') return;
    const expected = sequence[input];
    if (index !== expected) {
      end(expected);
      return;
    }
    flash(index, 180);
    input++;
    count.textContent = `${input} of ${sequence.length} matched`;
    if (input < sequence.length) {
      feedback.textContent = `Matched ${input} of ${sequence.length}. Keep going.`;
      return;
    }

    completed++;
    if (!assisted) {
      unassisted = completed;
      if (unassisted > best) {
        best = unassisted;
        saveProgress({ [recordKey]: best });
        bestValue.textContent = best;
      }
    }
    phase = 'between';
    setControls(false);
    feedback.textContent = 'Pattern matched! Adding one more step…';
    ui.scheduler.timeout(() => {
      sequence.push(Math.floor(Math.random() * pads.length));
      playPattern();
    }, roundBreak);
  }

  function end(expected) {
    phase = 'ended';
    ui.scheduler.clear();
    clearPads();
    stopTone();
    finish({
      title: unassisted > startingBest ? 'New personal best!' : 'Pattern ended',
      message: `The next pad was ${pads[expected].name.toLowerCase()}.`,
      outcome: 'loss',
      score: completed,
      stats: [
        ['Longest matched', completed],
        ['Without replay', unassisted],
        ['Best without replay', best],
      ],
    });
  }

  ui.onDispose(() => {
    stopTone();
    if (audioContext && audioContext.state !== 'closed') audioContext.close().catch(() => {});
  });
  start();
  return {
    pause: () => {
      paused = true;
      stopTone();
      clearPads();
      ui.scheduler.pause();
    },
    resume: () => {
      if (!paused) return;
      paused = false;
      if (phase === 'watch') playPattern('Pattern restarted. Watch again.');
      ui.scheduler.resume();
    },
    restart: start,
    destroy: () => ui.destroy(),
  };
}
