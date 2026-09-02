/** Name-that-pattern quiz. */

import { Rng } from "./engine.js";
import { ARTS, STAMP_META, artSize, placeArt } from "./patterns.js";

export const QUIZ_ROUNDS = 8;

const BANK = [
  "blinker",
  "toad",
  "beacon",
  "glider",
  "lwss",
  "block",
  "beehive",
  "loaf",
  "boat",
  "pulsar",
  "rpentomino",
  "pentadecathlon",
];

function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function makeQuiz(seed = Date.now()) {
  const rng = new Rng(seed);
  const order = shuffle(rng, BANK).slice(0, QUIZ_ROUNDS);
  return {
    seed,
    order,
    index: 0,
    score: 0,
    answered: false,
    pick: null,
  };
}

export function quizChoices(quiz, rng) {
  const id = quiz.order[quiz.index];
  const correct = STAMP_META[id].name;
  const others = BANK.filter((x) => x !== id).map((x) => STAMP_META[x].name);
  const picks = shuffle(rng, others).slice(0, 3);
  return shuffle(rng, [correct, ...picks]);
}

export function placeQuizPattern(grid, id) {
  grid.clear();
  const { w, h } = artSize(ARTS[id]);
  const ox = Math.max(0, Math.floor((grid.w - w) / 2));
  const oy = Math.max(0, Math.floor((grid.h - h) / 2));
  placeArt(grid, ARTS[id], ox, oy);
  return { ox, oy, w, h };
}

export function gradeQuiz(quiz, choice) {
  const id = quiz.order[quiz.index];
  const ok = choice === STAMP_META[id].name;
  return { ok, answer: STAMP_META[id].name, id };
}

export function quizDone(quiz) {
  return quiz.index >= quiz.order.length;
}
