/** Pattern detectors: still life, oscillators, glider, LWSS. */

import { Grid, Rule, hashGrid, bboxOf } from "./engine.js";

export function liveKey(x, y) {
  return `${x},${y}`;
}

export function cellSet(cells) {
  const s = new Set();
  for (const [x, y] of cells) s.add(liveKey(x, y));
  return s;
}

export function setsEqual(a, b) {
  if (a.length !== b.length) return false;
  const s = cellSet(b);
  for (const [x, y] of a) if (!s.has(liveKey(x, y))) return false;
  return true;
}

export function wrapDelta(d, size) {
  if (!size) return d;
  let x = ((d % size) + size) % size;
  if (x > size / 2) x -= size;
  return x;
}

/** Map set A onto set B if a single translation exists. */
export function translationBetween(a, b, w, h, wrap) {
  if (a.length !== b.length || a.length === 0) return null;
  const bset = cellSet(b);
  const [x0, y0] = a[0];
  for (const [x1, y1] of b) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    let ok = true;
    for (let i = 0; i < a.length; i += 1) {
      let nx = a[i][0] + dx;
      let ny = a[i][1] + dy;
      if (wrap) {
        nx = ((nx % w) + w) % w;
        ny = ((ny % h) + h) % h;
      }
      if (!bset.has(liveKey(nx, ny))) {
        ok = false;
        break;
      }
    }
    if (ok) return { dx: wrap ? wrapDelta(dx, w) : dx, dy: wrap ? wrapDelta(dy, h) : dy };
  }
  return null;
}

export function periodInfo(grid, rule = Rule.CONWAY, max = 48) {
  const g = grid instanceof Grid ? grid.clone() : grid;
  const seen = new Map();
  const pops = [];
  let h = hashGrid(g);
  seen.set(h, 0);
  pops.push(g.population());
  if (pops[0] === 0) return { period: 0, start: 0, pops, cycleAt: 0 };
  for (let i = 1; i <= max; i += 1) {
    g.step(rule);
    h = hashGrid(g);
    pops.push(g.population());
    if (seen.has(h)) {
      const start = seen.get(h);
      const period = i - start;
      return { period, start, pops: pops.slice(start, i), cycleAt: i };
    }
    seen.set(h, i);
  }
  return { period: 0, start: 0, pops, cycleAt: 0 };
}

export function isStillLife(grid, gens = 4, rule = Rule.CONWAY) {
  if (grid.population() === 0) return false;
  const g = grid.clone();
  const h0 = hashGrid(g);
  for (let i = 0; i < gens; i += 1) {
    g.step(rule);
    if (hashGrid(g) !== h0) return false;
  }
  return true;
}

export function detectGlider(grid, rule = Rule.CONWAY) {
  const pop = grid.population();
  if (pop === 0) return false;
  const cells0 = grid.liveCells();
  const box = bboxOf(cells0);
  const g = grid.clone();
  for (let i = 0; i < 4; i += 1) g.step(rule);
  const cells4 = g.liveCells();
  if (cells4.length !== cells0.length || cells0.length === 0) return false;

  if (pop === 5) {
    if (!(box.w <= 3 && box.h <= 3)) return false;
    const t = translationBetween(cells0, cells4, grid.w, grid.h, grid.wrap);
    if (!t) return false;
    return Math.abs(t.dx) === 1 && Math.abs(t.dy) === 1;
  }

  return findTranslatedCluster(cells0, cells4, grid, 5, 3, 3, (dx, dy) => Math.abs(dx) === 1 && Math.abs(dy) === 1);
}

export function detectLwss(grid, rule = Rule.CONWAY) {
  const pop = grid.population();
  if (pop === 0) return false;
  const cells0 = grid.liveCells();
  const g = grid.clone();
  for (let i = 0; i < 4; i += 1) g.step(rule);
  const cells4 = g.liveCells();
  if (cells4.length !== cells0.length || cells0.length === 0) return false;

  const isLwssDelta = (dx, dy) =>
    (Math.abs(dx) === 2 && dy === 0) || (dx === 0 && Math.abs(dy) === 2);

  if (pop === 9) {
    const t = translationBetween(cells0, cells4, grid.w, grid.h, grid.wrap);
    if (!t) return false;
    return isLwssDelta(t.dx, t.dy);
  }

  return findTranslatedCluster(cells0, cells4, grid, 9, 6, 5, isLwssDelta);
}

function neighbors8(x, y, wrap, w, h) {
  const out = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      let nx = x + dx;
      let ny = y + dy;
      if (wrap) {
        nx = ((nx % w) + w) % w;
        ny = ((ny % h) + h) % h;
        out.push([nx, ny]);
      } else if (nx >= 0 && ny >= 0 && nx < w && ny < h) out.push([nx, ny]);
    }
  }
  return out;
}

function components(cells, wrap, w, h) {
  const set = cellSet(cells);
  const seen = new Set();
  const groups = [];
  for (const [sx, sy] of cells) {
    const sk = liveKey(sx, sy);
    if (seen.has(sk)) continue;
    const stack = [[sx, sy]];
    const group = [];
    seen.add(sk);
    while (stack.length) {
      const [x, y] = stack.pop();
      group.push([x, y]);
      for (const [nx, ny] of neighbors8(x, y, wrap, w, h)) {
        const k = liveKey(nx, ny);
        if (!set.has(k) || seen.has(k)) continue;
        seen.add(k);
        stack.push([nx, ny]);
      }
    }
    groups.push(group);
  }
  return groups;
}

function findTranslatedCluster(cells0, cells4, grid, wantPop, maxW, maxH, deltaOk) {
  const g0 = components(cells0, grid.wrap, grid.w, grid.h).filter((c) => c.length === wantPop);
  const g4 = components(cells4, grid.wrap, grid.w, grid.h).filter((c) => c.length === wantPop);
  for (const a of g0) {
    const box = bboxOf(a);
    if (box.w > maxW || box.h > maxH) continue;
    for (const b of g4) {
      const t = translationBetween(a, b, grid.w, grid.h, grid.wrap);
      if (t && deltaOk(t.dx, t.dy)) return true;
    }
  }
  return false;
}

export function simulate(grid, maxGens, rule = Rule.CONWAY) {
  const g = grid.clone();
  const seen = new Map([[hashGrid(g), 0]]);
  let peak = g.population();
  let diedAt = g.population() === 0 ? 0 : -1;
  let cycleAt = -1;
  let period = 0;
  for (let i = 1; i <= maxGens; i += 1) {
    g.step(rule);
    const pop = g.population();
    if (pop > peak) peak = pop;
    if (pop === 0 && diedAt < 0) {
      diedAt = i;
      return { gens: i, peak, diedAt, cycleAt, period, pop: 0, grid: g };
    }
    const h = hashGrid(g);
    if (seen.has(h)) {
      cycleAt = i;
      period = i - seen.get(h);
      return { gens: i, peak, diedAt, cycleAt, period, pop, grid: g };
    }
    seen.set(h, i);
  }
  return { gens: maxGens, peak, diedAt, cycleAt, period, pop: g.population(), grid: g };
}

/** True if the pattern runs at least minGens before repeating a hash or dying. */
export function lastsBeforeStable(grid, minGens = 60, maxGens = 400, rule = Rule.CONWAY) {
  if (grid.population() === 0) return false;
  const g = grid.clone();
  const seen = new Map([[hashGrid(g), 0]]);
  for (let i = 1; i <= maxGens; i += 1) {
    g.step(rule);
    if (g.population() === 0) return i >= minGens;
    const h = hashGrid(g);
    if (seen.has(h)) return seen.get(h) >= minGens;
    seen.set(h, i);
    if (i >= minGens) return true;
  }
  return true;
}
