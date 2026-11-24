export const course = { width: 360, height: 212, rail: 12, ballRadius: 5, cupRadius: 11 };
export const strokeLimit = 6;
export const stepMs = 1000 / 120;
export const chargeMs = 1600;
const drag = 135;
const roughDrag = 330;
const rebound = 0.84;
const captureSpeed = 120;

export const holes = [
  {
    name: 'The Meadow',
    par: 2,
    tip: 'Power through the rough for a chance at one stroke, or take the clear lane along the bottom.',
    tee: { x: 69, y: 108 },
    cup: { x: 285, y: 108 },
    walls: [],
    rough: [{ x: 129, y: 78, width: 79, height: 61 }],
  },
  {
    name: 'Dogleg',
    par: 3,
    tip: 'Set up your approach by rolling right past the island. The rough beyond the turn helps catch an overshot.',
    tee: { x: 64, y: 166 },
    cup: { x: 285, y: 65 },
    walls: [{ x: 12, y: 12, width: 214, height: 114 }],
    rough: [{ x: 303, y: 142, width: 45, height: 58 }],
  },
  {
    name: 'The Bank',
    par: 2,
    tip: 'Try a one-shot bank off the bottom rail, or roll around the island in two. The upper lane has rough.',
    tee: { x: 74, y: 125 },
    cup: { x: 286, y: 125 },
    walls: [{ x: 145, y: 61, width: 70, height: 82 }],
    rough: [{ x: 114, y: 12, width: 129, height: 47 }],
  },
  {
    name: 'Switchback',
    par: 3,
    tip: 'Quick turf carries farther. Play down, up then right through alternating walls, or try a double bank.',
    tee: { x: 54, y: 64 },
    cup: { x: 302, y: 130 },
    walls: [
      { x: 114, y: 12, width: 40, height: 88 },
      { x: 201, y: 104, width: 43, height: 96 },
    ],
    rough: [],
    fast: true,
  },
  {
    name: 'The Needle',
    par: 3,
    tip: 'Thread the narrow opening between the islands for a direct shot, or take the wide lane below.',
    tee: { x: 62, y: 136 },
    cup: { x: 298, y: 94 },
    walls: [
      { x: 155, y: 47, width: 53, height: 48 },
      { x: 155, y: 126, width: 53, height: 44 },
    ],
    rough: [{ x: 142, y: 12, width: 83, height: 33 }],
  },
];

export const coursePar = holes.reduce((total, hole) => total + hole.par, 0);

export function inRough(ball, hole) {
  return hole.rough.some(
    ({ x, y, width, height }) =>
      ball.x >= x && ball.x <= x + width && ball.y >= y && ball.y <= y + height,
  );
}

export function launch(ball, angle, power) {
  const radians = (angle / 180) * Math.PI;
  const speed = 30 + 3 * power;
  return { ...ball, vx: Math.cos(radians) * speed, vy: Math.sin(radians) * speed };
}

export function pullAim(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  const deadZone = 4;
  if (length <= deadZone) return null;
  // A pull toward a nearby edge charges over the remaining space on the green.
  const availableX = dx ? (((dx > 0 ? course.width : 0) - start.x) * length) / dx : Infinity;
  const availableY = dy ? (((dy > 0 ? course.height : 0) - start.y) * length) / dy : Infinity;
  const limit = Math.max(12, Math.min(76, availableX, availableY));
  return {
    angle: ((Math.atan2(-dy, -dx) * 180) / Math.PI + 360) % 360,
    power: Math.max(5, Math.min(100, (100 * (length - deadZone)) / (limit - deadZone))),
    pull: Math.min(length, limit),
  };
}

function reboundAtRails(ball, coefficient) {
  const { rail, ballRadius, width, height } = course;
  const minimum = rail + ballRadius;
  for (const [position, velocity, maximum] of [
    ['x', 'vx', width - minimum],
    ['y', 'vy', height - minimum],
  ]) {
    if (ball[position] < minimum || ball[position] > maximum) {
      ball[position] = Math.max(minimum, Math.min(maximum, ball[position]));
      ball[velocity] *= -coefficient;
    }
  }
}

function reboundAtWall(ball, previousX, previousY, wall) {
  const { ballRadius } = course;
  const left = wall.x - ballRadius;
  const top = wall.y - ballRadius;
  const right = wall.x + wall.width + ballRadius;
  const bottom = wall.y + wall.height + ballRadius;
  if (ball.x <= left || ball.x >= right || ball.y <= top || ball.y >= bottom) return;

  // Resolve the first face crossed. At an exact corner, reflect both components.
  const edgeX = previousX <= left ? left : previousX >= right ? right : null;
  const edgeY = previousY <= top ? top : previousY >= bottom ? bottom : null;
  const entryX = edgeX === null ? -Infinity : (edgeX - previousX) / (ball.x - previousX);
  const entryY = edgeY === null ? -Infinity : (edgeY - previousY) / (ball.y - previousY);
  if (edgeX !== null && entryX >= entryY - 1e-8) {
    ball.x = edgeX;
    ball.vx *= -rebound;
  }
  if (edgeY !== null && entryY >= entryX - 1e-8) {
    ball.y = edgeY;
    ball.vy *= -rebound;
  }
}

export function stepBall(ball, hole) {
  const seconds = stepMs / 1000;
  const speed = Math.hypot(ball.vx, ball.vy);
  const turfDrag = hole.fast ? 74 : drag;
  const nextSpeed = Math.max(0, speed - (inRough(ball, hole) ? roughDrag : turfDrag) * seconds);
  const distanceScale = speed ? ((speed + nextSpeed) / (2 * speed)) * seconds : 0;
  const previousX = ball.x;
  const previousY = ball.y;
  ball.x += ball.vx * distanceScale;
  ball.y += ball.vy * distanceScale;
  ball.vx = speed ? (ball.vx * nextSpeed) / speed : 0;
  ball.vy = speed ? (ball.vy * nextSpeed) / speed : 0;

  reboundAtRails(ball, hole.fast ? 0.96 : rebound);
  for (const wall of hole.walls) reboundAtWall(ball, previousX, previousY, wall);

  if (
    Math.hypot(ball.vx, ball.vy) <= captureSpeed &&
    Math.hypot(ball.x - hole.cup.x, ball.y - hole.cup.y) <= course.cupRadius
  ) {
    Object.assign(ball, hole.cup, { vx: 0, vy: 0 });
    return 'sunk';
  }
  return ball.vx || ball.vy ? 'moving' : 'stopped';
}

export function createScorecard(playerCount) {
  return Array.from({ length: playerCount }, () => []);
}

export function recordHole(scorecard, player, strokes) {
  scorecard[player].push(strokes);
  const nextPlayer = (player + 1) % scorecard.length;
  const nextHole = scorecard[nextPlayer].length;
  return { player: nextPlayer, hole: nextHole, finished: nextHole === holes.length };
}

export function courseTotals(scorecard) {
  return scorecard.map((scores) => scores.reduce((total, strokes) => total + strokes, 0));
}

export function winner(totals) {
  if (totals.length === 1 || totals[0] === totals[1]) return null;
  return totals[0] < totals[1] ? 0 : 1;
}
