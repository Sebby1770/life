/** Daily soup — seed from YYYY-MM-DD. */

import { Grid, Rng, Rule, hashGrid } from "./engine.js";

export const DAILY_W = 40;
export const DAILY_H = 24;
export const DAILY_DENSITY = 0.32;
export const DAILY_MAX_GENS = 400;

export function todayISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function dateSeed(iso) {
  return String(iso);
}

export function makeDailySoup(iso, w = DAILY_W, h = DAILY_H, density = DAILY_DENSITY) {
  const grid = new Grid(w, h, true);
  const rng = new Rng(dateSeed(iso));
  grid.fillRandom(rng, density);
  return grid;
}

export function scoreDaily(peakPop, gensLived) {
  return peakPop * 10 + gensLived;
}

export function runDaily(grid, maxGens = DAILY_MAX_GENS, rule = Rule.CONWAY) {
  const g = grid.clone();
  const seen = new Map([[hashGrid(g), 0]]);
  let peak = g.population();
  let gensLived = 0;
  if (peak === 0) return { peakPop: 0, gensLived: 0, score: 0, reason: "empty" };
  for (let i = 1; i <= maxGens; i += 1) {
    g.step(rule);
    const pop = g.population();
    if (pop > peak) peak = pop;
    gensLived = i;
    if (pop === 0) {
      return { peakPop: peak, gensLived, score: scoreDaily(peak, gensLived), reason: "extinct", pop: 0 };
    }
    const h = hashGrid(g);
    if (seen.has(h)) {
      return { peakPop: peak, gensLived, score: scoreDaily(peak, gensLived), reason: "stable", pop };
    }
    seen.set(h, i);
  }
  return {
    peakPop: peak,
    gensLived: maxGens,
    score: scoreDaily(peak, maxGens),
    reason: "cap",
    pop: g.population(),
  };
}
