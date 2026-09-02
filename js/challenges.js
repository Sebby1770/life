/** Campaign of 10 Life puzzles. */

import { Grid, Rule, Rng, applyCells } from "./engine.js";
import { ARTS, cellsFromArt, artSize, placeStamp } from "./patterns.js";
import { detectGlider, detectLwss, isStillLife, lastsBeforeStable, periodInfo, simulate } from "./detect.js";

export const CHALLENGE_W = 56;
export const CHALLENGE_H = 36;

export const CHALLENGES = [
  {
    id: "spark",
    title: "Spark",
    flavor: "Three cells. A pulse. Teach the void to blink.",
    budget: 3,
    hint: "Try a line of three — a blinker.",
    capGens: 40,
    par: 2,
    wrap: true,
  },
  {
    id: "still",
    title: "Still",
    flavor: "Some shapes refuse to die. Leave a fossil in the dark.",
    budget: 6,
    hint: "A 2×2 square never dies.",
    capGens: 12,
    par: 4,
    wrap: true,
  },
  {
    id: "glider-school",
    title: "Glider School",
    flavor: "Five sparks, one heading. Graduate a spaceship.",
    budget: 5,
    hint: "The classic glider: five cells in a 3×3.",
    capGens: 16,
    par: 4,
    wrap: true,
  },
  {
    id: "toad",
    title: "Toad",
    flavor: "Two rows, slightly drunk. Croak on the two-beat.",
    budget: 6,
    hint: "Two offset rows of three.",
    capGens: 16,
    par: 2,
    wrap: true,
  },
  {
    id: "beacon",
    title: "Beacon",
    flavor: "Two houses across a lane, porch lights winking.",
    budget: 8,
    hint: "Two blocks a diagonal step apart.",
    capGens: 16,
    par: 2,
    wrap: true,
  },
  {
    id: "peak-16",
    title: "Peak 16",
    flavor: "A small seed can bloom. Hit sixteen living cells.",
    budget: 12,
    hint: "A small methuselah — the R-pentomino — can bloom.",
    capGens: 200,
    par: 40,
    wrap: false,
    w: 64,
    h: 48,
  },
  {
    id: "methuselah",
    title: "Methuselah",
    flavor: "Do not settle. Last sixty generations before the quiet.",
    budget: 5,
    hint: "The R-pentomino lives a long time.",
    capGens: 400,
    par: 60,
    wrap: false,
    w: 80,
    h: 64,
  },
  {
    id: "lightweight",
    title: "Lightweight",
    flavor: "Nine cells with a flat back. Let it cruise.",
    budget: 9,
    hint: "Nine cells, a spaceship with a flat back — LWSS.",
    capGens: 16,
    par: 4,
    wrap: true,
  },
  {
    id: "garden",
    title: "Garden",
    flavor: "The loaf is already decided. Paint its silhouette.",
    budget: 7,
    hint: "Match the ghost loaf exactly.",
    capGens: 8,
    par: 1,
    wrap: true,
    ghost: true,
  },
  {
    id: "keep-alive",
    title: "Keep Alive",
    flavor: "Eight strangers, seed 42. You may add one cell every eight ticks. Last to generation 80.",
    budget: 1,
    hint: "Stabilize the seed. A block nearby can help.",
    capGens: 80,
    par: 80,
    wrap: true,
    keepAlive: true,
    seed: 42,
  },
];

export function challengeById(id) {
  if (id && typeof id === "object" && id.id) return id;
  return CHALLENGES.find((c) => c.id === id) || null;
}

export function gardenTarget(w = CHALLENGE_W, h = CHALLENGE_H) {
  const { w: pw, h: ph } = artSize(ARTS.loaf);
  const ox = Math.max(0, Math.floor((w - pw) / 2));
  const oy = Math.max(0, Math.floor((h - ph) / 2));
  return cellsFromArt(ARTS.loaf, ox, oy);
}

export function matchesGarden(grid) {
  const target = gardenTarget(grid.w, grid.h);
  const live = grid.liveCells();
  if (live.length !== target.length) return false;
  const set = new Set(target.map(([x, y]) => `${x},${y}`));
  for (const [x, y] of live) if (!set.has(`${x},${y}`)) return false;
  return true;
}

export function seedKeepAlive(grid, seed = 42, count = 8) {
  const rng = new Rng(seed);
  grid.clear();
  const used = new Set();
  let guard = 0;
  while (used.size < count && guard < 10000) {
    guard += 1;
    const x = rng.nextInt(grid.w);
    const y = rng.nextInt(grid.h);
    const k = y * grid.w + x;
    if (used.has(k)) continue;
    used.add(k);
    grid.set(x, y, true);
  }
  return grid;
}

export function createChallengeGrid(ch) {
  const c = challengeById(ch);
  const g = new Grid(c.w || CHALLENGE_W, c.h || CHALLENGE_H, c.wrap !== false);
  if (c.keepAlive) seedKeepAlive(g, c.seed ?? 42);
  return g;
}

function popsOf(info) {
  return info.pops || [];
}

export function checkWin(idOrCh, grid) {
  const ch = challengeById(idOrCh);
  if (!ch || !grid) return false;
  const rule = Rule.CONWAY;
  switch (ch.id) {
    case "spark": {
      const info = periodInfo(grid, rule, 24);
      return info.period === 2;
    }
    case "still":
      return grid.population() >= 4 && isStillLife(grid, 4, rule);
    case "glider-school":
      return detectGlider(grid, rule);
    case "toad": {
      const info = periodInfo(grid, rule, 24);
      const pops = popsOf(info);
      return info.period === 2 && pops.length > 0 && pops.every((p) => p === 6);
    }
    case "beacon": {
      const info = periodInfo(grid, rule, 24);
      if (info.period !== 2) return false;
      const pops = popsOf(info);
      const min = Math.min(...pops);
      const max = Math.max(...pops);
      return min === 6 && max === 8;
    }
    case "peak-16":
      return Math.max(grid.population(), simulate(grid, 200, rule).peak) >= 16;
    case "methuselah":
      return lastsBeforeStable(grid, 60, 400, rule);
    case "lightweight":
      return detectLwss(grid, rule);
    case "garden":
      return matchesGarden(grid) && (grid.population() === 0 ? false : isStillLife(grid, 2, rule));
    case "keep-alive": {
      if (grid.population() === 0) return false;
      const sim = simulate(grid, 80, rule);
      if (sim.diedAt >= 0 && sim.diedAt <= 80) return false;
      return sim.pop > 0;
    }
    default:
      return false;
  }
}

export function awardStars(ch, ctx) {
  const c = challengeById(ch);
  if (!c || !ctx?.win) return 0;
  if (c.id === "methuselah") {
    const lived = ctx.lived ?? ctx.gens ?? 0;
    if (lived >= 200) return 3;
    if (lived >= 100) return 2;
    return 1;
  }
  if (c.id === "peak-16") {
    const peak = ctx.peak ?? 0;
    if (peak >= 40) return 3;
    if (peak >= 24) return 2;
    return 1;
  }
  if (c.id === "keep-alive") {
    const pop = ctx.pop ?? 0;
    if (pop >= 10) return 3;
    if (pop >= 4) return 2;
    return 1;
  }
  if (c.id === "garden") return 3;
  const par = c.par ?? 8;
  const gens = ctx.gens ?? par;
  if (gens <= par) return 3;
  if (gens <= par * 3) return 2;
  return 1;
}

/** Incremental check while a run is in progress. */
export function checkRun(ch, grid, stats) {
  const c = challengeById(ch);
  if (!c) return false;
  const gen = stats.gen ?? 0;
  const peak = stats.peak ?? grid.population();
  switch (c.id) {
    case "spark":
      return gen >= 2 && periodInfo(grid, Rule.CONWAY, 8).period === 2;
    case "still":
      return gen >= 4 && grid.population() >= 4 && isStillLife(grid, 1);
    case "glider-school":
      return gen >= 4 && detectGlider(grid);
    case "toad":
      return gen >= 2 && checkWin(c, grid);
    case "beacon":
      return gen >= 2 && checkWin(c, grid);
    case "peak-16":
      return peak >= 16;
    case "methuselah":
      return gen >= 60 && (stats.cycleAt ?? -1) < 0 && grid.population() > 0;
    case "lightweight":
      return gen >= 4 && detectLwss(grid);
    case "garden":
      return matchesGarden(grid);
    case "keep-alive":
      return gen >= 80 && grid.population() > 0;
    default:
      return checkWin(c, grid);
  }
}

export function winningStamp(id) {
  const map = {
    spark: "blinker",
    still: "block",
    "glider-school": "glider",
    toad: "toad",
    beacon: "beacon",
    "peak-16": "rpentomino",
    methuselah: "rpentomino",
    lightweight: "lwss",
    garden: "loaf",
    "keep-alive": "block",
  };
  return map[id] || null;
}

export function paintWinning(grid, id) {
  const ch = challengeById(id);
  if (!ch) return grid;
  grid.clear();
  if (ch.id === "garden") {
    applyCells(grid, gardenTarget(grid.w, grid.h), 0, 0, true);
    return grid;
  }
  const stamp = winningStamp(ch.id);
  if (!stamp) return grid;
  const { w, h } = artSize(ARTS[stamp]);
  const ox = Math.max(0, Math.floor((grid.w - w) / 2));
  const oy = Math.max(0, Math.floor((grid.h - h) / 2));
  if (ch.id === "keep-alive") {
    placeStamp(grid, "block", ox, oy);
    return grid;
  }
  placeStamp(grid, stamp, ox, oy);
  return grid;
}
