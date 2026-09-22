/* =========================================================
   IQ Tester — Application Script
   Sections:
   1. Utilities & seeded RNG
   2. Question bank generators (200 questions, 6 categories)
   3. Validation
   4. App state & view routing
   5. Landing/hero interactions
   6. Test engine (selection, adaptive difficulty, timer)
   7. Scoring engine
   8. Results rendering + share
   9. History (localStorage) + trend chart
   10. Misc (theme, focus detection, confetti, toasts)
   ========================================================= */

/* ---------------------------------------------------------
   1. UTILITIES
   --------------------------------------------------------- */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(88172645); // fixed seed -> stable, reproducible bank
function randInt(min, max) { return Math.floor(rng() * (max - min + 1)) + min; }
function randChoice(arr) { return arr[Math.floor(rng() * arr.length)]; }
function shuffleWith(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function uniqueNumberDistractors(correct, count, spread) {
  const set = new Set([correct]);
  const out = [];
  let guard = 0;
  while (out.length < count && guard < 200) {
    guard++;
    const delta = randInt(-spread, spread) || 1;
    const cand = correct + delta;
    if (!set.has(cand)) { set.add(cand); out.push(cand); }
  }
  return out;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------------------------------------------------------
   2. QUESTION BANK GENERATORS
   --------------------------------------------------------- */

function difficultyForRatio(r) {
  if (r < 0.28) return 'Easy';
  if (r < 0.60) return 'Medium';
  if (r < 0.85) return 'Hard';
  return 'Expert';
}
const DIFF_WEIGHT = { Easy: 1, Medium: 1.5, Hard: 2.1, Expert: 2.7 };

let __qid = 1;
// Easy/Medium questions get 10 seconds; Hard/Expert questions get 15 seconds.
function timeLimitForDifficulty(difficulty) {
  return (difficulty === 'Hard' || difficulty === 'Expert') ? 15 : 10;
}
function finalizeQuestion(base, category, group, difficulty) {
  return {
    id: __qid++,
    category,
    group, // breakdown group used in results
    difficulty,
    weight: DIFF_WEIGHT[difficulty],
    question: base.question,
    visual: base.visual || null,
    memory: base.memory === true,
    options: base.options,
    answer: base.answer,
    explanation: base.explanation,
    timeLimit: timeLimitForDifficulty(difficulty)
  };
}

function buildCategory(categoryName, group, count, generatorList) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const difficulty = difficultyForRatio(i / count);
    const gen = generatorList[i % generatorList.length];
    const base = gen(i, difficulty);
    out.push(finalizeQuestion(base, categoryName, group, difficulty));
  }
  return out;
}

/* ---- 2.1 Number & Mathematical Patterns (40) ---- */

function seqVisual(items, unknown) {
  const boxes = items.map(v => `<span class="seq-box">${escapeHtml(v)}</span>`).join('<span class="seq-arrow">→</span>');
  return `<div class="seq-row">${boxes}<span class="seq-arrow">→</span><span class="seq-box">?</span></div>`;
}

const numberGenerators = [
  // arithmetic sequence
  (i, diff) => {
    const step = randInt(2 + Math.floor(i / 4), 6 + Math.floor(i / 3));
    const start = randInt(1, 40);
    const seq = [start, start + step, start + 2 * step, start + 3 * step];
    const next = start + 4 * step;
    const opts = shuffleWith([next, ...uniqueNumberDistractors(next, 3, step)]);
    return {
      question: 'What number comes next in the sequence?',
      visual: seqVisual(seq),
      options: opts.map(String),
      answer: String(next),
      explanation: `Each number increases by ${step}, so the next value is ${next}.`
    };
  },
  // geometric sequence
  (i, diff) => {
    const ratio = randChoice([2, 2, 3]);
    const start = randInt(1, 6);
    const seq = [start, start * ratio, start * ratio ** 2, start * ratio ** 3];
    const next = start * ratio ** 4;
    const opts = shuffleWith([next, ...uniqueNumberDistractors(next, 3, Math.max(2, Math.round(next * 0.2)))]);
    return {
      question: 'What number comes next in the sequence?',
      visual: seqVisual(seq),
      options: opts.map(String),
      answer: String(next),
      explanation: `Each number is multiplied by ${ratio}, so the next value is ${next}.`
    };
  },
  // fibonacci-like
  (i, diff) => {
    const a0 = randInt(1, 5), a1 = randInt(1, 6);
    const seq = [a0, a1, a0 + a1, a0 + 2 * a1];
    const next = a1 + seq[2] + seq[3] - seq[3] + seq[2]; // seq[2]+seq[3]
    const realNext = seq[2] + seq[3];
    const opts = shuffleWith([realNext, ...uniqueNumberDistractors(realNext, 3, Math.max(2, Math.round(realNext * 0.25)))]);
    return {
      question: 'What number comes next? Each term is the sum of the two before it.',
      visual: seqVisual(seq),
      options: opts.map(String),
      answer: String(realNext),
      explanation: `Each term equals the sum of the previous two: ${seq[2]} + ${seq[3]} = ${realNext}.`
    };
  },
  // squares
  (i, diff) => {
    const startN = randInt(2, 6);
    const seq = [startN, startN + 1, startN + 2, startN + 3].map(n => n * n);
    const next = (startN + 4) * (startN + 4);
    const opts = shuffleWith([next, ...uniqueNumberDistractors(next, 3, Math.max(3, Math.round(next * 0.15)))]);
    return {
      question: 'What number comes next in this sequence of perfect squares?',
      visual: seqVisual(seq),
      options: opts.map(String),
      answer: String(next),
      explanation: `These are consecutive squares (${startN}², ${startN + 1}², …). The next is ${startN + 4}² = ${next}.`
    };
  },
  // alternating add/subtract
  (i, diff) => {
    const start = randInt(20, 60);
    const a = randInt(3, 9), b = randInt(2, 7);
    const seq = [start, start + a, start + a - b, start + 2 * a - b];
    const next = start + 2 * a - 2 * b;
    const opts = shuffleWith([next, ...uniqueNumberDistractors(next, 3, 5)]);
    return {
      question: 'What number comes next? The pattern alternates between two operations.',
      visual: seqVisual(seq),
      options: opts.map(String),
      answer: String(next),
      explanation: `The sequence alternates +${a} and −${b}, so the next value is ${next}.`
    };
  },
  // increasing differences (quadratic-like)
  (i, diff) => {
    const start = randInt(1, 10);
    const d0 = randInt(2, 5);
    const t1 = start + d0, t2 = t1 + d0 + 1, t3 = t2 + d0 + 2;
    const next = t3 + d0 + 3;
    const seq = [start, t1, t2, t3];
    const opts = shuffleWith([next, ...uniqueNumberDistractors(next, 3, 4)]);
    return {
      question: 'What number comes next? Look closely at how the gap between numbers changes.',
      visual: seqVisual(seq),
      options: opts.map(String),
      answer: String(next),
      explanation: `The gap between terms grows by 1 each time, so the next gap is ${d0 + 4}, giving ${next}.`
    };
  },
  // missing number in the middle
  (i, diff) => {
    const step = randInt(3, 9);
    const start = randInt(5, 30);
    const seq = [start, start + step, '?', start + 3 * step, start + 4 * step];
    const missing = start + 2 * step;
    const opts = shuffleWith([missing, ...uniqueNumberDistractors(missing, 3, step)]);
    return {
      question: 'Which number is missing from the middle of the sequence?',
      visual: `<div class="seq-row">${seq.map(v => `<span class="seq-box">${v}</span>`).join('<span class="seq-arrow">→</span>')}</div>`,
      options: opts.map(String),
      answer: String(missing),
      explanation: `The sequence increases by ${step} each step, so the missing value is ${missing}.`
    };
  },
  // proportional word relationship
  (i, diff) => {
    const unitCost = randInt(2, 9);
    const baseQty = randChoice([3, 4, 5]);
    const targetQty = baseQty + randInt(2, 6);
    const baseCost = unitCost * baseQty;
    const answer = unitCost * targetQty;
    const opts = shuffleWith([answer, ...uniqueNumberDistractors(answer, 3, unitCost * 2)]);
    return {
      question: `If ${baseQty} identical pens cost ${baseCost}, how much do ${targetQty} of the same pens cost?`,
      options: opts.map(String),
      answer: String(answer),
      explanation: `Each pen costs ${baseCost} ÷ ${baseQty} = ${unitCost}, so ${targetQty} pens cost ${targetQty} × ${unitCost} = ${answer}.`
    };
  },
  // doubling/halving sequence
  (i, diff) => {
    const start = randInt(80, 400);
    const seq = [start, Math.round(start / 2), Math.round(start / 4)];
    const next = Math.round(start / 8);
    const opts = shuffleWith([next, ...uniqueNumberDistractors(next, 3, Math.max(2, Math.round(next * 0.3)))]);
    return {
      question: 'What number comes next? Each value is half of the one before it.',
      visual: seqVisual(seq),
      options: opts.map(String),
      answer: String(next),
      explanation: `Each number is half of the previous one, so the next value is ${next}.`
    };
  },
  // sum-of-digits pattern
  (i, diff) => {
    const step = randInt(6, 15);
    const start = randInt(10, 40);
    const seq = [start, start + step, start + 2 * step];
    const next = start + 3 * step;
    const opts = shuffleWith([next, ...uniqueNumberDistractors(next, 3, step)]);
    return {
      question: 'What number comes next in the sequence?',
      visual: seqVisual(seq),
      options: opts.map(String),
      answer: String(next),
      explanation: `Each number increases by ${step}, so the next value is ${next}.`
    };
  }
];

/* ---- 2.2 Logical Reasoning (40) ---- */

const CATEGORY_LISTS = [
  { odd: 'Wrench', group: ['Apple', 'Mango', 'Banana', 'Grape'] },
  { odd: 'Truck', group: ['Piano', 'Violin', 'Flute', 'Cello'] },
  { odd: 'Saturn', group: ['Lion', 'Tiger', 'Leopard', 'Cheetah'] },
  { odd: 'Sparrow', group: ['Salmon', 'Tuna', 'Trout', 'Cod'] },
  { odd: 'Hammer', group: ['Circle', 'Square', 'Triangle', 'Hexagon'] },
  { odd: 'Whisper', group: ['Hammer', 'Screwdriver', 'Wrench', 'Chisel'] },
  { odd: 'Cloud', group: ['Oak', 'Pine', 'Maple', 'Birch'] },
  { odd: 'Guitar', group: ['Mercury', 'Venus', 'Mars', 'Jupiter'] },
  { odd: 'Kettle', group: ['Ruby', 'Emerald', 'Sapphire', 'Topaz'] },
  { odd: 'Falcon', group: ['Sofa', 'Armchair', 'Recliner', 'Loveseat'] },
  { odd: 'Compass', group: ['Basketball', 'Football', 'Tennis', 'Hockey'] },
  { odd: 'Blanket', group: ['Rain', 'Snow', 'Hail', 'Sleet'] },
  { odd: 'Marble', group: ['Trumpet', 'Trombone', 'Tuba', 'French Horn'] },
  { odd: 'Ladder', group: ['Herring', 'Mackerel', 'Sardine', 'Anchovy'] }
];
const NAME_POOL = ['Riya', 'Aman', 'Zoe', 'Kabir', 'Maya', 'Leo', 'Sana', 'Ivan', 'Tara', 'Omar', 'Nia', 'Felix', 'Priya', 'Diego'];
const ATTR_POOL = [
  { trait: 'height', comparative: 'taller', superlative: 'shortest' },
  { trait: 'age', comparative: 'older', superlative: 'youngest' },
  { trait: 'speed', comparative: 'faster', superlative: 'slowest' },
  { trait: 'score', comparative: 'higher-scoring', superlative: 'lowest-scoring' }
];

const logicalGenerators = [
  // odd one out
  (i) => {
    const set = CATEGORY_LISTS[i % CATEGORY_LISTS.length];
    const options = shuffleWith([set.odd, ...shuffleWith(set.group).slice(0, 3)]);
    return {
      question: 'Which word does NOT belong with the others?',
      options,
      answer: set.odd,
      explanation: `${set.group.slice(0,3).join(', ')} share a category; "${set.odd}" does not belong.`
    };
  },
  // ordering by attribute (find extreme)
  (i) => {
    const [a, b, c] = shuffleWith(NAME_POOL).slice(0, 3);
    const attr = ATTR_POOL[i % ATTR_POOL.length];
    const options = shuffleWith([a, b, c, 'Cannot be determined']);
    return {
      question: `${a} is ${attr.comparative} than ${b}. ${b} is ${attr.comparative} than ${c}. Who is the ${attr.superlative}?`,
      options,
      answer: c,
      explanation: `Since ${a} > ${b} > ${c} in ${attr.trait}, ${c} is the ${attr.superlative}.`
    };
  },
  // conditional logic (denying the antecedent)
  (i) => {
    const events = [
      ['it rains', 'the match is cancelled'],
      ['the alarm sounds', 'everyone leaves the building'],
      ['the price drops', 'sales increase'],
      ['the battery dies', 'the phone turns off'],
      ['the sun sets', 'the streetlights turn on'],
      ['the exam is hard', 'students study more'],
      ['the bridge is closed', 'traffic is rerouted']
    ];
    const [p, q] = events[i % events.length];
    const options = shuffleWith([
      `${q[0].toUpperCase()}${q.slice(1)} definitely happens`,
      `${q[0].toUpperCase()}${q.slice(1)} definitely does not happen`,
      'Cannot be determined from the given information',
      'The statement is a contradiction'
    ]);
    return {
      question: `If ${p}, then ${q}. Suppose ${p} did NOT happen. What can we conclude about whether ${q}?`,
      options,
      answer: 'Cannot be determined from the given information',
      explanation: `The rule only tells us what happens when "${p}" is true. When it is false, ${q} could still happen for another reason, so nothing is certain.`
    };
  },
  // family relation
  (i) => {
    const variants = [
      { a: 'father', b: 'mother', rel: 'grandfather' },
      { a: 'mother', b: 'father', rel: 'grandmother' },
      { a: 'brother', b: 'mother', rel: 'uncle' },
      { a: 'sister', b: 'father', rel: 'aunt' },
      { a: 'father', b: 'father', rel: 'grandfather' },
      { a: 'mother', b: 'mother', rel: 'grandmother' },
      { a: 'brother', b: 'father', rel: 'uncle' }
    ];
    const v = variants[i % variants.length];
    const [x, y, z] = shuffleWith(NAME_POOL).slice(0, 3);
    const options = shuffleWith([v.rel, 'cousin', 'nephew', 'in-law']);
    return {
      question: `${x} is the ${v.a} of ${y}. ${y} is the ${v.b} of ${z}. How is ${x} related to ${z}?`,
      options,
      answer: v.rel,
      explanation: `Following the chain of relationships, ${x} is ${z}'s ${v.rel}.`
    };
  },
  // valid syllogism
  (i) => {
    const triples = [
      ['musicians', 'artists', 'creative people'],
      ['dolphins', 'mammals', 'warm-blooded animals'],
      ['engineers', 'graduates', 'trained professionals'],
      ['roses', 'flowers', 'living plants'],
      ['novelists', 'writers', 'published authors'],
      ['spiders', 'arachnids', 'eight-legged creatures'],
      ['triangles', 'polygons', 'two-dimensional shapes']
    ];
    const [A, B, C] = triples[i % triples.length];
    const options = shuffleWith([
      `All ${A} are ${C}`,
      `All ${C} are ${A}`,
      `No ${A} are ${C}`,
      `Some ${C} are not ${A}`
    ]);
    return {
      question: `All ${A} are ${B}. All ${B} are ${C}. Which conclusion must be true?`,
      options,
      answer: `All ${A} are ${C}`,
      explanation: `Since every member of ${A} is in ${B}, and every member of ${B} is in ${C}, all ${A} must also be ${C}.`
    };
  },
  // if-and-only-if style deduction
  (i) => {
    const items = [
      ['the light is green', 'cars may proceed'],
      ['the tank is full', 'the gauge reads full'],
      ['the door is locked', 'the key does not turn freely'],
      ['the oven is hot', 'the indicator light is on'],
      ['the valve is open', 'water flows through the pipe'],
      ['the switch is on', 'the circuit is powered'],
      ['the seal is broken', 'air leaks from the container']
    ];
    const [p, q] = items[i % items.length];
    const options = shuffleWith([
      `${q[0].toUpperCase()}${q.slice(1)}`,
      `${q[0].toUpperCase()}${q.slice(1)} is false`,
      'Cannot be determined',
      'Both statements are false'
    ]);
    return {
      question: `${p[0].toUpperCase()}${p.slice(1)} if and only if ${q}. We observe that ${q}. What follows?`,
      options,
      answer: `${q[0].toUpperCase()}${q.slice(1)}`,
      explanation: `With an "if and only if" rule, observing ${q} guarantees ${p} — and the statement "${q}" itself is confirmed true.`
    };
  },
  // seating/order puzzle (three positions)
  (i) => {
    const [a, b, c] = shuffleWith(NAME_POOL).slice(0, 3);
    const options = shuffleWith([a, b, c]);
    return {
      question: `${a} finished the race before ${b}. ${b} finished before ${c}. Who finished first?`,
      options: shuffleWith([a, b, c, 'Cannot be determined']),
      answer: a,
      explanation: `The order is ${a}, then ${b}, then ${c} — so ${a} finished first.`
    };
  },
  // contrapositive reasoning
  (i) => {
    const items = [
      ['a shape is a square', 'it has four equal sides'],
      ['a number is divisible by 6', 'it is divisible by 3'],
      ['an animal is a whale', 'it is a mammal'],
      ['a metal is heated', 'it expands'],
      ['a triangle is equilateral', 'all its angles are equal'],
      ['a fruit is a citrus fruit', 'it contains vitamin C'],
      ['a liquid is water', 'it freezes at 0°C']
    ];
    const [p, q] = items[i % items.length];
    const options = shuffleWith([
      `It is not true that ${p}`,
      `It is true that ${p}`,
      'Cannot be determined',
      'The rule is violated'
    ]);
    return {
      question: `If ${p}, then ${q}. Suppose it is NOT the case that ${q}. What must be true?`,
      options,
      answer: `It is not true that ${p}`,
      explanation: `This is the contrapositive: if ${q} fails, then ${p} cannot be true either.`
    };
  },
  // either/or elimination
  (i) => {
    const pairs = [
      ['the package arrived by courier', 'the package arrived by mail'],
      ['the win was due to skill', 'the win was due to luck'],
      ['the light is red', 'the light is green'],
      ['the meeting is on Monday', 'the meeting is on Tuesday'],
      ['the plant died from overwatering', 'the plant died from underwatering'],
      ['the delay was caused by weather', 'the delay was caused by traffic'],
      ['the door was left open by a guest', 'the door was left open by the wind']
    ];
    const [a, b] = pairs[i % pairs.length];
    const options = shuffleWith([
      `${b[0].toUpperCase()}${b.slice(1)} must be true`,
      `${a[0].toUpperCase()}${a.slice(1)} must be true`,
      'Neither statement is true',
      'Both statements are true'
    ]);
    return {
      question: `It is either true that ${a}, or true that ${b} — but not both. We learn that it is NOT the case that ${a}. What follows?`,
      options,
      answer: `${b[0].toUpperCase()}${b.slice(1)} must be true`,
      explanation: `Since exactly one of the two statements is true and "${a}" is ruled out, "${b}" must be the true one.`
    };
  },
  // transitive numeric comparison
  (i) => {
    const [a, b, c] = shuffleWith(NAME_POOL).slice(0, 3);
    const vA = randInt(20, 90);
    let vB = randInt(20, 90);
    while (vB === vA) vB = randInt(20, 90);
    let vC = randInt(20, 90);
    while (vC === vA || vC === vB) vC = randInt(20, 90);
    const scores = { [a]: vA, [b]: vB, [c]: vC };
    const winner = Object.entries(scores).sort((x, y) => y[1] - x[1])[0][0];
    return {
      question: `${a} scored ${vA} points, ${b} scored ${vB} points, and ${c} scored ${vC} points. Who scored the most?`,
      options: shuffleWith([a, b, c, 'A tie between two players']),
      answer: winner,
      explanation: `${winner} has the highest score among the three (${scores[winner]} points).`
    };
  }
];

/* ---- 2.3 Visual & Abstract Patterns (40) ---- */

function svgArrow(rotationDeg, color) {
  return `<svg viewBox="0 0 60 60" width="56" height="56"><g transform="rotate(${rotationDeg} 30 30)"><line x1="30" y1="46" x2="30" y2="14" stroke="${color}" stroke-width="4" stroke-linecap="round"/><path d="M30 10 L22 22 L38 22 Z" fill="${color}"/></g></svg>`;
}
function svgPolygon(sides, color) {
  const pts = [];
  for (let k = 0; k < sides; k++) {
    const a = (Math.PI * 2 * k) / sides - Math.PI / 2;
    pts.push(`${(30 + 22 * Math.cos(a)).toFixed(1)},${(30 + 22 * Math.sin(a)).toFixed(1)}`);
  }
  return `<svg viewBox="0 0 60 60" width="56" height="56"><polygon points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linejoin="round"/></svg>`;
}
function svgDotsGrid(count, color) {
  let dots = '';
  const cols = 3;
  for (let d = 0; d < count; d++) {
    const cx = 12 + (d % cols) * 16;
    const cy = 12 + Math.floor(d / cols) * 16;
    dots += `<circle cx="${cx}" cy="${cy}" r="5" fill="${color}"/>`;
  }
  return `<svg viewBox="0 0 60 60" width="56" height="56">${dots}</svg>`;
}
function svgShape(kind, color, filled) {
  const fill = filled ? color : 'none';
  if (kind === 'circle') return `<svg viewBox="0 0 60 60" width="56" height="56"><circle cx="30" cy="30" r="20" fill="${fill}" stroke="${color}" stroke-width="3"/></svg>`;
  if (kind === 'square') return `<svg viewBox="0 0 60 60" width="56" height="56"><rect x="10" y="10" width="40" height="40" fill="${fill}" stroke="${color}" stroke-width="3"/></svg>`;
  if (kind === 'triangle') return `<svg viewBox="0 0 60 60" width="56" height="56"><polygon points="30,10 50,48 10,48" fill="${fill}" stroke="${color}" stroke-width="3"/></svg>`;
  if (kind === 'trapezoid') return `<svg viewBox="0 0 60 60" width="56" height="56"><polygon points="20,14 40,14 50,46 10,46" fill="${fill}" stroke="${color}" stroke-width="3"/></svg>`;
  return `<svg viewBox="0 0 60 60" width="56" height="56"></svg>`;
}

/* Palette-aligned SVG accent colours (sand / sage) */
const CYAN = '#D4C4A8', VIOLET = '#778D7A';

const visualGenerators = [
  // rotation sequence
  (i) => {
    const step = [30, 45, 60, 90][i % 4];
    const startDeg = randInt(0, 3) * step;
    const seq = [startDeg, startDeg + step, startDeg + 2 * step];
    const nextDeg = (startDeg + 3 * step) % 360;
    const distractDegs = uniqueNumberDistractors(nextDeg, 3, step).map(d => ((d % 360) + 360) % 360);
    const opts = shuffleWith([nextDeg, ...distractDegs]);
    return {
      question: 'The arrow rotates by a fixed angle each step. Which option shows the next rotation?',
      visual: `<div class="seq-row">${seq.map(d => svgArrow(d, CYAN)).join('<span class="seq-arrow">→</span>')}<span class="seq-arrow">→</span><span style="opacity:.4">?</span></div>`,
      options: opts.map(d => `${d}° rotation`),
      answer: `${nextDeg}° rotation`,
      explanation: `Each step rotates the arrow by ${step}°, so the next position is ${nextDeg}°.`
    };
  },
  // growing polygon sides
  (i) => {
    const startSides = randInt(3, 4);
    const seq = [startSides, startSides + 1, startSides + 2];
    const next = startSides + 3;
    const opts = shuffleWith([next, ...uniqueNumberDistractors(next, 3, 2)].filter(n => n >= 3));
    while (opts.length < 4) opts.push(next + opts.length + 3);
    return {
      question: 'Each shape gains one more side than the last. How many sides does the next shape have?',
      visual: `<div class="seq-row">${seq.map(s => svgPolygon(s, VIOLET)).join('<span class="seq-arrow">→</span>')}<span class="seq-arrow">→</span><span style="opacity:.4">?</span></div>`,
      options: opts.slice(0, 4).map(n => `${n} sides`),
      answer: `${next} sides`,
      explanation: `The number of sides increases by one each step: ${seq.join(', ')}, then ${next}.`
    };
  },
  // dot count matrix
  (i) => {
    const startCount = randInt(1, 3);
    const step = randInt(1, 2);
    const seq = [startCount, startCount + step, startCount + 2 * step];
    const next = startCount + 3 * step;

    const opts = shuffleWith([next, ...uniqueNumberDistractors(next, 3, 2)].filter(n => n > 0));
    let g = 0;
    while (opts.length < 4 && g++ < 50) {
      const c = next + g;
      if (!opts.includes(c)) opts.push(c);
    }

    return {
      question: 'How many dots should appear in the next panel?',
      visual: `<div class="seq-row">${seq.map(c => svgDotsGrid(c, CYAN)).join('<span class="seq-arrow">→</span>')}<span class="seq-arrow">→</span><span style="opacity:.4">?</span></div>`,
      options: opts.slice(0, 4).map(n => `${n} dots`),
      answer: `${next} dots`,
      explanation: `The dot count increases by ${step} each panel, so the next panel has ${next} dots.`
    };
  },
  // symmetry pick
  (i) => {
    const symmetric = randChoice(['circle', 'square']);
    const asymmetric = randChoice(['triangle', 'trapezoid']);
    const shapes = shuffleWith([symmetric, asymmetric, asymmetric === 'triangle' ? 'trapezoid' : 'triangle', symmetric === 'circle' ? 'square' : 'circle']);
    // ensure exactly one "most symmetric" — use circle/square as symmetric target, triangle/trapezoid as distractors
    const target = shapes.includes('circle') ? 'circle' : 'square';
    const labelFor = { circle: 'Circle', square: 'Square', triangle: 'Triangle', trapezoid: 'Trapezoid' };
    return {
      question: 'Which shape has a full line of symmetry down its exact center in every direction shown?',
      visual: `<div class="seq-row">${shapes.map(s => svgShape(s, VIOLET, false)).join('')}</div>`,
      options: shapes.map(s => labelFor[s]),
      answer: labelFor[target],
      explanation: `The ${labelFor[target].toLowerCase()} is symmetric along multiple axes, unlike the other shapes shown.`
    };
  },
  // shading/fill pattern
  (i) => {
    const kind = randChoice(['circle', 'square', 'triangle']);
    const pattern = [true, false, true]; // filled, empty, filled -> next empty
    const opts = shuffleWith(['Empty outline', 'Solid fill', 'Half-filled', 'Dotted fill']);
    return {
      question: 'The fill pattern alternates. What should the next shape look like?',
      visual: `<div class="seq-row">${pattern.map(f => svgShape(kind, CYAN, f)).join('<span class="seq-arrow">→</span>')}<span class="seq-arrow">→</span><span style="opacity:.4">?</span></div>`,
      options: opts,
      answer: 'Empty outline',
      explanation: 'The pattern alternates solid, empty, solid — so the next shape is an empty outline.'
    };
  },
  // shrinking polygon sides
  (i) => {
    const startSides = randInt(6, 8);
    const seq = [startSides, startSides - 1, startSides - 2];
    const next = startSides - 3;
    const opts = shuffleWith([next, ...uniqueNumberDistractors(next, 3, 2)].filter(n => n >= 3));
    while (opts.length < 4) opts.push(next + opts.length + 3);
    return {
      question: 'Each shape loses one side compared to the last. How many sides does the next shape have?',
      visual: `<div class="seq-row">${seq.map(s => svgPolygon(s, CYAN)).join('<span class="seq-arrow">→</span>')}<span class="seq-arrow">→</span><span style="opacity:.4">?</span></div>`,
      options: opts.slice(0, 4).map(n => `${n} sides`),
      answer: `${next} sides`,
      explanation: `The number of sides decreases by one each step: ${seq.join(', ')}, then ${next}.`
    };
  },
  // color cycle
  (i) => {
    const colors = [CYAN, VIOLET, '#415A77'];
    const names = { [CYAN]: 'Sand', [VIOLET]: 'Sage', '#415A77': 'Slate' };
    const seq = [colors[0], colors[1], colors[2]];
    const next = colors[0];
    const swatch = (c) => `<span style="display:inline-block;width:44px;height:44px;border-radius:8px;background:${c};border:1px solid rgba(255,255,255,.2)"></span>`;
    return {
      question: 'The colors cycle in a fixed order. Which color comes next?',
      visual: `<div class="seq-row">${seq.map(swatch).join('<span class="seq-arrow">→</span>')}<span class="seq-arrow">→</span><span style="opacity:.4">?</span></div>`,
      options: shuffleWith([...Object.values(names), 'Clay']),
      answer: names[next],
      explanation: `The colors cycle Sand → Sage → Slate → Sand, so the next color is ${names[next]}.`
    };
  }
];

/* ---- 2.4 Verbal Reasoning (30) ---- */

const ANALOGY_PAIRS = [
  ['Hot', 'Cold', 'Fast', 'Slow', 'antonym'],
  ['Happy', 'Joyful', 'Sad', 'Sorrowful', 'synonym'],
  ['Pen', 'Write', 'Knife', 'Cut', 'function'],
  ['Doctor', 'Hospital', 'Teacher', 'School', 'workplace'],
  ['Puppy', 'Dog', 'Kitten', 'Cat', 'baby-adult'],
  ['Chef', 'Kitchen', 'Pilot', 'Cockpit', 'workplace'],
  ['Author', 'Book', 'Composer', 'Symphony', 'creator-work'],
  ['Leaf', 'Tree', 'Petal', 'Flower', 'part-whole'],
  ['Fish', 'Water', 'Bird', 'Sky', 'habitat'],
  ['Big', 'Huge', 'Small', 'Tiny', 'synonym'],
  ['Tailor', 'Clothes', 'Carpenter', 'Furniture', 'maker-product'],
  ['Ice', 'Water', 'Water', 'Steam', 'state-change'],
  ['Bright', 'Dark', 'Loud', 'Quiet', 'antonym'],
  ['Farmer', 'Field', 'Sailor', 'Ship', 'workplace'],
  ['Painter', 'Canvas', 'Sculptor', 'Marble', 'creator-medium'],
  ['Bee', 'Hive', 'Ant', 'Colony', 'habitat'],
  ['Key', 'Unlock', 'Broom', 'Sweep', 'function'],
  ['Tiny', 'Minuscule', 'Loud', 'Deafening', 'synonym'],
  ['Wing', 'Bird', 'Fin', 'Fish', 'part-whole'],
  ['Generous', 'Stingy', 'Brave', 'Cowardly', 'antonym']
];
const CLASSIFY_SETS = [
  { odd: 'Sprint', group: ['Whisper', 'Murmur', 'Mutter', 'Mumble'] },
  { odd: 'Devour', group: ['Glimpse', 'Glance', 'Peek', 'Peer'] },
  { odd: 'Enormous', group: ['Content', 'Cheerful', 'Delighted', 'Glad'] },
  { odd: 'Frigid', group: ['Swift', 'Rapid', 'Speedy', 'Brisk'] },
  { odd: 'Silence', group: ['Radiant', 'Luminous', 'Gleaming', 'Glowing'] },
  { odd: 'Boulder', group: ['Timid', 'Meek', 'Bashful', 'Shy'] },
  { odd: 'Thunder', group: ['Ancient', 'Antique', 'Vintage', 'Archaic'] },
  { odd: 'Feather', group: ['Furious', 'Livid', 'Irate', 'Enraged'] },
  { odd: 'Marble', group: ['Nimble', 'Agile', 'Lithe', 'Sprightly'] },
  { odd: 'Anchor', group: ['Vast', 'Immense', 'Colossal', 'Gigantic'] }
];

const verbalGenerators = [
  // analogy
  (i) => {
    const [a, b, c, d] = ANALOGY_PAIRS[i % ANALOGY_PAIRS.length];

    const seenA = new Set([d]);
    const distractors = [];
    shuffleWith(ANALOGY_PAIRS.filter((_, idx) => idx !== (i % ANALOGY_PAIRS.length)))
      .forEach(p => { if (distractors.length < 3 && !seenA.has(p[3])) { seenA.add(p[3]); distractors.push(p[3]); } });

    const opts = shuffleWith([d, ...distractors]);
    return {
      question: `${a} is to ${b} as ${c} is to ___?`,
      options: opts,
      answer: d,
      explanation: `The relationship between ${a} and ${b} mirrors the relationship between ${c} and ${d}.`
    };
  },
  // letter sequence (skip pattern)
  (i) => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const skip = randInt(1, 3);
    const startIdx = randInt(0, 6);
    const idxs = [startIdx, startIdx + skip + 1, startIdx + 2 * (skip + 1), startIdx + 3 * (skip + 1)];
    const nextIdx = startIdx + 4 * (skip + 1);
    if (nextIdx >= 26) return verbalGenerators[1](i + 1); // guard: regenerate with safer params
    const seq = idxs.map(x => alphabet[x]);
    const next = alphabet[nextIdx];
    const distractorLettersRaw = uniqueNumberDistractors(nextIdx, 3, skip + 2).filter(x => x >= 0 && x < 26).map(x => alphabet[x]);
    const seenL = new Set([next, ...distractorLettersRaw]);
    const distractorLetters = [...distractorLettersRaw];
    let guardF = 0;
    while (distractorLetters.length < 3 && guardF < 50) {
      guardF++;
      const cand = alphabet[randInt(0, 25)];
      if (!seenL.has(cand)) { seenL.add(cand); distractorLetters.push(cand); }
    }
    const opts = shuffleWith([next, ...distractorLetters.slice(0, 3)]);
    return {
      question: 'Which letter comes next in the sequence?',
      visual: seqVisual(seq),
      options: opts,
      answer: next,
      explanation: `The sequence skips ${skip} letter${skip > 1 ? 's' : ''} each time, so the next letter is ${next}.`
    };
  },
  // classification (odd word out)
  (i) => {
    const set = CLASSIFY_SETS[i % CLASSIFY_SETS.length];
    const options = shuffleWith([set.odd, ...shuffleWith(set.group).slice(0, 3)]);
    return {
      question: 'Which word does NOT belong with the others in meaning?',
      options,
      answer: set.odd,
      explanation: `${set.group.slice(0,3).join(', ')} are close in meaning; "${set.odd}" stands apart.`
    };
  },
  // fill-in-the-blank relationship
  (i) => {
    const idx = (i + 5) % ANALOGY_PAIRS.length;
    const [a, b, c, d] = ANALOGY_PAIRS[idx];
    const seen = new Set([b]);
    const distractors = [];
    shuffleWith(ANALOGY_PAIRS.filter((_, pIdx) => pIdx !== idx)).forEach(p => {
      if (distractors.length < 3 && !seen.has(p[1])) { seen.add(p[1]); distractors.push(p[1]); }
    });
    const fillerWords = ['River', 'Mountain', 'Bridge', 'Garden', 'Lantern', 'Compass'];
    let fi = 0;
    while (distractors.length < 3) {
      const w = fillerWords[fi++ % fillerWords.length];
      if (!seen.has(w)) { seen.add(w); distractors.push(w); }
    }
    const opts = shuffleWith([b, ...distractors]);
    return {
      question: `Complete the relationship: ${c} relates to ${d} the same way ${a} relates to ___?`,
      options: opts,
      answer: b,
      explanation: `${a} and ${b} share the same relationship as ${c} and ${d}.`
    };
  },
  // reverse letter sequence
  (i) => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const skip = randInt(1, 2);
    const startIdx = randInt(20, 25);
    const idxs = [startIdx, startIdx - (skip + 1), startIdx - 2 * (skip + 1)];
    const nextIdx = startIdx - 3 * (skip + 1);
    if (nextIdx < 0) return { question: 'Which letter comes before both B and D in the alphabet?', options: shuffleWith(['C', 'A', 'E', 'F']), answer: 'C', explanation: 'C sits directly between B and D.' };
    const seq = idxs.map(x => alphabet[x]);
    const next = alphabet[nextIdx];
    const distractorLettersRaw2 = uniqueNumberDistractors(nextIdx, 3, skip + 2).filter(x => x >= 0 && x < 26).map(x => alphabet[x]);
    const seenL2 = new Set([next, ...distractorLettersRaw2]);
    const distractorLetters = [...distractorLettersRaw2];
    let guardR = 0;
    while (distractorLetters.length < 3 && guardR < 50) {
      guardR++;
      const cand = alphabet[randInt(0, 25)];
      if (!seenL2.has(cand)) { seenL2.add(cand); distractorLetters.push(cand); }
    }
    const opts = shuffleWith([next, ...distractorLetters.slice(0, 3)]);
    return {
      question: 'Which letter comes next in the sequence? It counts backward through the alphabet.',
      visual: seqVisual(seq),
      options: opts,
      answer: next,
      explanation: `The sequence moves backward, skipping ${skip} letter${skip > 1 ? 's' : ''} each time, so the next letter is ${next}.`
    };
  },
  // word-pair matching (synonym vs antonym identification)
  (i) => {
    const idx = i % ANALOGY_PAIRS.length;
    const [a, b, , , type] = ANALOGY_PAIRS[idx];
    if (type !== 'synonym' && type !== 'antonym') return verbalGenerators[3](i + 1);
    const options = shuffleWith(['Synonyms', 'Antonyms', 'Unrelated words', 'Homophones']);
    const answer = type === 'synonym' ? 'Synonyms' : 'Antonyms';
    return {
      question: `What is the relationship between the words "${a}" and "${b}"?`,
      options,
      answer,
      explanation: `"${a}" and "${b}" are ${answer.toLowerCase()}.`
    };
  }
];

/* ---- 2.5 Memory & Sequence (25) ---- */

const SYMBOLS = ['★', '●', '▲', '■', '◆', '✚', '☀', '☾', '✿', '♫'];
const memoryGenerators = [
  // recall position
  (i) => {
    const len = 4 + Math.min(2, Math.floor(i / 8));
    const seq = Array.from({ length: len }, () => randInt(1, 9));
    const pos = randInt(1, len);
    const answer = seq[pos - 1];
    const seen = new Set([answer]);
    const distractors = uniqueNumberDistractors(answer, 3, 4).filter(n => n >= 0 && n <= 9 && !seen.has(n) && seen.add(n));
    let guardN = 0;
    while (distractors.length < 3 && guardN < 50) {
      guardN++;
      const cand = randInt(0, 9);
      if (!seen.has(cand)) { seen.add(cand); distractors.push(cand); }
    }
    const opts = shuffleWith([answer, ...distractors.slice(0, 3)]);
    return {
      question: `Study this number sequence, then answer: what was the ${ordinal(pos)} number shown?`,
      visual: seqVisualPlain(seq),
      memory: true,
      options: opts.map(String),
      answer: String(answer),
      explanation: `The ${ordinal(pos)} number in the sequence was ${answer}.`
    };
  },
  // recall full sequence
  (i) => {
    const len = 3 + Math.min(2, Math.floor(i / 10));
    const seq = Array.from({ length: len }, () => randInt(1, 9));
    const correctStr = seq.join('-');
    const wrongs = new Set();
    while (wrongs.size < 3) {
      const alt = seq.slice();
      const idx = randInt(0, len - 1);
      alt[idx] = (alt[idx] + randInt(1, 4)) % 10;
      const s = alt.join('-');
      if (s !== correctStr) wrongs.add(s);
    }
    const opts = shuffleWith([correctStr, ...wrongs]);
    return {
      question: 'Study this sequence, then select the exact sequence you saw.',
      visual: seqVisualPlain(seq),
      memory: true,
      options: opts,
      answer: correctStr,
      explanation: `The exact sequence shown was ${correctStr}.`
    };
  },
  // symbol memory
  (i) => {
    const len = 4;
    const chosen = shuffleWith(SYMBOLS).slice(0, len);
    const pos = randInt(1, len);
    const answer = chosen[pos - 1];
    const distractors = shuffleWith(SYMBOLS.filter(s => !chosen.includes(s))).slice(0, 3);
    const opts = shuffleWith([answer, ...distractors]);
    return {
      question: `Study these symbols, then answer: which symbol appeared ${ordinal(pos)}?`,
      visual: seqVisualPlain(chosen),
      memory: true,
      options: opts,
      answer,
      explanation: `The ${ordinal(pos)} symbol shown was ${answer}.`
    };
  },
  // order reconstruction
  (i) => {
    const len = 4;
    const chosen = shuffleWith(SYMBOLS).slice(0, len);
    const correctStr = chosen.join(' ');
    const wrongs = new Set();
    let guard = 0;
    while (wrongs.size < 3 && guard < 30) {
      guard++;
      const alt = shuffleWith(chosen);
      const s = alt.join(' ');
      if (s !== correctStr) wrongs.add(s);
    }
    const opts = shuffleWith([correctStr, ...wrongs]);
    return {
      question: 'Study the order of these symbols, then select the correct original order.',
      visual: seqVisualPlain(chosen),
      memory: true,
      options: opts,
      answer: correctStr,
      explanation: `The symbols originally appeared in this order: ${correctStr}.`
    };
  },
  // count occurrences
  (i) => {
    const len = 6;
    const target = randChoice(SYMBOLS);
    const others = SYMBOLS.filter(s => s !== target);
    const occurrences = randInt(2, 3);
    const seqArr = [];
    for (let k = 0; k < occurrences; k++) seqArr.push(target);
    while (seqArr.length < len) seqArr.push(randChoice(others));
    const chosen = shuffleWith(seqArr);
    const answer = chosen.filter(s => s === target).length;
    const seen = new Set([answer]);
    const distractors = uniqueNumberDistractors(answer, 3, 2).filter(n => n >= 0 && n <= len && !seen.has(n) && seen.add(n));
    let guardC = 0;
    while (distractors.length < 3 && guardC < 50) {
      guardC++;
      const cand = randInt(0, len);
      if (!seen.has(cand)) { seen.add(cand); distractors.push(cand); }
    }
    const opts = shuffleWith([answer, ...distractors.slice(0, 3)]);
    return {
      question: `Study this row of symbols, then answer: how many times did ${target} appear?`,
      visual: seqVisualPlain(chosen),
      memory: true,
      options: opts.map(String),
      answer: String(answer),
      explanation: `${target} appeared ${answer} time${answer === 1 ? '' : 's'} in the row.`
    };
  },
  // recall the last item
  (i) => {
    const len = 5;
    const seq = Array.from({ length: len }, () => randInt(1, 9));
    const answer = seq[len - 1];
    const seen = new Set([answer]);
    const distractors = [];
    let guardL = 0;
    while (distractors.length < 3 && guardL < 50) {
      guardL++;
      const cand = randInt(0, 9);
      if (!seen.has(cand)) { seen.add(cand); distractors.push(cand); }
    }
    const opts = shuffleWith([answer, ...distractors]);
    return {
      question: 'Study this number sequence, then answer: what was the LAST number shown?',
      visual: seqVisualPlain(seq),
      memory: true,
      options: opts.map(String),
      answer: String(answer),
      explanation: `The last number in the sequence was ${answer}.`
    };
  }
];
function ordinal(n) { return ['zeroth','first','second','third','fourth','fifth','sixth'][n] || `${n}th`; }
function seqVisualPlain(items) {
  return `<div class="seq-row">${items.map(v => `<span class="seq-box">${escapeHtml(v)}</span>`).join('')}</div>`;
}

/* ---- 2.6 Processing & Quick Reasoning (25) ---- */

const processingGenerators = [
  // largest/smallest of four numbers
  (i) => {
    const nums = new Set();
    while (nums.size < 4) nums.add(randInt(10, 999));
    const arr = [...nums];
    const askMax = i % 2 === 0;
    const answer = askMax ? Math.max(...arr) : Math.min(...arr);
    return {
      question: `Which of these numbers is the ${askMax ? 'largest' : 'smallest'}?`,
      options: shuffleWith(arr).map(String),
      answer: String(answer),
      explanation: `${answer} is the ${askMax ? 'largest' : 'smallest'} of the four numbers shown.`
    };
  },
  // quick arithmetic
  (i) => {
    const a = randInt(6, 20), b = randInt(2, 12);
    const op = randChoice(['+', '-', '×']);
    let answer;
    if (op === '+') answer = a + b;
    else if (op === '-') answer = a - b;
    else answer = a * b;
    const spread = op === '×' ? Math.max(4, Math.round(answer * 0.15)) : 5;
    const opts = shuffleWith([answer, ...uniqueNumberDistractors(answer, 3, spread)]);
    return {
      question: `Quick calculation — what is ${a} ${op} ${b}?`,
      options: opts.map(String),
      answer: String(answer),
      explanation: `${a} ${op} ${b} = ${answer}.`
    };
  },
  // exact string match
  (i) => {
    const chars = 'AB12CD34';
    const target = Array.from({ length: 6 }, () => randChoice(chars.split(''))).join('');
    function mutate(str) {
      const arr = str.split('');
      const idx = randInt(0, arr.length - 1);
      let repl;
      do { repl = randChoice(chars.split('')); } while (repl === arr[idx]);
      arr[idx] = repl;
      return arr.join('');
    }
    const wrongs = new Set();
    while (wrongs.size < 3) wrongs.add(mutate(target));
    const opts = shuffleWith([target, ...wrongs]);
    return {
      question: `Which code exactly matches this target: "${target}" ?`,
      options: opts,
      answer: target,
      explanation: `Only "${target}" matches the target exactly — the others differ by one character.`
    };
  },
  // color swatch matching
  (i) => {
    const base = randChoice(['#1B263B', '#415A77', '#778D7A', '#D4C4A8']);
    function shade(hex, amt) {
      const num = parseInt(hex.slice(1), 16);
      let r = (num >> 16) + amt, g = ((num >> 8) & 0xff) + amt, b = (num & 0xff) + amt;
      r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }
    const variants = shuffleWith([base, shade(base, 18), shade(base, -18), shade(base, 30)]);
    const swatch = (c) => `<span style="display:inline-block;width:44px;height:44px;border-radius:8px;background:${c};border:1px solid rgba(255,255,255,.2)"></span>`;
    return {
      question: 'Which swatch is the exact same color as the target shown?',
      visual: `<div class="seq-row">Target: ${swatch(base)}</div>`,
      options: variants.map(c => `${swatch(c)}`),
      answer: swatch(base),
      explanation: 'Only one swatch is an exact pixel match — the others are slightly lighter or darker.'
    };
  },
  // odd number out (parity spotting)
  (i) => {
    const isOddTarget = i % 2 === 0;
    const evens = new Set(); const odds = new Set();
    while (evens.size < 3) evens.add(randInt(1, 50) * 2);
    while (odds.size < 3) odds.add(randInt(1, 50) * 2 + 1);
    const majority = isOddTarget ? [...evens] : [...odds];
    const minority = isOddTarget ? [...odds][0] : [...evens][0];
    const arr = shuffleWith([...majority, minority]);
    return {
      question: `Which number is the ${isOddTarget ? 'only odd' : 'only even'} number in this group?`,
      options: arr.map(String),
      answer: String(minority),
      explanation: `${minority} is ${isOddTarget ? 'odd' : 'even'} while the rest are ${isOddTarget ? 'even' : 'odd'}.`
    };
  },
  // quick ranking (2nd largest/smallest)
  (i) => {
    const nums = new Set();
    while (nums.size < 4) nums.add(randInt(10, 500));
    const arr = [...nums].sort((a, b) => b - a);
    const askSecondLargest = i % 2 === 0;
    const answer = askSecondLargest ? arr[1] : arr[arr.length - 2];
    return {
      question: `Which of these numbers is the ${askSecondLargest ? 'second largest' : 'second smallest'}?`,
      options: shuffleWith(arr).map(String),
      answer: String(answer),
      explanation: `Sorted from largest to smallest: ${arr.join(', ')}. The ${askSecondLargest ? 'second largest' : 'second smallest'} is ${answer}.`
    };
  }
];

/* ---- Assemble the question bank ---- */
const CATEGORY_COUNTS = {
  'Number Pattern': 70,
  'Logical Reasoning': 70,
  'Visual & Abstract': 70,
  'Verbal Reasoning': 55,
  'Memory & Sequence': 45,
  'Processing Speed': 45
};
const QUESTION_BANK = [
  ...buildCategory('Number Pattern', 'Pattern Recognition', CATEGORY_COUNTS['Number Pattern'], numberGenerators),
  ...buildCategory('Logical Reasoning', 'Logical Reasoning', CATEGORY_COUNTS['Logical Reasoning'], logicalGenerators),
  ...buildCategory('Visual & Abstract', 'Pattern Recognition', CATEGORY_COUNTS['Visual & Abstract'], visualGenerators),
  ...buildCategory('Verbal Reasoning', 'Verbal Reasoning', CATEGORY_COUNTS['Verbal Reasoning'], verbalGenerators),
  ...buildCategory('Memory & Sequence', 'Memory', CATEGORY_COUNTS['Memory & Sequence'], memoryGenerators),
  ...buildCategory('Processing Speed', 'Processing Speed', CATEGORY_COUNTS['Processing Speed'], processingGenerators)
];

/* ---------------------------------------------------------
   3. VALIDATION (development-time sanity checks)
   --------------------------------------------------------- */
function validateQuestionBank(bank) {
  const errors = [];
  const ids = new Set();
  const seenText = new Set();
  bank.forEach(q => {
    if (ids.has(q.id)) errors.push(`Duplicate id ${q.id}`);
    ids.add(q.id);
    if (!q.category || !q.difficulty || !q.question) errors.push(`Missing core fields on id ${q.id}`);
    if (!Array.isArray(q.options) || q.options.length !== 4) errors.push(`Question ${q.id} does not have exactly 4 options`);
    if (new Set(q.options).size !== q.options.length) errors.push(`Question ${q.id} has duplicate options`);
    if (!q.options.includes(q.answer)) errors.push(`Question ${q.id} answer not present in options`);
    if (!q.explanation) errors.push(`Question ${q.id} missing explanation`);
    const key = q.category + '::' + q.question;
    seenText.add(key);
  });
  const expectedTotal = Object.values(CATEGORY_COUNTS).reduce((a, b) => a + b, 0);
  if (bank.length !== expectedTotal) errors.push(`Expected ${expectedTotal} questions, found ${bank.length}`);
  if (errors.length) {
    console.error('IQ Tester question bank validation failed:', errors);
  }
  return errors.length === 0;
}
const BANK_IS_VALID = validateQuestionBank(QUESTION_BANK);

/* ---------------------------------------------------------
   4. APP STATE & VIEW ROUTING
   --------------------------------------------------------- */
const state = {
  view: 'landing',
  test: null,   // active test session
  lastResult: null
};

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById('view-' + name);
  if (el) el.classList.add('active');
  state.view = name;
  window.scrollTo({ top: 0, behavior: 'auto' });
  if (name === 'test') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  } else {
    document.removeEventListener('visibilitychange', onVisibilityChange);
  }
  if (name === 'history') renderHistory();
}

function scrollToId(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

/* ---------------------------------------------------------
   5. LANDING / NAV INTERACTIONS
   --------------------------------------------------------- */
function initHeroDial() {
  const progress = document.getElementById('heroDialProgress');
  const ticksGroup = document.getElementById('heroTicks');
  const CIRC = 2 * Math.PI * 96;
  progress.style.strokeDasharray = String(CIRC);
  // sample score ~128/160 scaled to arc
  const pct = Math.min(1, (128 - 55) / (160 - 55));
  requestAnimationFrame(() => {
    progress.style.strokeDashoffset = String(CIRC * (1 - pct));
  });
  let ticksSvg = '';
  for (let t = 0; t < 40; t++) {
    const a = (Math.PI * 2 * t) / 40;
    const r1 = 108, r2 = 114;
    const x1 = 110 + r1 * Math.cos(a), y1 = 110 + r1 * Math.sin(a);
    const x2 = 110 + r2 * Math.cos(a), y2 = 110 + r2 * Math.sin(a);
    ticksSvg += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
  }
  ticksGroup.innerHTML = ticksSvg;
}

function initNav() {
  document.getElementById('navStartBtn').addEventListener('click', () => showView('select'));
  document.getElementById('heroStartBtn').addEventListener('click', () => showView('select'));
  document.getElementById('historyStartBtn').addEventListener('click', () => showView('select'));
  document.getElementById('howBtn').addEventListener('click', () => { showView('landing'); scrollToId('how'); });
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.addEventListener('click', (e) => {
      const view = a.dataset.view;
      if (view === 'landing') {
        e.preventDefault();
        showView('landing');
        if (a.dataset.scroll) setTimeout(() => scrollToId(a.dataset.scroll), 50);
        else scrollToId('top');
      } else if (view === 'history') {
        e.preventDefault();
        showView('history');
      }
    });
  });
  document.getElementById('selectBackBtn').addEventListener('click', () => showView('landing'));
  document.getElementById('pickQuick').addEventListener('click', () => startTest(10));
  document.getElementById('pickFull').addEventListener('click', () => startTest(15));
  document.getElementById('retakeBtn').addEventListener('click', () => showView('select'));
  document.getElementById('viewHistoryBtn').addEventListener('click', () => showView('history'));

  const toggle = document.getElementById('themeToggle');
  toggle.addEventListener('click', () => {
    const isLight = document.body.getAttribute('data-theme') === 'light';
    document.body.setAttribute('data-theme', isLight ? 'dark' : 'light');
    toggle.setAttribute('aria-pressed', String(!isLight));
    try { localStorage.setItem('iqlab_theme', isLight ? 'dark' : 'light'); } catch (e) {}
  });
  try {
    const saved = localStorage.getItem('iqlab_theme');
    if (saved) { document.body.setAttribute('data-theme', saved); toggle.setAttribute('aria-pressed', String(saved === 'light')); }
  } catch (e) {}
}

/* ---------------------------------------------------------
   6. TEST ENGINE
   --------------------------------------------------------- */
const DISTRIBUTION = {
  10: { 'Number Pattern': 2, 'Logical Reasoning': 2, 'Visual & Abstract': 2, 'Verbal Reasoning': 1, 'Memory & Sequence': 1, 'Processing Speed': 2 },
  15: { 'Number Pattern': 3, 'Logical Reasoning': 3, 'Visual & Abstract': 3, 'Verbal Reasoning': 2, 'Memory & Sequence': 2, 'Processing Speed': 2 }
};
const ADAPTIVE_SCHEDULE_10 = ['Easy','Easy','Medium','Medium','Medium','Hard','Hard','Expert','Hard','Medium'];
const ADAPTIVE_SCHEDULE_15 = ['Easy','Easy','Medium','Medium','Medium','Hard','Hard','Expert','Expert','Hard','Hard','Medium','Expert','Hard','Medium'];

function getRecentIds() {
  try { return JSON.parse(localStorage.getItem('iqlab_recent_qids') || '[]'); } catch (e) { return []; }
}
function saveRecentIds(ids) {
  try {
    const merged = [...ids, ...getRecentIds()].slice(0, 80);
    localStorage.setItem('iqlab_recent_qids', JSON.stringify(merged));
  } catch (e) {}
}

function pickBalancedPool(count) {
  const dist = DISTRIBUTION[count];
  const recent = new Set(getRecentIds());
  const pool = [];
  Object.entries(dist).forEach(([cat, n]) => {
    const all = QUESTION_BANK.filter(q => q.category === cat);
    const fresh = shuffleWith(all.filter(q => !recent.has(q.id)));
    const stale = shuffleWith(all.filter(q => recent.has(q.id)));
    const picked = [...fresh, ...stale].slice(0, n);
    pool.push(...picked);
  });
  return pool;
}

function orderByAdaptiveSchedule(pool, count) {
  const schedule = count === 15 ? ADAPTIVE_SCHEDULE_15 : ADAPTIVE_SCHEDULE_10;
  const remaining = pool.slice();
  const ordered = [];
  schedule.forEach(targetDiff => {
    if (!remaining.length) return;
    let idx = remaining.findIndex(q => q.difficulty === targetDiff);
    if (idx === -1) {
      // pick the closest available difficulty
      const order = ['Easy','Medium','Hard','Expert'];
      const targetIdx = order.indexOf(targetDiff);
      let best = 0, bestDist = Infinity;
      remaining.forEach((q, i2) => {
        const d = Math.abs(order.indexOf(q.difficulty) - targetIdx);
        if (d < bestDist) { bestDist = d; best = i2; }
      });
      idx = best;
    }
    ordered.push(remaining[idx]);
    remaining.splice(idx, 1);
  });
  ordered.push(...remaining);
  return ordered;
}

function startTest(count) {
  const pool = pickBalancedPool(count);
  const ordered = orderByAdaptiveSchedule(pool, count).slice(0, count);
  saveRecentIds(ordered.map(q => q.id));
  state.test = {
    count,
    questions: ordered,
    index: 0,
    responses: [], // {question, chosen, correct, timeTaken, timedOut}
    currentOptionOrder: null,
    timer: null,
    startedAt: Date.now(),
    memoryHideTimeout: null
  };
  showView('test');
  renderQuestion();
}

function currentQuestion() {
  return state.test.questions[state.test.index];
}

function renderQuestion() {
  const t = state.test;
  const q = currentQuestion();
  document.getElementById('qCounter').textContent = `QUESTION ${String(t.index + 1).padStart(2, '0')} / ${t.count}`;
  document.getElementById('qProgressFill').style.width = `${(t.index / t.count) * 100}%`;
  document.getElementById('qCategory').textContent = q.category;
  const diffEl = document.getElementById('qDifficulty');
  diffEl.textContent = q.difficulty;
  diffEl.dataset.level = q.difficulty;
  document.getElementById('qFlavor').textContent = flavorFor(t.index, t.count, q);
  document.getElementById('qText').textContent = q.question;

  const visualEl = document.getElementById('qVisual');
  visualEl.innerHTML = q.visual || '';

  const optionsEl = document.getElementById('qOptions');
  optionsEl.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D'];
  const order = shuffleWith(q.options.map((opt, idx) => idx));
  t.currentOptionOrder = order;
  order.forEach((optIdx, pos) => {
    const btn = document.createElement('button');
    btn.className = 'q-option';
    btn.setAttribute('data-value', q.options[optIdx]);
    btn.innerHTML = `<span class="opt-letter">${letters[pos]}</span><span class="opt-text">${q.options[optIdx]}</span>`;
    btn.addEventListener('click', () => handleAnswer(q.options[optIdx], btn));
    optionsEl.appendChild(btn);
  });

  // memory-hide behaviour: briefly show, then mask
  if (q.memory && visualEl.innerHTML) {
    clearTimeout(t.memoryHideTimeout);
    visualEl.style.filter = '';
    t.memoryHideTimeout = setTimeout(() => {
      const boxes = visualEl.querySelectorAll('.seq-box');
      boxes.forEach(b => { b.dataset.orig = b.textContent; b.textContent = '?'; });
      visualEl.classList.add('memory-hidden');
    }, 4000);
  }

  startTimer(q.timeLimit);
}

function flavorFor(index, total, q) {
  if (index === total - 1) return 'Final challenge.';
  if (index === 0) return `Your mind has ${q.timeLimit} seconds.`;
  if (q.difficulty === 'Expert' || q.difficulty === 'Hard') return 'Think fast.';
  return 'Stay sharp.';
}

function startTimer(seconds) {
  const t = state.test;
  clearInterval(t.timer);
  const ring = document.getElementById('ringProgress');
  const CIRC = 2 * Math.PI * 52;
  ring.style.strokeDasharray = String(CIRC);
  ring.style.strokeDashoffset = '0';
  ring.classList.remove('warn', 'danger');
  const timerText = document.getElementById('qTimerText');
  timerText.classList.remove('warn', 'danger');

  let remaining = seconds;
  const total = seconds;
  const questionStart = Date.now();
  t.questionStart = questionStart;
  updateTimerUI(remaining, total);

  t.timer = setInterval(() => {
    remaining -= 0.1;
    if (remaining <= 0) {
      remaining = 0;
      updateTimerUI(remaining, total);
      clearInterval(t.timer);
      handleTimeout();
      return;
    }
    updateTimerUI(remaining, total);
  }, 100);
}

function updateTimerUI(remaining, total) {
  const ring = document.getElementById('ringProgress');
  const CIRC = 2 * Math.PI * 52;
  const pct = remaining / total;
  ring.style.strokeDashoffset = String(CIRC * (1 - pct));
  document.getElementById('ringNumber').textContent = Math.ceil(remaining);
  const timerText = document.getElementById('qTimerText');
  timerText.textContent = `${remaining.toFixed(1)}s`;
  ring.classList.remove('warn', 'danger');
  timerText.classList.remove('warn', 'danger');
  if (remaining <= 5) { ring.classList.add('danger'); timerText.classList.add('danger'); }
  else if (remaining <= 8) { ring.classList.add('warn'); timerText.classList.add('warn'); }
}

let __answerLocked = false;
function handleAnswer(value, btnEl) {
  if (__answerLocked) return;
  __answerLocked = true;
  const t = state.test;
  clearInterval(t.timer);
  const q = currentQuestion();
  const timeTaken = Math.min(q.timeLimit, (Date.now() - t.questionStart) / 1000);
  const correct = value === q.answer;

  document.querySelectorAll('#qOptions .q-option').forEach(b => { b.disabled = true; });
  btnEl.classList.add('selected');

  t.responses.push({ question: q, chosen: value, correct, timeTaken, timedOut: false });
  advanceSoon();
}

function handleTimeout() {
  if (__answerLocked) return;
  __answerLocked = true;
  const t = state.test;
  const q = currentQuestion();
  document.querySelectorAll('#qOptions .q-option').forEach(b => { b.disabled = true; b.classList.add('timeout'); });
  t.responses.push({ question: q, chosen: null, correct: false, timeTaken: q.timeLimit, timedOut: true });
  advanceSoon();
}

function advanceSoon() {
  setTimeout(() => {
    __answerLocked = false;
    const t = state.test;
    t.index++;
    if (t.index >= t.questions.length) {
      finishTest();
    } else {
      renderQuestion();
    }
  }, 550);
}

function onVisibilityChange() {
  if (document.hidden && state.view === 'test') {
    const warn = document.getElementById('focusWarning');
    warn.classList.add('show');
    clearTimeout(window.__focusWarnTimeout);
    window.__focusWarnTimeout = setTimeout(() => warn.classList.remove('show'), 3500);
  }
}

/* ---------------------------------------------------------
   7. SCORING ENGINE
   ---------------------------------------------------------
   Composite score built from:
     - accuracy (weighted by question difficulty)
     - response speed (bonus for fast CORRECT answers only)
     - category performance (used for breakdown, not raw score)
     - consistency (low variance in response time on correct answers)
     - unanswered questions (extra penalty beyond the zero points they earn)
   Formula is deterministic — no randomness at scoring time.
   --------------------------------------------------------- */
function computeResults(test) {
  const responses = test.responses;
  const totalWeight = responses.reduce((s, r) => s + r.question.weight, 0);

  let earned = 0;
  const correctTimes = [];
  responses.forEach(r => {
    if (r.correct) {
      const speedBonus = Math.max(0, (r.question.timeLimit - r.timeTaken) / r.question.timeLimit); // 0..1
      const points = r.question.weight * (1 + speedBonus * 0.4); // up to +40% for instant answers
      earned += points;
      correctTimes.push(r.timeTaken);
    }
  });
  const maxPossible = totalWeight * 1.4;
  const rawScore = maxPossible > 0 ? earned / maxPossible : 0; // 0..1

  // consistency: reward low variance in response time among correct answers
  let consistencyBonus = 0;
  if (correctTimes.length > 1) {
    const mean = correctTimes.reduce((a, b) => a + b, 0) / correctTimes.length;
    const variance = correctTimes.reduce((a, b) => a + (b - mean) ** 2, 0) / correctTimes.length;
    const stdDev = Math.sqrt(variance);
    const normalizedStd = Math.min(1, stdDev / 7); // 7s spread treated as "high variance"
    consistencyBonus = (1 - normalizedStd) * 3; // up to +3 IQ points
  }

  const unanswered = responses.filter(r => r.timedOut).length;
  const unansweredPenalty = unanswered * 1.5;

  let iq = 100 + (rawScore - 0.5) * 100 * 0.85 + consistencyBonus - unansweredPenalty;
  iq = Math.round(Math.max(55, Math.min(160, iq)));

  // category breakdown
  const groups = ['Logical Reasoning', 'Pattern Recognition', 'Memory', 'Verbal Reasoning', 'Processing Speed'];
  const breakdown = {};
  groups.forEach(g => {
    const inGroup = responses.filter(r => r.question.group === g);
    if (inGroup.length === 0) { breakdown[g] = null; return; }
    const correctN = inGroup.filter(r => r.correct).length;
    breakdown[g] = Math.round((correctN / inGroup.length) * 100);
  });

  const correctCount = responses.filter(r => r.correct).length;
  const incorrectCount = responses.filter(r => !r.correct && !r.timedOut).length;
  const attempted = responses.filter(r => !r.timedOut).length;
  const accuracy = attempted > 0 ? Math.round((correctCount / responses.length) * 100) : 0;
  const times = responses.filter(r => !r.timedOut).map(r => r.timeTaken);
  const avgTime = times.length ? (times.reduce((a, b) => a + b, 0) / times.length) : 0;
  const fastest = times.length ? Math.min(...times) : 0;
  const slowest = times.length ? Math.max(...times) : 0;

  const diffOrder = ['Easy', 'Medium', 'Hard', 'Expert'];
  let difficultyReached = 'Easy';
  responses.forEach(r => {
    if (diffOrder.indexOf(r.question.difficulty) > diffOrder.indexOf(difficultyReached)) difficultyReached = r.question.difficulty;
  });

  const validGroups = groups.filter(g => breakdown[g] !== null);
  let strongest = null, weakest = null;
  validGroups.forEach(g => {
    if (strongest === null || breakdown[g] > breakdown[strongest]) strongest = g;
    if (weakest === null || breakdown[g] < breakdown[weakest]) weakest = g;
  });

  let band = 'Developing';
  if (iq >= 140) band = 'Exceptional';
  else if (iq >= 130) band = 'Very Advanced';
  else if (iq >= 120) band = 'Advanced';
  else if (iq >= 110) band = 'Above Average';
  else if (iq >= 90) band = 'Average';
  else if (iq >= 80) band = 'Below Average';

  return {
    iq, band, breakdown, strongest, weakest,
    attempted, correctCount, incorrectCount, unanswered,
    totalQuestions: responses.length, accuracy,
    avgTime, fastest, slowest, difficultyReached,
    date: new Date().toISOString()
  };
}

/* ---------------------------------------------------------
   8. RESULTS RENDERING + SHARE
   --------------------------------------------------------- */
function finishTest() {
  const result = computeResults(state.test);
  state.lastResult = result;
  saveHistoryEntry(result);
  showView('results');
  renderResults(result);
}

const GROUP_LABELS = {
  'Logical Reasoning': 'Logical Reasoning',
  'Pattern Recognition': 'Pattern Recognition',
  'Memory': 'Memory',
  'Verbal Reasoning': 'Verbal Reasoning',
  'Processing Speed': 'Processing Speed'
};

function renderResults(r) {
  document.getElementById('resultBand').textContent = r.band;
  const dial = document.getElementById('resultDialProgress');
  const CIRC = 2 * Math.PI * 96;
  dial.style.strokeDasharray = String(CIRC);
  dial.style.strokeDashoffset = String(CIRC);
  animateCount(document.getElementById('resultScoreNumber'), 0, r.iq, 1200);
  requestAnimationFrame(() => {
    const pct = Math.min(1, Math.max(0, (r.iq - 55) / (160 - 55)));
    dial.style.strokeDashoffset = String(CIRC * (1 - pct));
  });

  const breakdownList = document.getElementById('breakdownList');
  breakdownList.innerHTML = '';
  Object.entries(r.breakdown).forEach(([group, pct]) => {
    if (pct === null) return;
    const row = document.createElement('div');
    row.className = 'breakdown-row';
    row.innerHTML = `
      <span class="breakdown-label">${GROUP_LABELS[group]}</span>
      <span class="breakdown-track"><span class="breakdown-fill" style="width:0%"></span></span>
      <span class="breakdown-pct">${pct}%</span>`;
    breakdownList.appendChild(row);
    requestAnimationFrame(() => { row.querySelector('.breakdown-fill').style.width = pct + '%'; });
  });

  const stats = [
    ['Questions Attempted', r.attempted],
    ['Correct Answers', r.correctCount],
    ['Incorrect Answers', r.incorrectCount],
    ['Unanswered', r.unanswered],
    ['Accuracy', r.accuracy + '%'],
    ['Avg Response Time', r.avgTime.toFixed(1) + 's'],
    ['Fastest Answer', r.fastest.toFixed(1) + 's'],
    ['Slowest Answer', r.slowest.toFixed(1) + 's'],
    ['Strongest Category', r.strongest ? GROUP_LABELS[r.strongest] : '—'],
    ['Weakest Category', r.weakest ? GROUP_LABELS[r.weakest] : '—'],
    ['Difficulty Reached', r.difficultyReached],
    ['IQ-style Score', r.iq]
  ];
  const grid = document.getElementById('statsGrid');
  grid.innerHTML = stats.map(([label, val]) => `
    <div class="stat-card"><div class="stat-value">${val}</div><div class="stat-label">${label}</div></div>
  `).join('');

  const strengths = Object.entries(r.breakdown).filter(([, v]) => v !== null && v >= 75).map(([g]) => g);
  const improves = Object.entries(r.breakdown).filter(([, v]) => v !== null && v < 65).map(([g]) => g);
  if (!strengths.length && r.strongest) strengths.push(r.strongest);
  if (!improves.length && r.weakest && r.weakest !== r.strongest) improves.push(r.weakest);

  document.getElementById('strengthsList').innerHTML = strengths.map(g => `<li>${GROUP_LABELS[g]}</li>`).join('') || '<li>Keep practicing to reveal your strengths</li>';
  document.getElementById('improveList').innerHTML = improves.map(g => `<li>${GROUP_LABELS[g]}</li>`).join('') || '<li>No clear weak spots this time</li>';

  const strongLabel = r.strongest ? GROUP_LABELS[r.strongest] : 'your strongest area';
  const weakLabel = r.weakest ? GROUP_LABELS[r.weakest] : 'a few areas';
  document.getElementById('analysisText').textContent =
    `Your strongest area was ${strongLabel.toLowerCase()}, where your accuracy stood out from the rest of the test. ` +
    `Your average response time was ${r.avgTime.toFixed(1)} seconds, reflecting a ${r.avgTime < 8 ? 'quick, decisive' : 'careful, deliberate'} approach. ` +
    `${weakLabel !== strongLabel ? `${weakLabel} showed the most room for improvement — a good focus area for next time.` : 'Performance was fairly even across categories.'}`;

  document.getElementById('shareScore').textContent = r.iq;
  document.getElementById('shareBand').textContent = r.band.toUpperCase();
  document.getElementById('shareAccuracy').textContent = `Accuracy: ${r.accuracy}%`;
  document.getElementById('shareTime').textContent = `Avg Time: ${r.avgTime.toFixed(1)}s`;

  if (r.iq >= 130) launchConfetti();
}

function animateCount(el, from, to, duration) {
  const start = performance.now();
  function step(now) {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (to - from) * eased);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function shareText(r) {
  return `🧠 IQ Tester\nMY IQ-STYLE SCORE\n${r.iq} — ${r.band.toUpperCase()}\nAccuracy: ${r.accuracy}% | Avg Time: ${r.avgTime.toFixed(1)}s\nCan you beat my score?`;
}

function initShareButtons() {
  document.getElementById('shareBtn').addEventListener('click', async () => {
    const r = state.lastResult;
    if (!r) return;
    const text = shareText(r);
    try {
      if (navigator.share) {
        await navigator.share({ title: 'My IQ Tester Result', text });
      } else {
        await copyToClipboard(text);
      }
    } catch (e) {
      // user cancelled share or share failed — fall back silently
    }
  });
  document.getElementById('copyBtn').addEventListener('click', async () => {
    const r = state.lastResult;
    if (!r) return;
    const ok = await copyToClipboard(shareText(r));
    const confirmEl = document.getElementById('copyConfirm');
    confirmEl.textContent = ok ? 'Copied to clipboard.' : 'Could not copy — please copy manually.';
    setTimeout(() => { confirmEl.textContent = ''; }, 2500);
  });
}
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  } catch (e) { return false; }
}

/* ---------------------------------------------------------
   9. HISTORY (localStorage) + TREND CHART
   --------------------------------------------------------- */
const HISTORY_KEY = 'iqlab_history';
function saveHistoryEntry(r) {
  try {
    const list = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    list.push({
      date: r.date, score: r.iq, band: r.band, accuracy: r.accuracy,
      avgTime: r.avgTime, questions: r.totalQuestions
    });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(-40)));
  } catch (e) { /* storage unavailable — fail gracefully */ }
}
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch (e) { return []; }
}

function renderHistory() {
  const list = loadHistory();
  const listEl = document.getElementById('historyList');
  const emptyEl = document.getElementById('historyEmpty');
  const trendBlock = document.getElementById('trendBlock');

  if (!list.length) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'block';
    trendBlock.style.display = 'none';
    return;
  }
  emptyEl.style.display = 'none';
  trendBlock.style.display = 'block';

  const recent = list.slice(-10);
  listEl.innerHTML = list.slice().reverse().map(item => `
    <div class="history-item">
      <span class="history-date">${new Date(item.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
      <div class="history-metrics">
        <span>Score: <strong>${item.score}</strong></span>
        <span>Accuracy: <strong>${item.accuracy}%</strong></span>
        <span>Avg Time: <strong>${item.avgTime.toFixed(1)}s</strong></span>
        <span>Questions: <strong>${item.questions}</strong></span>
      </div>
    </div>
  `).join('');

  const svg = document.getElementById('trendSvg');
  const w = 600, h = 220, pad = 30;
  if (recent.length < 2) {
    svg.innerHTML = `<text x="${w/2}" y="${h/2}" fill="var(--text-faint)" font-size="13" text-anchor="middle" font-family="Inter">Take one more test to see your trend.</text>`;
    document.getElementById('trendDelta').textContent = '';
    return;
  }
  const scores = recent.map(x => x.score);
  const min = Math.min(...scores) - 5, max = Math.max(...scores) + 5;
  const stepX = (w - pad * 2) / (recent.length - 1);
  const pts = recent.map((item, i) => {
    const x = pad + i * stepX;
    const y = h - pad - ((item.score - min) / (max - min)) * (h - pad * 2);
    return [x, y];
  });
  const path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const dots = pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" fill="var(--cyan)"/>`).join('');
  const labels = recent.map((item, i) => `<text x="${pts[i][0].toFixed(1)}" y="${pts[i][1] - 12}" fill="var(--text-dim)" font-size="11" text-anchor="middle" font-family="JetBrains Mono">${item.score}</text>`).join('');
  svg.innerHTML = `<path d="${path}" fill="none" stroke="var(--violet)" stroke-width="2.5"/>${dots}${labels}`;

  const delta = recent[recent.length - 1].score - recent[0].score;
  const deltaEl = document.getElementById('trendDelta');
  if (delta > 0) deltaEl.textContent = `Your score improved by ${delta} point${delta === 1 ? '' : 's'}.`;
  else if (delta < 0) deltaEl.textContent = `Your score changed by ${delta} points since your first test.`;
  else deltaEl.textContent = 'Your score has stayed consistent.';
  deltaEl.style.color = delta >= 0 ? 'var(--green)' : 'var(--amber)';
}

/* ---------------------------------------------------------
   10. MISC: confetti, toast, boot
   --------------------------------------------------------- */
function launchConfetti() {
  const colors = ['#778D7A', '#D4C4A8', '#415A77', '#F4F1DE'];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.width = (5 + Math.random() * 5) + 'px';
    piece.style.height = (8 + Math.random() * 8) + 'px';
    piece.style.background = colors[i % colors.length];
    piece.style.animationDuration = (2.5 + Math.random() * 1.8) + 's';
    piece.style.animationDelay = (Math.random() * 0.4) + 's';
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 5000);
  }
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}

function boot() {
  if (!BANK_IS_VALID) {
    showToast('Question bank failed validation — check the console.');
  }
  try {
    initHeroDial();
  } catch (e) { console.error('Hero dial failed to render', e); }
  initNav();
  initShareButtons();
  try { window.addEventListener('resize', () => {}); } catch (e) {}
}

document.addEventListener('DOMContentLoaded', boot);