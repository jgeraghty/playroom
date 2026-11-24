export const court = { width: 600, height: 360, radius: 8, inset: 18, paddleWidth: 10 };
export const stepSeconds = 1 / 120;

export const modes = {
  easy: {
    playerSize: 94,
    opponentSize: 68,
    opponentSpeed: 155,
    aimOffset: 15,
    trackingStart: 360,
    serveSpeed: 290,
    speedCap: 570,
  },
  normal: {
    playerSize: 78,
    opponentSize: 78,
    opponentSpeed: 235,
    aimOffset: 10,
    trackingStart: 280,
    serveSpeed: 350,
    speedCap: 650,
  },
};

export function clampPaddle(y, size) {
  return Math.max(size / 2, Math.min(court.height - size / 2, y));
}

export function approach(value, target, distance) {
  return value + Math.sign(target - value) * Math.min(distance, Math.abs(target - value));
}

export function serveBall(direction, mode, random = Math.random) {
  const angle = (random() < 0.5 ? -1 : 1) * (0.18 + random() * 0.32);
  return {
    x: court.width / 2,
    y: court.height / 2,
    vx: Math.cos(angle) * mode.serveSpeed * direction,
    vy: Math.sin(angle) * mode.serveSpeed,
  };
}

function travel(ball, seconds) {
  ball.x += ball.vx * seconds;
  ball.y += ball.vy * seconds;
  const { radius, height } = court;
  if (ball.y < radius) {
    ball.y = 2 * radius - ball.y;
    ball.vy = Math.abs(ball.vy);
  } else if (ball.y > height - radius) {
    ball.y = 2 * (height - radius) - ball.y;
    ball.vy = -Math.abs(ball.vy);
  }
}

// The caller advances in fixed steps. Test the ball at the instant it crosses a
// paddle face, so a late overlap or a ball already behind a paddle cannot bounce.
export function advanceBall(ball, player, opponent, mode) {
  const leftward = ball.vx < 0;
  const { width, inset, paddleWidth, radius } = court;
  const leftFace = inset + paddleWidth + radius;
  const face = leftward ? leftFace : width - leftFace;
  const contact = (face - ball.x) / ball.vx;

  if (contact >= 0 && contact <= stepSeconds) {
    travel(ball, contact);
    const center = leftward ? player : opponent;
    const size = leftward ? mode.playerSize : mode.opponentSize;
    const offset = (ball.y - center) / (size / 2 + radius);
    if (Math.abs(offset) <= 1) {
      const angle = offset * 0.98;
      const speed = Math.min(mode.speedCap, Math.hypot(ball.vx, ball.vy) * 1.07);
      ball.vx = (leftward ? 1 : -1) * Math.cos(angle) * speed;
      ball.vy = Math.sin(angle) * speed;
    }
    travel(ball, stepSeconds - contact);
  } else travel(ball, stepSeconds);

  if (ball.x < -radius) return 'computer';
  if (ball.x > width + radius) return 'player';
  return null;
}
