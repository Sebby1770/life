import assert from "node:assert/strict";
import test from "node:test";
import { hashGrid } from "../js/engine.js";
import { makeDailySoup, scoreDaily, todayISO, runDaily } from "../js/daily.js";

test("same date yields the same soup", () => {
  const a = makeDailySoup("2026-09-02");
  const b = makeDailySoup("2026-09-02");
  assert.equal(a.w, 40);
  assert.equal(a.h, 24);
  assert.equal(a.population(), b.population());
  assert.equal(hashGrid(a), hashGrid(b));
});

test("different dates yield different soups", () => {
  const a = makeDailySoup("2026-09-02");
  const b = makeDailySoup("2026-09-03");
  assert.notEqual(hashGrid(a), hashGrid(b));
});

test("score is peakPop * 10 + gensLived", () => {
  assert.equal(scoreDaily(12, 40), 160);
});

test("todayISO is YYYY-MM-DD", () => {
  assert.match(todayISO(new Date("2026-09-02T12:00:00")), /^\d{4}-\d{2}-\d{2}$/);
});

test("runDaily returns a finite score", () => {
  const soup = makeDailySoup("1999-01-01");
  const result = runDaily(soup, 80);
  assert.ok(result.score >= 0);
  assert.ok(result.peakPop >= 0);
  assert.ok(result.gensLived >= 0);
  assert.ok(result.gensLived <= 80);
});
