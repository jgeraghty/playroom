export function chooseFood(snake, size, random = Math.random) {
  const occupied = new Set(snake.map(([x, y]) => `${x},${y}`));
  const free = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!occupied.has(`${x},${y}`)) free.push([x, y]);
    }
  }
  return free.length ? free[Math.floor(random() * free.length)] : null;
}

export function collides(snake, head, growing, size) {
  const [x, y] = head;
  return (
    x < 0 ||
    y < 0 ||
    x >= size ||
    y >= size ||
    (growing ? snake : snake.slice(0, -1)).some(([a, b]) => a === x && b === y)
  );
}

export function queueDirection(current, queue, next) {
  const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const last = queue.at(-1) || current;
  if (!opposite[next] || queue.length >= 2 || next === last || next === opposite[last])
    return queue;
  return [...queue, next];
}
