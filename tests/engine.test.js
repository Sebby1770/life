import assert from "node:assert/strict";
import test from "node:test";
import { Grid, Rule, hashGrid, encodeRle, applyRle } from "../js/engine.js";
import { placeStamp } from "../js/patterns.js";

test("blinker period 2", () => {
  const grid = new Grid(9, 9, true);
  placeStamp(grid, "blinker", 3, 4);
  const a = hashGrid(grid);
  const s1 = grid.step(Rule.CONWAY);
  const b = hashGrid(grid);
  const s2 = grid.step(Rule.CONWAY);
  assert.notEqual(a, b);
  assert.equal(hashGrid(grid), a);
  assert.equal(s1.pop, 3);
  assert.equal(s2.pop, 3);
  assert.ok("births" in s1 && "deaths" in s1);
});

test("block is still", () => {
  const grid = new Grid(8, 8, true);
  placeStamp(grid, "block", 3, 3);
  const before = hashGrid(grid);
  const { pop, births, deaths } = grid.step(Rule.CONWAY);
  assert.equal(hashGrid(grid), before);
  assert.equal(pop, 4);
  assert.equal(births, 0);
  assert.equal(deaths, 0);
});

test("glider translates after 4 steps on a wrapping grid", () => {
  const grid = new Grid(40, 40, true);
  placeStamp(grid, "glider", 10, 10);
  const start = grid.liveCells();
  assert.equal(start.length, 5);
  for (let i = 0; i < 4; i += 1) grid.step(Rule.CONWAY);
  const next = new Set(grid.liveCells().map(([x, y]) => `${x},${y}`));
  assert.equal(next.size, 5);
  for (const [x, y] of start) {
    assert.equal(next.has(`${x + 1},${y + 1}`), true);
  }
});

test("RLE round-trips a glider", () => {
  const grid = new Grid(16, 16, true);
  placeStamp(grid, "glider", 4, 4);
  const text = encodeRle(grid, "B3/S23", "glider");
  const other = new Grid(16, 16, true);
  applyRle(other, text);
  assert.equal(other.population(), 5);
  assert.match(text, /rule = B3\/S23/);
  const norm = (g) => {
    const cells = g.liveCells();
    const minX = Math.min(...cells.map((c) => c[0]));
    const minY = Math.min(...cells.map((c) => c[1]));
    return cells.map(([x, y]) => `${x - minX},${y - minY}`).sort().join(";");
  };
  assert.equal(norm(other), norm(grid));
});
