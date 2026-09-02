import assert from "node:assert/strict";
import test from "node:test";
import { Grid } from "../js/engine.js";
import { CHALLENGES, checkWin, createChallengeGrid, paintWinning } from "../js/challenges.js";

for (const ch of CHALLENGES) {
  test(`${ch.title}: empty grid does not win`, () => {
    const g = new Grid(ch.w || 56, ch.h || 36, ch.wrap !== false);
    assert.equal(checkWin(ch, g), false);
    assert.equal(checkWin(ch.id, g), false);
  });

  test(`${ch.title}: known winning grid wins`, () => {
    const g = createChallengeGrid(ch);
    paintWinning(g, ch.id);
    assert.equal(checkWin(ch, g), true, `expected ${ch.id} winner to pass`);
  });
}

test("spark does not accept a still block", () => {
  const g = createChallengeGrid("spark");
  paintWinning(g, "still");
  assert.equal(checkWin("spark", g), false);
});
