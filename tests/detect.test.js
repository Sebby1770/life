import assert from "node:assert/strict";
import test from "node:test";
import { Grid } from "../js/engine.js";
import { placeStamp } from "../js/patterns.js";
import { detectGlider, detectLwss, isStillLife, periodInfo } from "../js/detect.js";

test("detects blinker as period 2", () => {
  const g = new Grid(12, 12, true);
  placeStamp(g, "blinker", 4, 6);
  assert.equal(periodInfo(g).period, 2);
});

test("block is a still life", () => {
  const g = new Grid(10, 10, true);
  placeStamp(g, "block", 4, 4);
  assert.equal(isStillLife(g, 4), true);
});

test("empty is not a still life", () => {
  const g = new Grid(10, 10, true);
  assert.equal(isStillLife(g, 4), false);
});

test("detects a glider", () => {
  const g = new Grid(30, 30, true);
  placeStamp(g, "glider", 8, 8);
  assert.equal(detectGlider(g), true);
});

test("block is not a glider", () => {
  const g = new Grid(20, 20, true);
  placeStamp(g, "block", 8, 8);
  assert.equal(detectGlider(g), false);
});

test("detects LWSS as a period-4 spaceship", () => {
  const g = new Grid(40, 24, true);
  placeStamp(g, "lwss", 6, 10);
  assert.equal(detectLwss(g), true);
});

test("empty is not an LWSS", () => {
  const g = new Grid(20, 20, true);
  assert.equal(detectLwss(g), false);
});
