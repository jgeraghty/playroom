import { createGameUI } from '../../shared/game-ui.js';
import { drawCourse } from './draw.js';
import {
  chargeMs,
  course,
  coursePar,
  courseTotals,
  createScorecard,
  holes,
  inRough,
  launch,
  pullAim,
  recordHole,
  stepBall,
  stepMs,
  strokeLimit,
  winner,
} from './rules.js';
import './style.css';

const soloRecord = 'bestMoves_meadowRunFive';
const localRecord = 'meadowRunFiveMatches';
const turns = { ArrowLeft: -5, ArrowUp: -5, ArrowRight: 5, ArrowDown: 5 };
const headings = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right'];
const directionSymbols = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];

export function mountGame({ root, options, progress = {}, saveProgress, finish }) {
  const local = options?.mode === 'local';
  const names = local ? ['Player 1', 'Player 2'] : ['You'];
  const ui = createGameUI(
    root,
    `<section class="arcade-stage golf-stage">
      <div class="stage-heading"><h2 id="golf-hole"></h2></div>
      <div class="session-hud golf-score">
        <div><span id="golf-stroke-label"></span><strong id="golf-strokes"></strong></div>
        ${names.map((name, index) => `<div><span>${local ? name : 'Course total'}</span><strong data-golf-total="${index}">0</strong></div>`).join('')}
      </div>
      <div class="golf-green">
        <canvas tabindex="0" aria-label="Mini golf green" aria-describedby="golf-keys"></canvas>
      </div>
      <p class="golf-feedback" role="status"></p>
      <div class="golf-readout" aria-label="Putt direction and power">
        <span id="golf-direction"></span><span id="golf-power"></span>
      </div>
      <span class="golf-announcement" role="status"></span>
      <p class="control-note golf-note">Press the ball, pull back, and release to putt.</p>
      <p class="control-note golf-keys" id="golf-keys">Keyboard: arrows turn. Hold Space to charge and release to putt.</p>
      <details class="golf-scorecard">
        <summary>Course scorecard</summary>
        <table>
          <thead><tr><th scope="col">Hole</th><th scope="col">Par</th>${names.map((name) => `<th scope="col">${name}</th>`).join('')}</tr></thead>
          <tbody></tbody>
          <tfoot></tfoot>
        </table>
      </details>
      <button type="button" data-golf-next hidden></button>
    </section>`,
  );

  const select = (selector) => root.querySelector(selector);
  const canvas = select('canvas');
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  canvas.width = Math.round(course.width * dpr);
  canvas.height = Math.round(course.height * dpr);
  ctx.setTransform(canvas.width / course.width, 0, 0, canvas.height / course.height, 0, 0);
  const feedback = select('.golf-feedback');
  const direction = select('#golf-direction');
  const powerLabel = select('#golf-power');
  const nextButton = select('[data-golf-next]');
  const readout = select('.golf-readout');
  const note = select('.golf-note');
  const keyHint = select('#golf-keys');
  const announcement = select('.golf-announcement');
  const scorecardPanel = select('.golf-scorecard');

  let soloBest = Number.isInteger(progress[soloRecord]) ? progress[soloRecord] : null;
  let matches = progress[localRecord] || {};
  let scorecard, player, holeIndex, strokes, aim, ball, phase, next, paused, lastFrame, elapsed;
  let shotRead, finalShot;
  let pointerPull = null;
  let charge = null;
  let keyboardFocus = false;

  function updateScore() {
    const totals = courseTotals(scorecard);
    select('#golf-stroke-label').textContent = local
      ? `${names[player]}’s strokes`
      : 'Hole strokes';
    select('#golf-strokes').textContent = `${strokes}/${strokeLimit}`;
    for (const [index, total] of totals.entries()) {
      select(`[data-golf-total="${index}"]`).textContent =
        total + (index === player && phase !== 'handoff' && phase !== 'finished' ? strokes : 0);
    }
    scorecardPanel.querySelector('tbody').innerHTML = holes
      .map(
        ({ name, par }, index) =>
          `<tr><th scope="row">${name}</th><td>${par}</td>${scorecard.map((scores) => `<td>${scores[index] ?? '—'}</td>`).join('')}</tr>`,
      )
      .join('');
    scorecardPanel.querySelector('tfoot').innerHTML =
      `<tr><th scope="row">Total</th><td>${coursePar}</td>${totals.map((total) => `<td>${total}</td>`).join('')}</tr>`;
  }

  function showPhase() {
    const review = phase === 'handoff';
    readout.hidden = review || phase === 'finished';
    note.hidden = readout.hidden || keyboardFocus;
    keyHint.hidden = readout.hidden || !keyboardFocus;
    nextButton.hidden = !review;
  }

  function openHole() {
    const hole = holes[holeIndex];
    ball = { ...hole.tee, vx: 0, vy: 0 };
    aim = { angle: 0, power: 0 };
    strokes = 0;
    phase = 'aiming';
    select('#golf-hole').textContent =
      `${holeIndex + 1}/${holes.length} · ${hole.name} · Par ${hole.par}`;
    scorecardPanel.open = false;
    showPhase();
    updateScore();
    renderAim();
    feedback.textContent = local ? `${names[player]}’s turn. ${hole.tip}` : hole.tip;
  }

  function renderAim() {
    const headingIndex = Math.round(aim.angle / 45) % headings.length;
    direction.textContent = `${directionSymbols[headingIndex]} ${Math.round(aim.angle) % 360}°`;
    direction.setAttribute(
      'aria-label',
      `${headings[headingIndex]}, ${Math.round(aim.angle) % 360} degrees`,
    );
    powerLabel.textContent = `Power ${Math.round(aim.power)}%`;
    const hole = holes[holeIndex];
    drawCourse(ctx, hole, ball, phase, aim);
    const dx = hole.cup.x - ball.x;
    const dy = hole.cup.y - ball.y;
    const cupHeading = Math.round(Math.atan2(dy, dx) / (Math.PI / 4) + 8) % headings.length;
    const distance = Math.round(Math.hypot(dx, dy) / 10);
    canvas.setAttribute(
      'aria-label',
      `${hole.name}. The cup is ${distance} green units ${headings[cupHeading]}. ${inRough(ball, hole) ? 'Ball in rough. ' : ''}${hole.tip}`,
    );
  }

  function finishCourse(shot) {
    phase = 'finished';
    updateScore();
    showPhase();
    drawCourse(ctx, holes[holeIndex], ball, phase, aim);
    const totals = courseTotals(scorecard);
    let title = 'Course complete!';
    let message = `You finished in ${totals[0]} strokes.`;
    let outcome = 'complete';
    if (local) {
      const winningPlayer = winner(totals);
      const tie = winningPlayer === null;
      outcome = tie ? 'draw' : 'win';
      title = tie ? 'It’s a tie!' : `${names[winningPlayer]} wins!`;
      message = tie
        ? `Both players finished in ${totals[0]} strokes.`
        : `${names[winningPlayer]} had the lower course total.`;
      matches = {
        played: (matches.played || 0) + 1,
        ties: (matches.ties || 0) + Number(tie),
        playerOneWins: (matches.playerOneWins || 0) + Number(winningPlayer === 0),
        playerTwoWins: (matches.playerTwoWins || 0) + Number(winningPlayer === 1),
        lastTotals: totals,
      };
      saveProgress({ [localRecord]: matches });
    } else if (soloBest === null || totals[0] < soloBest) {
      soloBest = totals[0];
      saveProgress({ [soloRecord]: soloBest });
      title = 'New personal best!';
    }
    if (shot !== 'sunk') {
      const name = names[player];
      const limit = `${name} reached the six-stroke limit on ${holes[holeIndex].name}.`;
      feedback.textContent = limit;
      message = `${message} ${limit}`;
    }
    finish({
      title,
      message,
      outcome,
      stats: [
        ...holes.map(({ name }, index) => [
          name,
          scorecard.map((scores) => scores[index]).join(' / '),
        ]),
        ...names.map((name, index) => [local ? `${name} total` : 'Course total', totals[index]]),
        ['Course par', coursePar],
        ...(local ? [] : [['Best solo total', soloBest]]),
      ],
    });
  }

  function settle(shot) {
    if (shot === 'stopped' && strokes < strokeLimit) {
      phase = 'aiming';
      showPhase();
      renderAim();
      const distance = Math.round(
        Math.hypot(ball.x - holes[holeIndex].cup.x, ball.y - holes[holeIndex].cup.y) / 10,
      );
      const read = inRough(ball, holes[holeIndex])
        ? 'Ball in rough. It will roll a shorter distance here.'
        : shotRead.rough
          ? 'The rough slowed that putt.'
          : shotRead.bank
            ? 'That putt banked off a wall.'
            : 'The ball stopped on the green.';
      feedback.textContent = `${read} About ${distance} green ${distance === 1 ? 'unit' : 'units'} to the cup.`;
      return;
    }
    next = recordHole(scorecard, player, strokes);
    finalShot = shot;
    phase = 'handoff';
    const par = holes[holeIndex].par;
    const relative = strokes === par ? 'on par' : strokes < par ? 'under par' : 'over par';
    const result =
      shot === 'sunk'
        ? `${local ? names[player] : 'You'} sunk it in ${strokes} ${strokes === 1 ? 'stroke' : 'strokes'}, ${relative}.`
        : `Stroke limit reached. ${strokeLimit} strokes added${local ? ` for ${names[player]}` : ''}.`;
    feedback.textContent =
      local && !next.finished ? `${result} Pass to ${names[next.player]}.` : result;
    nextButton.textContent = next.finished
      ? 'Finish course'
      : local
        ? `Start ${names[next.player]}’s turn`
        : 'Next hole';
    updateScore();
    showPhase();
    drawCourse(ctx, holes[holeIndex], ball, phase, aim);
    scorecardPanel.open = true;
    scorecardPanel.querySelector('summary').focus();
  }

  function frame(now) {
    if (lastFrame !== null) elapsed += Math.min(50, now - lastFrame);
    lastFrame = now;
    while (elapsed >= stepMs) {
      elapsed -= stepMs;
      const { vx, vy } = ball;
      const shot = stepBall(ball, holes[holeIndex]);
      shotRead.bank ||= vx * ball.vx < 0 || vy * ball.vy < 0;
      shotRead.rough ||= inRough(ball, holes[holeIndex]);
      if (shot !== 'moving') {
        drawCourse(ctx, holes[holeIndex], ball, phase, aim);
        settle(shot);
        return;
      }
    }
    drawCourse(ctx, holes[holeIndex], ball, phase, aim);
    ui.scheduler.frame(frame);
  }

  function putt() {
    if (paused || phase !== 'aiming') return;
    phase = 'rolling';
    strokes++;
    shotRead = { rough: inRough(ball, holes[holeIndex]), bank: false };
    ball = launch(ball, aim.angle, aim.power);
    aim = { angle: aim.angle, power: 0 };
    powerLabel.textContent = 'Ball rolling';
    lastFrame = null;
    elapsed = 0;
    showPhase();
    updateScore();
    drawCourse(ctx, holes[holeIndex], ball, phase, aim);
    feedback.textContent = 'Ball rolling.';
    ui.scheduler.frame(frame);
  }

  function releaseCapture(id) {
    if (canvas.hasPointerCapture?.(id)) canvas.releasePointerCapture(id);
  }

  function cancelInput() {
    if (!pointerPull && !charge) return;
    const pending = pointerPull;
    pointerPull = null;
    if (pending) releaseCapture(pending.id);
    if (charge) ui.scheduler.cancelFrame(charge.job);
    charge = null;
    announcement.textContent = '';
    aim = { angle: aim.angle, power: 0 };
    if (phase === 'aiming') renderAim();
  }

  function pointOnGreen(event) {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return null;
    return {
      x: ((event.clientX - bounds.left) * course.width) / bounds.width,
      y: ((event.clientY - bounds.top) * course.height) / bounds.height,
      grabRadius: Math.max(25, (23 * course.width) / bounds.width),
    };
  }

  function updatePull(event) {
    if (!pointerPull || event.pointerId !== pointerPull.id) return;
    const point = pointOnGreen(event);
    const pulled = point && pullAim(pointerPull.origin, point);
    aim = pulled || { angle: pointerPull.initialAngle, power: 0 };
    renderAim();
  }

  function chargeFrame(now) {
    if (!charge) return;
    aim.power = Math.min(100, 5 * Math.floor(Math.max(0, now - charge.started) / (chargeMs / 20)));
    const milestone = 25 * Math.floor(aim.power / 25);
    if (milestone > charge.milestone) {
      announcement.textContent = `Power ${milestone} percent`;
      charge.milestone = milestone;
    }
    renderAim();
    if (aim.power < 100) charge.job = ui.scheduler.frame(chargeFrame);
  }

  function handleKey(event) {
    if (event.key === 'Escape') {
      cancelInput();
      return;
    }
    const turn = Object.hasOwn(turns, event.key) ? turns[event.key] : 0;
    const space = event.code === 'Space' || event.key === ' ';
    if ((!turn && !space) || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    if (paused || phase !== 'aiming' || pointerPull) return;
    keyboardFocus = true;
    showPhase();
    if (turn) {
      aim.angle = (aim.angle + turn + 360) % 360;
      renderAim();
      if (!event.repeat) announcement.textContent = direction.getAttribute('aria-label');
    } else {
      if (event.repeat || charge) return;
      announcement.textContent = 'Charging';
      charge = { started: performance.now(), job: ui.scheduler.frame(chargeFrame), milestone: 0 };
    }
  }

  function start() {
    cancelInput();
    ui.scheduler.clear();
    ui.scheduler.resume();
    paused = false;
    scorecard = createScorecard(names.length);
    player = 0;
    holeIndex = 0;
    openHole();
  }

  ui.on('canvas', 'focus', () => {
    keyboardFocus = canvas.matches(':focus-visible');
    showPhase();
  });
  ui.on('canvas', 'blur', () => {
    keyboardFocus = false;
    cancelInput();
    showPhase();
  });
  ui.on('canvas', 'pointerdown', (event) => {
    if (
      paused ||
      phase !== 'aiming' ||
      charge ||
      pointerPull ||
      event.button !== 0 ||
      event.isPrimary === false
    )
      return;
    const origin = pointOnGreen(event);
    if (!origin || Math.hypot(origin.x - ball.x, origin.y - ball.y) > origin.grabRadius) return;
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    keyboardFocus = false;
    showPhase();
    pointerPull = { id: event.pointerId, origin, initialAngle: aim.angle };
    canvas.setPointerCapture?.(event.pointerId);
  });
  ui.on('canvas', 'pointermove', updatePull);
  ui.on('canvas', 'pointerup', (event) => {
    if (!pointerPull || event.pointerId !== pointerPull.id) return;
    updatePull(event);
    pointerPull = null;
    releaseCapture(event.pointerId);
    if (aim.power) putt();
  });
  for (const type of ['pointercancel', 'lostpointercapture']) {
    ui.on('canvas', type, (event) => {
      if (event.pointerId === pointerPull?.id) cancelInput();
    });
  }
  ui.on('canvas', 'keydown', handleKey);
  ui.on('canvas', 'keyup', (event) => {
    if (!charge || (event.code !== 'Space' && event.key !== ' ')) return;
    event.preventDefault();
    ui.scheduler.cancelFrame(charge.job);
    charge = null;
    announcement.textContent = '';
    aim.power = Math.max(5, aim.power);
    putt();
  });

  ui.on('[data-golf-next]', 'click', () => {
    if (paused || phase !== 'handoff') return;
    if (next.finished) {
      finishCourse(finalShot);
      return;
    }
    player = next.player;
    holeIndex = next.hole;
    openHole();
    canvas.focus({ preventScroll: true });
  });
  const onVisibilityChange = () => {
    if (document.hidden) cancelInput();
  };
  window.addEventListener('blur', cancelInput);
  document.addEventListener('visibilitychange', onVisibilityChange);
  ui.onDispose(() => {
    cancelInput();
    window.removeEventListener('blur', cancelInput);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  });

  start();
  return {
    pause() {
      cancelInput();
      paused = true;
      lastFrame = null;
      ui.scheduler.pause();
    },
    resume() {
      if (!paused) return;
      paused = false;
      ui.scheduler.resume();
    },
    restart: start,
    destroy: () => ui.destroy(),
  };
}
