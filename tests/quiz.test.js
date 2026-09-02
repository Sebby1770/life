import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Grid } from "../js/engine.js";
import { STAMP_META } from "../js/patterns.js";
import { makeQuiz, quizChoices, placeQuizPattern, gradeQuiz, quizDone, QUIZ_ROUNDS } from "../js/quiz.js";
import { Rng } from "../js/engine.js";

describe("identify quiz", () => {
  it("builds a deterministic deck of 8 unique patterns", () => {
    const a = makeQuiz(42);
    const b = makeQuiz(42);
    assert.equal(a.order.length, QUIZ_ROUNDS);
    assert.deepEqual(a.order, b.order);
    assert.equal(new Set(a.order).size, QUIZ_ROUNDS);
  });

  it("offers four choices including the answer", () => {
    const quiz = makeQuiz(7);
    const rng = new Rng(7);
    const choices = quizChoices(quiz, rng);
    assert.equal(choices.length, 4);
    const answer = STAMP_META[quiz.order[0]].name;
    assert.equal(choices.includes(answer), true);
  });

  it("grades a correct and incorrect pick", () => {
    const quiz = makeQuiz(1);
    const answer = STAMP_META[quiz.order[0]].name;
    assert.equal(gradeQuiz(quiz, answer).ok, true);
    assert.equal(gradeQuiz(quiz, "Not a pattern").ok, false);
  });

  it("places a live pattern on the board", () => {
    const grid = new Grid(40, 24, true);
    placeQuizPattern(grid, "block");
    assert.equal(grid.population(), 4);
  });

  it("is done after advancing past the last round", () => {
    const quiz = makeQuiz(3);
    quiz.index = QUIZ_ROUNDS;
    assert.equal(quizDone(quiz), true);
  });
});
