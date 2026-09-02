import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ACHIEVEMENTS, starTotal, completedCount, isUnlocked } from "../js/achievements.js";
import { CHALLENGES } from "../js/challenges.js";

describe("campaign unlock", () => {
  it("opens the first challenge always", () => {
    assert.equal(isUnlocked(0, {}, CHALLENGES), true);
  });

  it("locks later challenges until the previous is completed", () => {
    assert.equal(isUnlocked(1, {}, CHALLENGES), false);
    const records = { spark: { stars: 1, completed: true } };
    assert.equal(isUnlocked(1, records, CHALLENGES), true);
    assert.equal(isUnlocked(2, records, CHALLENGES), false);
  });
});

describe("stars", () => {
  it("sums stars across the campaign", () => {
    const records = { spark: { stars: 3 }, still: { stars: 2 } };
    assert.equal(starTotal(records, CHALLENGES), 5);
  });

  it("counts completed challenges", () => {
    const records = { spark: { completed: true }, still: { completed: true } };
    assert.equal(completedCount(records, CHALLENGES), 2);
  });
});

describe("catalog", () => {
  it("has unique medal ids", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});
