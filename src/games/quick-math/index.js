import { createGameUI } from '../../shared/game-ui.js';
import { shuffle } from '../../shared/shuffle.js';

const total = 10;
const operations = {
  addition: { symbol: '+', calculate: (a, b) => a + b },
  subtraction: { symbol: '−', calculate: (a, b) => a - b },
  multiplication: { symbol: '×', calculate: (a, b) => a * b },
};

function questionPool(operation, challenge) {
  const { symbol, calculate } = operations[operation];
  const multiplication = operation === 'multiplication';
  const maxA = challenge ? (multiplication ? 12 : 30) : multiplication ? 5 : 10;
  const maxB = multiplication ? (challenge ? 12 : 10) : maxA;
  const questions = [];
  for (let a = multiplication ? 2 : 1; a <= maxA; a++) {
    for (let b = 1; b <= maxB; b++) {
      if (operation === 'subtraction' && b > a) continue;
      if (operation === 'addition' && b > a) continue;
      questions.push({
        a,
        b,
        operation,
        expression: `${a} ${symbol} ${b}`,
        answer: calculate(a, b),
      });
    }
  }
  return shuffle(questions);
}

function makeSet(practice) {
  if (Object.hasOwn(operations, practice)) return questionPool(practice, false).slice(0, total);
  const mixed = shuffle(Object.keys(operations));
  return shuffle(
    mixed.flatMap((operation, index) =>
      questionPool(operation, practice === 'challenge').slice(0, index === 0 ? 4 : 3),
    ),
  );
}

function explain({ a, b, answer, operation }) {
  if (operation === 'addition') return `Start at ${a} and count up ${b} to reach ${answer}.`;
  if (operation === 'subtraction') return `Take ${b} away from ${a} and you have ${answer} left.`;
  return `${a} groups of ${b} make ${answer}.`;
}

export function mountGame({ root, options, progress, finish, saveProgress }) {
  const practice = options?.practice || 'addition';
  const recordKey = `bestSet_${practice}`;
  const ui = createGameUI(root, '');
  let best = progress[recordKey] || 0;
  let paused = false;
  let questions, misses, index, score;

  function showQuestion(moveFocus = false) {
    const question = questions[index];
    const { expression, answer } = question;
    const offset = question.operation === 'multiplication' ? question.a : 1;
    const choices = shuffle(
      answer >= offset
        ? [answer - offset, answer, answer + offset]
        : [answer, answer + offset, answer + offset * 2],
    );
    let picked;
    ui.render(`
      <section class="arcade-stage learning-stage math-stage">
        <div class="stage-heading"><h2 id="math-heading" tabindex="-1">Question ${index + 1} of ${total}</h2><span class="mode-chip">Score <span id="math-score">${score}</span></span></div>
        <progress class="learning-progress" aria-label="Questions answered" max="${total}" value="${index}"></progress>
        <div class="math-expression">${expression} = ?</div>
        <div class="math-answers" role="group" aria-label="Answer choices">
          ${choices.map((choice) => `<button type="button" data-answer="${choice}">${choice}</button>`).join('')}
        </div>
        <div class="math-feedback" role="status"><strong></strong><p>Choose an answer.</p></div>
        <button class="math-next" type="button" id="math-next" disabled>${index + 1 === total ? 'See results' : 'Next question'}</button>
      </section>`);

    const next = root.querySelector('#math-next');
    ui.on('[data-answer]', 'click', (event) => {
      if (paused || picked !== undefined) return;
      picked = Number(event.currentTarget.dataset.answer);
      const correct = picked === answer;
      if (correct) score++;
      else misses.push(`${expression} = ${answer} (you picked ${picked})`);
      for (const button of root.querySelectorAll('[data-answer]')) {
        const value = Number(button.dataset.answer);
        button.setAttribute('aria-disabled', 'true');
        button.tabIndex = -1;
        if (value === answer) {
          button.dataset.feedback = 'correct';
          button.setAttribute('aria-label', `${value}, correct answer`);
        } else if (value === picked) {
          button.dataset.feedback = 'incorrect';
          button.setAttribute('aria-label', `${value}, your answer`);
        }
      }
      root.querySelector('#math-score').textContent = score;
      root.querySelector('progress').value = index + 1;
      root.querySelector('.math-feedback strong').textContent = correct
        ? 'That’s right!'
        : `The answer is ${answer}.`;
      root.querySelector('.math-feedback p').textContent = explain(question);
      next.disabled = false;
    });

    ui.on('#math-next', 'click', () => {
      if (paused || next.disabled) return;
      next.disabled = true;
      index++;
      if (index < total) {
        showQuestion(true);
        return;
      }

      best = Math.max(best, score);
      saveProgress({ [recordKey]: best });
      finish({
        title: score >= 8 ? 'Math star!' : 'Set complete!',
        message: `You got ${score} of ${total} right.`,
        score,
        outcome: score >= 8 ? 'win' : 'loss',
        stats: [
          ['Correct', `${score}/${total}`],
          ['Best in this mode', `${best}/${total}`],
        ],
        review: { label: 'Review missed questions', entries: misses },
      });
    });
    if (moveFocus) root.querySelector('#math-heading').focus();
  }

  function start() {
    paused = false;
    questions = makeSet(practice);
    misses = [];
    index = 0;
    score = 0;
    showQuestion();
  }

  start();
  return {
    pause: () => {
      paused = true;
    },
    resume: () => {
      paused = false;
    },
    restart: start,
    destroy: () => ui.destroy(),
  };
}
