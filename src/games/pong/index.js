import { createGameUI } from '../../shared/game-ui.js';
import {
  advanceBall,
  approach,
  clampPaddle,
  court,
  modes,
  serveBall,
  stepSeconds,
} from './rules.js';

const goal = 5;
const playerSpeed = 360;
const stepMs = stepSeconds * 1000;
const keyDirections = { arrowup: -1, w: -1, arrowdown: 1, s: 1 };

export function mountGame({ root, options, finish, progress, saveProgress }) {
  const ui = createGameUI(root, '');
  const difficulty = options?.difficulty === 'normal' ? 'normal' : 'easy';
  const mode = modes[difficulty];
  const recordKey = `wins_${difficulty}`;
  let wins = progress[recordKey] || 0;
  const keys = new Set();
  const holds = new Map();
  let canvas, ctx, notice, feedback, playerScore, computerScore;
  let player, opponent, ball, score, phase, paused, pointer, dragTarget, lastFrame, elapsed;
  let serveDirection;

  function draw() {
    const { width, height, radius, inset, paddleWidth } = court;
    ctx.fillStyle = '#162b46';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#1b3451';
    ctx.fillRect(0, 0, width / 2, height);
    ctx.strokeStyle = '#7097b488';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#98f2de';
    ctx.fillRect(inset, player - mode.playerSize / 2, paddleWidth, mode.playerSize);
    ctx.fillStyle = '#ffcf93';
    ctx.fillRect(
      width - inset - paddleWidth,
      opponent - mode.opponentSize / 2,
      paddleWidth,
      mode.opponentSize,
    );
    ctx.fillStyle = '#fff6d5';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function countdown(resuming = false) {
    phase = 'ready';
    notice.hidden = false;
    const label = resuming ? 'Rally resumes' : 'Next serve';
    const show = (count) => {
      notice.querySelector('strong').textContent = count;
      notice.querySelector('span').textContent = label;
    };
    if (resuming) feedback.textContent = 'Rally resumes after the countdown.';
    show(3);
    ui.scheduler.timeout(() => show(2), 700);
    ui.scheduler.timeout(() => show(1), 1400);
    ui.scheduler.timeout(() => {
      notice.hidden = true;
      feedback.textContent = 'Ball in play.';
      phase = 'rally';
      lastFrame = null;
      elapsed = 0;
    }, 2100);
  }

  function clearInput() {
    const captured = [...holds].map(([id, { button }]) => [button, id]);
    if (pointer !== null && canvas) captured.push([canvas, pointer]);
    holds.clear();
    keys.clear();
    pointer = dragTarget = null;
    for (const [element, id] of captured) {
      if (element.hasPointerCapture?.(id)) element.releasePointerCapture(id);
    }
  }

  function point(side) {
    score[side]++;
    playerScore.textContent = score.player;
    computerScore.textContent = score.computer;
    feedback.textContent = `${side === 'player' ? 'Your point!' : 'Computer scores.'} You ${score.player}, computer ${score.computer}.`;

    if (score[side] === goal) {
      phase = 'final';
      clearInput();
      ui.scheduler.timeout(() => {
        phase = 'ended';
        const won = side === 'player';
        if (won) {
          wins++;
          saveProgress({ [recordKey]: wins });
        }
        finish({
          title: won ? 'You win the match!' : 'Computer wins the match',
          message: `Final score: you ${score.player}, computer ${score.computer}.`,
          score: score.player,
          outcome: won ? 'win' : 'loss',
          stats: [
            ['Your points', score.player],
            ['Computer points', score.computer],
            ['Wins in this mode', wins],
          ],
        });
      }, 850);
      return;
    }

    serveDirection *= -1;
    ball = serveBall(serveDirection, mode);
    countdown();
  }

  function step() {
    if (phase !== 'ready' && phase !== 'rally') return;

    let movement = 0;
    for (const key of keys) movement += keyDirections[key];
    for (const { direction } of holds.values()) movement += direction;
    const direction = Math.sign(movement);
    if (direction) {
      dragTarget = null;
      player = clampPaddle(player + direction * playerSpeed * stepSeconds, mode.playerSize);
    } else if (dragTarget !== null) {
      player = approach(player, dragTarget, 1350 * stepSeconds);
    }

    if (phase !== 'rally') return;
    const tracking = ball.vx > 0 && ball.x > mode.trackingStart;
    const target = tracking ? ball.y + serveDirection * mode.aimOffset : court.height / 2;
    opponent = clampPaddle(
      approach(opponent, target, mode.opponentSpeed * stepSeconds),
      mode.opponentSize,
    );
    const scorer = advanceBall(ball, player, opponent, mode);
    if (scorer) point(scorer);
  }

  function frame(now) {
    if (lastFrame !== null) elapsed += Math.min(50, now - lastFrame);
    lastFrame = now;
    while (elapsed >= stepMs) {
      step();
      elapsed -= stepMs;
    }
    draw();
    if (phase !== 'final' && phase !== 'ended') ui.scheduler.frame(frame);
  }

  function canMove() {
    return !paused && (phase === 'ready' || phase === 'rally');
  }

  function moveTo(event) {
    const bounds = canvas.getBoundingClientRect();
    if (bounds.height)
      dragTarget = clampPaddle(
        ((event.clientY - bounds.top) * court.height) / bounds.height,
        mode.playerSize,
      );
  }

  function holdKey(event) {
    const key = event.key.toLowerCase();
    if (
      !Object.hasOwn(keyDirections, key) ||
      !canMove() ||
      !root.contains(event.target) ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    event.preventDefault();
    if (!event.repeat) keys.add(key);
  }

  function releaseKey(event) {
    keys.delete(event.key.toLowerCase());
  }

  function start() {
    ui.scheduler.clear();
    ui.scheduler.resume();
    clearInput();
    paused = false;
    score = { player: 0, computer: 0 };
    player = opponent = court.height / 2;
    serveDirection = 1;
    ball = serveBall(serveDirection, mode);
    lastFrame = null;
    elapsed = 0;
    ui.render(`
      <section class="arcade-stage pong-stage">
        <div class="stage-heading"><h2>First to five</h2></div>
        <div class="session-hud">
          <div><span>You</span><strong id="pong-player">0</strong></div>
          <div><span>Computer</span><strong id="pong-computer">0</strong></div>
        </div>
        <p class="pong-feedback" id="pong-feedback" role="status">You’re on the left. Get ready for the serve.</p>
        <div class="pong-court">
          <canvas role="img" aria-label="Pong court. Your paddle is on the left."></canvas>
          <div class="pong-countdown" aria-hidden="true" hidden><span></span><strong></strong></div>
        </div>
        <div class="pong-controls" role="group" aria-label="Paddle controls">
          <button type="button" class="soft" data-pong-direction="-1"><span aria-hidden="true">↑</span> Move up</button>
          <button type="button" class="soft" data-pong-direction="1"><span aria-hidden="true">↓</span> Move down</button>
        </div>
        <p class="control-note">Drag on the court or hold the controls. Keyboard: ↑ / ↓ or W / S.</p>
      </section>`);
    canvas = root.querySelector('.pong-court canvas');
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.round(court.width * dpr);
    canvas.height = Math.round(court.height * dpr);
    ctx = canvas.getContext('2d');
    ctx.setTransform(canvas.width / court.width, 0, 0, canvas.height / court.height, 0, 0);
    notice = root.querySelector('.pong-countdown');
    feedback = root.querySelector('#pong-feedback');
    playerScore = root.querySelector('#pong-player');
    computerScore = root.querySelector('#pong-computer');

    ui.on('canvas', 'pointerdown', (event) => {
      if (!canMove() || event.button !== 0 || pointer !== null) return;
      pointer = event.pointerId;
      canvas.setPointerCapture?.(pointer);
      moveTo(event);
    });
    ui.on('canvas', 'pointermove', (event) => {
      if (event.pointerId === pointer && canMove()) moveTo(event);
    });
    ui.on('[data-pong-direction]', 'pointerdown', (event) => {
      if (!canMove() || event.button !== 0) return;
      const button = event.currentTarget;
      const direction = Number(button.dataset.pongDirection);
      holds.set(event.pointerId, { button, direction });
      button.setPointerCapture?.(event.pointerId);
      nudge(direction);
    });
    ui.on('[data-pong-direction]', 'click', (event) => {
      if (canMove() && event.detail === 0) nudge(Number(event.currentTarget.dataset.pongDirection));
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      ui.on('canvas, [data-pong-direction]', type, (event) => {
        holds.delete(event.pointerId);
        if (event.pointerId === pointer) {
          pointer = null;
          if (type === 'pointercancel') dragTarget = null;
        }
      });
    }

    draw();
    countdown();
    ui.scheduler.frame(frame);
  }

  function nudge(direction) {
    dragTarget = null;
    player = clampPaddle(player + direction * 18, mode.playerSize);
  }

  document.addEventListener('keydown', holdKey);
  document.addEventListener('keyup', releaseKey);
  window.addEventListener('blur', clearInput);
  ui.onDispose(() => {
    clearInput();
    document.removeEventListener('keydown', holdKey);
    document.removeEventListener('keyup', releaseKey);
    window.removeEventListener('blur', clearInput);
  });

  pointer = null;
  start();
  return {
    pause: () => {
      paused = true;
      clearInput();
      lastFrame = null;
      elapsed = 0;
      ui.scheduler.pause();
    },
    resume: () => {
      if (!paused) return;
      paused = false;
      if (phase === 'rally') countdown(true);
      ui.scheduler.resume();
    },
    restart: start,
    destroy: () => ui.destroy(),
  };
}
