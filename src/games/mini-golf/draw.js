import { course, launch, stepBall } from './rules.js';

function circle(ctx, x, y, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawAim(ctx, hole, ball, aim) {
  if (!aim.power) {
    const angle = (aim.angle * Math.PI) / 180;
    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(angle);
    ctx.strokeStyle = '#fff5b7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(24, 0);
    ctx.moveTo(18, -4);
    ctx.lineTo(24, 0);
    ctx.lineTo(18, 4);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const path = launch(ball, aim.angle, aim.power);
  let status;
  let distance = 0;
  const guideLength = 27 + aim.power * 0.52;
  ctx.beginPath();
  ctx.moveTo(path.x, path.y);
  do {
    const { x, y } = path;
    status = stepBall(path, hole);
    distance += Math.hypot(path.x - x, path.y - y);
    ctx.lineTo(path.x, path.y);
  } while (status === 'moving' && distance < guideLength);
  ctx.strokeStyle = '#fff5b7';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.setLineDash([2, 5]);
  ctx.stroke();
  ctx.setLineDash([]);
  if (aim.pull) {
    const angle = (aim.angle * Math.PI) / 180;
    ctx.strokeStyle = '#d7ebd4';
    ctx.beginPath();
    ctx.moveTo(ball.x, ball.y);
    ctx.lineTo(ball.x - Math.cos(angle) * aim.pull, ball.y - Math.sin(angle) * aim.pull);
    ctx.stroke();
  }
}

export function drawCourse(ctx, hole, ball, phase, aim) {
  const { width, height, rail, cupRadius, ballRadius } = course;
  ctx.fillStyle = '#25463e';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = hole.fast ? '#297677' : '#287354';
  ctx.fillRect(rail, rail, width - 2 * rail, height - 2 * rail);

  ctx.save();
  ctx.beginPath();
  ctx.rect(rail, rail, width - 2 * rail, height - 2 * rail);
  ctx.clip();
  ctx.strokeStyle = '#ffffff13';
  ctx.lineWidth = 14;
  ctx.beginPath();
  for (let x = -height; x < width; x += 39) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x + height, height);
  }
  ctx.stroke();
  ctx.restore();

  for (const { x, y, width, height } of hole.rough) {
    ctx.fillStyle = '#805c32';
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = '#b3874c';
    for (let row = 6; row < height - 3; row += 8) {
      for (let column = 4 + (row % 3) * 2; column < width - 4; column += 9) {
        ctx.fillRect(x + column, y + row, 2, 3);
      }
    }
    ctx.font = 'bold 8px system-ui';
    ctx.fillStyle = '#fff2d4';
    ctx.textAlign = 'center';
    ctx.fillText('ROUGH', x + width / 2, y + height - 6);
  }

  for (const wall of hole.walls) {
    ctx.fillStyle = '#174734';
    ctx.fillRect(wall.x + 2, wall.y + 4, wall.width, wall.height);
    ctx.fillStyle = '#35564b';
    ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
    ctx.fillStyle = '#55756a';
    ctx.fillRect(wall.x, wall.y, wall.width, 4);
  }

  const { x, y } = hole.cup;
  circle(ctx, x, y, cupRadius, '#172f29');
  circle(ctx, x, y, cupRadius - 3, '#0e211e');
  ctx.strokeStyle = '#fff3da';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 31);
  ctx.stroke();
  ctx.fillStyle = '#ffad69';
  ctx.beginPath();
  ctx.moveTo(x + 1, y - 31);
  ctx.lineTo(x + 23, y - 25);
  ctx.lineTo(x + 1, y - 19);
  ctx.fill();

  if (phase === 'aiming') {
    circle(ctx, ball.x, ball.y, 9, '#e0f6ce40');
    drawAim(ctx, hole, ball, aim);
  }
  const holeComplete = phase === 'handoff' || phase === 'finished';
  if (!holeComplete || Math.hypot(ball.x - x, ball.y - y) > 0) {
    circle(ctx, ball.x + 1, ball.y + 2, ballRadius + 0.5, '#0c3729');
    circle(ctx, ball.x, ball.y, ballRadius, '#fff9e9');
    circle(ctx, ball.x - 1, ball.y - 1, 1, '#fff');
  }
}
