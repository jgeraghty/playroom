export const shapeSymbols = { circle: '●', triangle: '▲', square: '■', diamond: '◆', star: '★' };
export const directions = ['up', 'right', 'down', 'left'];
export const arrows = ['↑', '→', '↓', '←'];

export function tileLabel(kind, value) {
  if (kind === 'rotation') return `Arrow ${directions[value]}`;
  if (kind === 'quantity') return `${value} ${value === 1 ? 'dot' : 'dots'}`;
  if (kind === 'combined') {
    const [direction, count] = value.split('/').map(Number);
    return `${tileLabel('rotation', direction)}, ${tileLabel('quantity', count)}`;
  }
  return value[0].toUpperCase() + value.slice(1);
}

const stages = [
  {
    mode: 'fill',
    kind: 'repetition',
    title: 'The missing tile',
    instruction: 'Find the group that repeats and fill the gap.',
  },
  {
    mode: 'repair',
    kind: 'rotation',
    title: 'The broken turn',
    instruction: 'Select the one arrow that breaks the pattern, then choose its replacement.',
  },
  {
    mode: 'extend',
    kind: 'quantity',
    title: 'The dot trail',
    instruction: 'Follow the changes in dot count and build the next tiles in order.',
  },
  {
    mode: 'repair',
    kind: 'repetition',
    title: 'The broken group',
    instruction:
      'Select the one shape that breaks the repeating group, then choose its replacement.',
  },
  {
    mode: 'extend',
    kind: 'combined',
    title: 'The double trail',
    instruction:
      'Follow the arrow turns and the dot counts together. Build the next tiles in order.',
  },
];

function repeats(sequence, periods) {
  return periods.some((period) =>
    sequence.every((value, index) => value === sequence[index % period]),
  );
}

function differences(sequence) {
  return sequence.slice(1).map((value, index) => value - sequence[index]);
}

function followsRule(kind, sequence) {
  if (kind === 'repetition') {
    return repeats(
      sequence,
      [2, 3, 4].filter((period) => 2 * period < sequence.length),
    );
  }
  if (kind === 'combined') {
    const pairs = sequence.map((value) => value.split('/').map(Number));
    return (
      followsRule(
        'rotation',
        pairs.map(([direction]) => direction),
      ) &&
      followsRule(
        'quantity',
        pairs.map(([, count]) => count),
      )
    );
  }
  const steps = differences(sequence);
  const changes = kind === 'rotation' ? steps.map((step) => (step + 4) % 4) : steps;
  return changes.every((change) => change !== 0) && repeats(changes, [1, 2]);
}

export function validAnswers(puzzle) {
  const { shown, kind, mode, positions, choices } = puzzle;
  const attempts = [];
  if (mode === 'repair') {
    for (let position = 0; position < shown.length; position++) {
      for (const choice of choices) {
        if (shown[position] !== choice) attempts.push([[position, choice]]);
      }
    }
  } else {
    const expand = (edits) => {
      if (edits.length === positions.length) {
        attempts.push(edits);
        return;
      }
      for (const choice of choices) expand([...edits, [positions[edits.length], choice]]);
    };
    expand([]);
  }

  return attempts.filter((edits) => {
    const candidate = [...shown];
    for (const [position, value] of edits) candidate[position] = value;
    return followsRule(kind, candidate);
  });
}

export function signatureOf({ mode, kind, shown }) {
  return JSON.stringify([mode, kind, shown]);
}

function turnDescription(step) {
  if (step === 2) return 'half a turn';
  return `a quarter turn ${step === 1 ? 'clockwise' : 'counterclockwise'}`;
}

function countDescription(step) {
  const count = Math.abs(step);
  return `${step > 0 ? 'adding' : 'removing'} ${count} ${count === 1 ? 'dot' : 'dots'}`;
}

function describeChange(steps, describe, subject) {
  const [first, second] = steps.map(describe);
  return second
    ? `${subject} alternates between ${first} and ${second}.`
    : `${subject} changes by ${first} at each step.`;
}

function makeRandom(seed) {
  let state = seed >>> 0;
  return (limit) => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return Math.floor((state / 4294967296) * limit);
  };
}

function choose(random, options) {
  return options[random(options.length)];
}

function sample(random, source) {
  const options = [...source];
  return Array.from({ length: source.length }, () => options.splice(random(options.length), 1)[0]);
}

function progression(start, steps, length, transform = (value) => value) {
  const values = [start];
  while (values.length < length) {
    const index = values.length - 1;
    values.push(transform(values[index] + steps[index % steps.length]));
  }
  return values;
}

function shapePattern(random, stage, tier) {
  const labels = sample(random, Object.keys(shapeSymbols));
  const group =
    tier < 2 ? labels.slice(0, 3) : [labels[0], labels[1], labels[1 + random(2)], labels[2]];
  const repair = stage.mode === 'repair';
  const length = group.length * 2 + (repair ? 2 : 1);
  const sequence = Array.from({ length }, (_, index) => group[index % group.length]);
  const position = repair ? random(2) + group.length : random(length - 2) + 1;
  return {
    sequence,
    positions: [position],
    palette: labels,
    rule: `The repeating group is ${group.join(', ')}.`,
    clue: 'Look for a short group that appears more than once. Compare the same position in each group.',
  };
}

function arrowPattern(random, tier, length) {
  const steps =
    tier < 2
      ? [choose(random, [1, 2, -1])]
      : choose(random, [
          [1, 2],
          [2, -1],
          [-1, 1],
          [-1, 2],
        ]);
  return {
    sequence: progression(random(4), steps, length, (direction) => (direction + 4) % 4),
    rule: describeChange(steps, turnDescription, 'The arrow'),
  };
}

function dotPattern(random, tier, length) {
  const steps = choose(
    random,
    tier === 0
      ? [[1], [-1], [1, -1], [-1, 1]]
      : [
          [2, -1],
          [-2, 1],
          [3, -2],
          [-3, 2],
          [2, -2],
          [-2, 2],
        ],
  );
  const options = Array.from({ length: 9 }, (_, index) =>
    progression(index + 1, steps, length),
  ).filter((sequence) => sequence.every((value) => value >= 1 && value <= 9));
  return {
    sequence: choose(random, options),
    rule: describeChange(steps, countDescription, 'The dot count'),
  };
}

function generate(random, stage, tier) {
  const { mode, kind } = stage;
  let pattern;
  if (kind === 'repetition') {
    pattern = shapePattern(random, stage, tier);
  } else if (kind === 'rotation') {
    const arrows = arrowPattern(random, tier, 8);
    pattern = {
      ...arrows,
      positions: [random(6) + 1],
      palette: [0, 1, 2, 3],
      clue: 'Read the changes from one arrow to the next. They can repeat in pairs.',
    };
  } else {
    const shownCount = 5;
    const length = shownCount + (tier < 3 ? 2 : 3);
    const counts = dotPattern(random, tier, length);
    const positions = Array.from({ length: length - shownCount }, (_, index) => index + shownCount);
    if (kind === 'quantity') {
      pattern = {
        ...counts,
        positions,
        palette: counts.sequence.flatMap((count) =>
          [count, count - 1, count + 1].filter((value) => value >= 1 && value <= 9),
        ),
        clue: 'Compare each pair of neighbors. Say how many dots are added or removed each time.',
      };
    } else {
      const arrows = arrowPattern(random, tier, length);
      const sequence = counts.sequence.map((count, index) => `${arrows.sequence[index]}/${count}`);
      const palette = positions.flatMap((position, index) => {
        const next = positions[(index + 1) % positions.length];
        return [
          `${arrows.sequence[position]}/${counts.sequence[next]}`,
          `${arrows.sequence[next]}/${counts.sequence[position]}`,
          `${(arrows.sequence[position] + 1) % 4}/${counts.sequence[position]}`,
        ];
      });
      pattern = {
        sequence,
        positions,
        palette,
        rule: `${arrows.rule} ${counts.rule}`,
        clue: 'Read the arrow turns by themselves first. Then follow the changes in dot count.',
      };
    }
  }

  const { sequence, positions, palette, rule, clue } = pattern;
  const answers = positions.map((position) => sequence[position]);
  const alternatives = sample(
    random,
    [...new Set(palette)].filter((value) => !answers.includes(value)),
  );
  const distinctAnswers = [...new Set(answers)];
  const choiceCount = tier === 0 && kind !== 'combined' ? 3 : 4;
  const choices = sample(random, [
    ...distinctAnswers,
    ...alternatives.slice(0, choiceCount - distinctAnswers.length),
  ]);
  const shown = sequence.map((value, position) => {
    if (!positions.includes(position)) return value;
    return mode === 'repair' ? alternatives[0] : null;
  });
  return { ...stage, shown, positions, answers, choices, rule, clue };
}

const recentLimit = 12;
const fallbackCache = new Map();

function hasUniqueAnswer(puzzle) {
  const solutions = validAnswers(puzzle);
  return (
    solutions.length === 1 &&
    puzzle.positions.every(
      (position, index) =>
        solutions[0][index][0] === position && solutions[0][index][1] === puzzle.answers[index],
    )
  );
}

export function fallbackBank(kind, mode, tier) {
  const stage = stages.find((item) => item.kind === kind && item.mode === mode);
  const key = `${kind}/${mode}/${tier}`;
  if (!fallbackCache.has(key)) {
    const random = makeRandom(17373 + stages.indexOf(stage) * 503 + tier);
    const bank = new Map();
    for (let attempt = 0; attempt < 1000 && bank.size <= recentLimit; attempt++) {
      const puzzle = generate(random, stage, tier);
      const signature = signatureOf(puzzle);
      if (!bank.has(signature) && hasUniqueAnswer(puzzle)) bank.set(signature, puzzle);
    }
    fallbackCache.set(key, bank);
  }
  return fallbackCache.get(key);
}

function nextBag(random, previousMode) {
  const noAdjacentMatch = (order) =>
    order.every((stage, index) => stage.mode !== (order[index - 1]?.mode ?? previousMode));
  for (let attempt = 0; attempt < 20; attempt++) {
    const order = sample(random, stages);
    if (noAdjacentMatch(order)) return order;
  }
  const [fill, rotation, quantity, repair, combined] = stages;
  return previousMode === 'fill' ? [rotation, fill, quantity, repair, combined] : [...stages];
}

export function createPuzzleRun(seed = Math.floor(Math.random() * 4294967296)) {
  const random = makeRandom(seed);
  const recent = [];
  let bag = [...stages];
  let previousMode;
  let level = 0;

  function freshPuzzle(stage, tier) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const puzzle = generate(random, stage, tier);
      const signature = signatureOf(puzzle);
      if (!recent.includes(signature) && hasUniqueAnswer(puzzle)) return [signature, puzzle];
    }
    // Every stage and tier has thirteen verified signatures. At most twelve
    // can be in the recent window, so at least one fallback is available.
    return [...fallbackBank(stage.kind, stage.mode, tier)].find(
      ([signature]) => !recent.includes(signature),
    );
  }

  return {
    next() {
      if (!bag.length) bag = nextBag(random, previousMode);
      const stage = bag.shift();
      previousMode = stage.mode;
      const tier = Math.min(3, Math.floor(level / stages.length));
      const [signature, puzzle] = freshPuzzle(stage, tier);
      recent.push(signature);
      if (recent.length > recentLimit) recent.shift();
      return { ...puzzle, level: ++level };
    },
  };
}
