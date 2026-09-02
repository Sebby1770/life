/** Life engine — binary CA with optional wrap, RLE, and live-cell hashing. */

export class Rule {
  constructor(birth, survive, id = "", label = "") {
    this.birth = birth;
    this.survive = survive;
    this.id = id;
    this.label = label || this.toBs();
  }

  static CONWAY = new Rule(1 << 3, (1 << 2) | (1 << 3), "conway", "Conway B3/S23");
  static HIGHLIFE = new Rule((1 << 3) | (1 << 6), (1 << 2) | (1 << 3), "highlife", "HighLife B36/S23");
  static SEEDS = new Rule(1 << 2, 0, "seeds", "Seeds B2/S");
  static DAYNIGHT = new Rule(
    (1 << 3) | (1 << 6) | (1 << 7) | (1 << 8),
    (1 << 3) | (1 << 4) | (1 << 6) | (1 << 7) | (1 << 8),
    "daynight",
    "Day & Night",
  );

  births(n) {
    return n <= 8 && (this.birth & (1 << n)) !== 0;
  }
  survives(n) {
    return n <= 8 && (this.survive & (1 << n)) !== 0;
  }
  nextAlive(alive, n) {
    return alive ? this.survives(n) : this.births(n);
  }
  toBs() {
    return `B${maskDigits(this.birth)}/S${maskDigits(this.survive)}`;
  }
}

export const RULE_PRESETS = [Rule.CONWAY, Rule.HIGHLIFE, Rule.SEEDS, Rule.DAYNIGHT];

export function parseRule(s) {
  const t = String(s || "").trim().toLowerCase();
  if (!t) return Rule.CONWAY;
  const named = {
    conway: Rule.CONWAY,
    life: Rule.CONWAY,
    "b3/s23": Rule.CONWAY,
    highlife: Rule.HIGHLIFE,
    "b36/s23": Rule.HIGHLIFE,
    seeds: Rule.SEEDS,
    "b2/s": Rule.SEEDS,
    "b2/s0": Rule.SEEDS,
    daynight: Rule.DAYNIGHT,
    "day-night": Rule.DAYNIGHT,
    "day&night": Rule.DAYNIGHT,
    "b3678/s34678": Rule.DAYNIGHT,
  };
  if (named[t]) return named[t];
  if (t.startsWith("b") && t.includes("/s")) {
    const rest = t.slice(1);
    const [b, s] = rest.split("/");
    if (s && s.startsWith("s")) return fromLists(parseDigits(b), parseDigits(s.slice(1)));
  }
  const parts = t.split("/");
  if (parts.length === 2 && parts.every((p) => [...p].every((c) => c >= "0" && c <= "9"))) {
    return fromLists(parseDigits(parts[1]), parseDigits(parts[0]));
  }
  throw new Error(`unknown rule: ${s}`);
}

function parseDigits(s) {
  const out = [];
  for (const c of s || "") {
    if (c < "0" || c > "9") throw new Error(`invalid rule digit: ${c}`);
    const d = c.charCodeAt(0) - 48;
    if (d > 8) throw new Error(`neighbor digit ${c} out of range`);
    out.push(d);
  }
  return out;
}

function fromLists(birth, survive) {
  let b = 0;
  let s = 0;
  for (const n of birth) b |= 1 << n;
  for (const n of survive) s |= 1 << n;
  return new Rule(b, s);
}

function maskDigits(mask) {
  let s = "";
  for (let i = 0; i <= 8; i += 1) if (mask & (1 << i)) s += String(i);
  return s;
}

export class Rng {
  constructor(seed) {
    this.x = normalizeSeed(seed);
  }
  nextU64() {
    let x = this.x;
    x ^= (x << 13n) & 0xffffffffffffffffn;
    x ^= x >> 7n;
    x ^= (x << 17n) & 0xffffffffffffffffn;
    this.x = x & 0xffffffffffffffffn;
    return this.x;
  }
  nextF64() {
    return Number(this.nextU64() >> 11n) / Number(1n << 53n);
  }
  nextInt(n) {
    const m = BigInt(n);
    return Number(this.nextU64() % m);
  }
}

function normalizeSeed(seed) {
  if (typeof seed === "string") return fnv1a64(seed);
  if (typeof seed === "bigint") {
    const x = seed & 0xffffffffffffffffn;
    return x === 0n ? 0xdeadbeefcafebaben : x;
  }
  if (seed === 0 || seed == null) return 0xdeadbeefcafebaben;
  if (typeof seed === "number" && Number.isFinite(seed)) {
    const x = BigInt(seed >>> 0) * 0x9e3779b97f4a7c15n;
    return (x & 0xffffffffffffffffn) || 0xdeadbeefcafebaben;
  }
  return 0xdeadbeefcafebaben;
}

function fnv1a64(str) {
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < str.length; i += 1) {
    h ^= BigInt(str.charCodeAt(i));
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h || 0xdeadbeefcafebaben;
}

export class Grid {
  constructor(w, h, wrap = true) {
    this.w = Math.max(1, w | 0);
    this.h = Math.max(1, h | 0);
    this.wrap = Boolean(wrap);
    const n = this.w * this.h;
    this.cells = new Uint8Array(n);
    this.ages = new Uint16Array(n);
    this.next = new Uint8Array(n);
    this.nextAges = new Uint16Array(n);
  }

  idx(x, y) {
    return y * this.w + x;
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  wrapCoord(x, y) {
    if (this.wrap) {
      x = ((x % this.w) + this.w) % this.w;
      y = ((y % this.h) + this.h) % this.h;
      return [x, y];
    }
    return this.inBounds(x, y) ? [x, y] : null;
  }

  get(x, y) {
    if (!this.inBounds(x, y)) return false;
    return this.cells[this.idx(x, y)] !== 0;
  }

  set(x, y, alive) {
    const p = this.wrapCoord(x, y);
    if (!p) return false;
    const i = this.idx(p[0], p[1]);
    const v = alive ? 1 : 0;
    const changed = this.cells[i] !== v;
    this.cells[i] = v;
    this.ages[i] = v ? 1 : 0;
    return changed;
  }

  toggle(x, y) {
    return this.set(x, y, !this.get(x, y));
  }

  clear() {
    this.cells.fill(0);
    this.ages.fill(0);
  }

  population() {
    let n = 0;
    for (let i = 0; i < this.cells.length; i += 1) if (this.cells[i]) n += 1;
    return n;
  }

  liveCells() {
    const out = [];
    const { w, h, cells } = this;
    for (let y = 0; y < h; y += 1) {
      const row = y * w;
      for (let x = 0; x < w; x += 1) if (cells[row + x]) out.push([x, y]);
    }
    return out;
  }

  clone() {
    const g = new Grid(this.w, this.h, this.wrap);
    g.cells.set(this.cells);
    g.ages.set(this.ages);
    return g;
  }

  copyFrom(other) {
    if (other.w !== this.w || other.h !== this.h) {
      this.w = other.w;
      this.h = other.h;
      const n = this.w * this.h;
      this.cells = new Uint8Array(other.cells);
      this.ages = new Uint16Array(other.ages);
      this.next = new Uint8Array(n);
      this.nextAges = new Uint16Array(n);
      this.wrap = other.wrap;
      return;
    }
    this.wrap = other.wrap;
    this.cells.set(other.cells);
    this.ages.set(other.ages);
  }

  snapshot() {
    return {
      w: this.w,
      h: this.h,
      wrap: this.wrap,
      cells: this.cells.slice(),
      ages: this.ages.slice(),
    };
  }

  restore(snap) {
    if (snap.w !== this.w || snap.h !== this.h) {
      this.w = snap.w;
      this.h = snap.h;
      this.cells = snap.cells.slice();
      this.ages = snap.ages.slice();
      this.next = new Uint8Array(this.w * this.h);
      this.nextAges = new Uint16Array(this.w * this.h);
      this.wrap = snap.wrap;
      return;
    }
    this.wrap = snap.wrap;
    this.cells.set(snap.cells);
    this.ages.set(snap.ages);
  }

  resize(w, h) {
    const next = new Grid(w, h, this.wrap);
    const mw = Math.min(this.w, next.w);
    const mh = Math.min(this.h, next.h);
    for (let y = 0; y < mh; y += 1) {
      for (let x = 0; x < mw; x += 1) {
        const i = this.idx(x, y);
        const j = next.idx(x, y);
        next.cells[j] = this.cells[i];
        next.ages[j] = this.ages[i];
      }
    }
    return next;
  }

  fillRandom(rng, density = 0.25) {
    const r = rng || new Rng(Date.now());
    for (let i = 0; i < this.cells.length; i += 1) {
      const live = r.nextF64() < density;
      this.cells[i] = live ? 1 : 0;
      this.ages[i] = live ? 1 : 0;
    }
  }

  countNeighbors(x, y) {
    return countNeighbors(this.cells, this.w, this.h, this.wrap, x, y);
  }

  step(rule = Rule.CONWAY) {
    const { w, h, wrap, cells, next, ages, nextAges } = this;
    let births = 0;
    let deaths = 0;
    let pop = 0;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const n = countNeighbors(cells, w, h, wrap, x, y);
        const i = y * w + x;
        const alive = cells[i] !== 0;
        const nextAlive = rule.nextAlive(alive, n);
        if (nextAlive) {
          next[i] = 1;
          pop += 1;
          if (alive) nextAges[i] = ages[i] === 65535 ? 65535 : ages[i] + 1;
          else {
            nextAges[i] = 1;
            births += 1;
          }
        } else {
          next[i] = 0;
          nextAges[i] = 0;
          if (alive) deaths += 1;
        }
      }
    }
    this.cells = next;
    this.next = cells;
    this.ages = nextAges;
    this.nextAges = ages;
    return { births, deaths, pop };
  }
}

function countNeighbors(cells, w, h, wrap, x, y) {
  let n = 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    let ny = y + dy;
    if (wrap) {
      if (ny < 0) ny += h;
      else if (ny >= h) ny -= h;
    } else if (ny < 0 || ny >= h) continue;
    const row = ny * w;
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      let nx = x + dx;
      if (wrap) {
        if (nx < 0) nx += w;
        else if (nx >= w) nx -= w;
      } else if (nx < 0 || nx >= w) continue;
      if (cells[row + nx]) n += 1;
    }
  }
  return n;
}

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;

/** FNV-1a of packed live cells — used for cycle detection. */
export function hashGrid(grid) {
  let h = FNV_OFFSET;
  const mix = (b) => {
    h = ((h ^ BigInt(b)) * FNV_PRIME) & 0xffffffffffffffffn;
  };
  mix(grid.w & 255);
  mix((grid.w >> 8) & 255);
  mix(grid.h & 255);
  mix((grid.h >> 8) & 255);
  let acc = 0;
  let bit = 0;
  for (let i = 0; i < grid.cells.length; i += 1) {
    if (grid.cells[i]) acc |= 1 << bit;
    bit += 1;
    if (bit === 8) {
      mix(acc);
      acc = 0;
      bit = 0;
    }
  }
  if (bit) mix(acc);
  return h.toString(16);
}

export function parseRle(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return { cells: [], width: 0, height: 0, rule: null };
  let rule = null;
  let body = "";
  let headerW = 0;
  let headerH = 0;
  for (const line of trimmed.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    if (t.startsWith("x") || t.startsWith("X")) {
      const wMatch = t.match(/x\s*=\s*(\d+)/i);
      const hMatch = t.match(/y\s*=\s*(\d+)/i);
      const ruleMatch = t.match(/rule\s*=\s*([^,\s]+)/i);
      if (wMatch) headerW = Number(wMatch[1]);
      if (hMatch) headerH = Number(hMatch[1]);
      if (ruleMatch) rule = ruleMatch[1];
      continue;
    }
    body += t;
  }
  if (!body) return parsePlain(text, rule);
  const cells = [];
  let x = 0;
  let y = 0;
  let run = 0;
  let maxX = 0;
  const take = () => {
    const n = run || 1;
    run = 0;
    return n;
  };
  for (const ch of body) {
    if (ch >= "0" && ch <= "9") {
      run = run * 10 + (ch.charCodeAt(0) - 48);
      continue;
    }
    if (ch === "b" || ch === "B") x += take();
    else if (ch === "o" || ch === "O") {
      const n = take();
      for (let i = 0; i < n; i += 1) cells.push([x + i, y]);
      x += n;
    } else if (ch === "$") {
      y += take();
      maxX = Math.max(maxX, x);
      x = 0;
    } else if (ch === "!") break;
    maxX = Math.max(maxX, x);
  }
  return {
    cells,
    width: Math.max(headerW, maxX, 0),
    height: Math.max(headerH, y + (x > 0 || cells.some((c) => c[1] === y) ? 1 : 0), 0),
    rule,
  };
}

function parsePlain(text, rule) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l && !l.startsWith("#"));
  const cells = [];
  let width = 0;
  lines.forEach((line, dy) => {
    width = Math.max(width, line.length);
    for (let dx = 0; dx < line.length; dx += 1) {
      const c = line[dx];
      if (c === "o" || c === "O" || c === "*" || c === "#") cells.push([dx, dy]);
    }
  });
  return { cells, width, height: lines.length, rule };
}

export function encodeRle(grid, rule = "B3/S23", name = "Life") {
  let minX = grid.w;
  let minY = grid.h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < grid.h; y += 1) {
    for (let x = 0; x < grid.w; x += 1) {
      if (grid.get(x, y)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  let out = `#N ${name}\n`;
  if (maxX < 0) return `${out}x = 0, y = 0, rule = ${rule}\n!\n`;
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  out += `x = ${w}, y = ${h}, rule = ${rule}\n`;
  let body = "";
  for (let y = minY; y <= maxY; y += 1) {
    let x = minX;
    while (x <= maxX) {
      const alive = grid.get(x, y);
      let run = 1;
      while (x + run <= maxX && grid.get(x + run, y) === alive) run += 1;
      if (run > 1) body += String(run);
      body += alive ? "o" : "b";
      x += run;
    }
    body = body.replace(/(\d+)?b$/, "");
    if (y < maxY) body += "$";
  }
  body += "!";
  for (let i = 0; i < body.length; i += 1) {
    if (i > 0 && i % 70 === 0) out += "\n";
    out += body[i];
  }
  return `${out}\n`;
}

export function applyCells(grid, cells, ox = 0, oy = 0, clear = true) {
  if (clear) grid.clear();
  for (const [x, y] of cells) grid.set(ox + x, oy + y, true);
}

export function applyRle(grid, text, { clear = true, center = true } = {}) {
  const parsed = parseRle(text);
  let ox = 0;
  let oy = 0;
  if (center) {
    ox = Math.max(0, Math.floor((grid.w - (parsed.width || 1)) / 2));
    oy = Math.max(0, Math.floor((grid.h - (parsed.height || 1)) / 2));
  }
  applyCells(grid, parsed.cells, ox, oy, clear);
  return parsed;
}

export function encodeCellList(grid) {
  return grid.liveCells().map(([x, y]) => `${x},${y}`).join(";");
}

export function parseCellList(text) {
  const cells = [];
  const raw = String(text || "").trim();
  if (!raw) return cells;
  for (const part of raw.split(/[;_\s]+/)) {
    if (!part) continue;
    const [xs, ys] = part.split(",");
    const x = Number(xs);
    const y = Number(ys);
    if (Number.isFinite(x) && Number.isFinite(y)) cells.push([x | 0, y | 0]);
  }
  return cells;
}

export function applyCellList(grid, text, { clear = true, center = false } = {}) {
  const cells = parseCellList(text);
  let ox = 0;
  let oy = 0;
  if (center && cells.length) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of cells) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    ox = Math.max(0, Math.floor((grid.w - (maxX - minX + 1)) / 2) - minX);
    oy = Math.max(0, Math.floor((grid.h - (maxY - minY + 1)) / 2) - minY);
  }
  applyCells(grid, cells, ox, oy, clear);
  return cells;
}

export function parseShareHash(hash) {
  const raw = String(hash || "").replace(/^#/, "").trim();
  if (!raw) return null;
  if (raw.startsWith("rle=")) {
    return { type: "rle", rle: decodeURIComponent(raw.slice(4)) };
  }
  if (raw.startsWith("cells=")) {
    return { type: "cells", cells: decodeURIComponent(raw.slice(6)) };
  }
  try {
    const q = new URLSearchParams(raw);
    if (q.has("rle")) {
      return {
        type: "rle",
        rle: q.get("rle"),
        w: numOr(q.get("w")),
        h: numOr(q.get("h")),
        wrap: q.get("wrap") == null ? null : q.get("wrap") !== "0",
        rule: q.get("rule"),
      };
    }
    if (q.has("cells")) {
      return {
        type: "cells",
        cells: q.get("cells"),
        w: numOr(q.get("w")),
        h: numOr(q.get("h")),
        wrap: q.get("wrap") == null ? null : q.get("wrap") !== "0",
        rule: q.get("rule"),
      };
    }
  } catch {
    return null;
  }
  if (/[oO$!]/.test(raw) || raw.includes("rule")) return { type: "rle", rle: decodeURIComponent(raw) };
  if (raw.includes(",") && (raw.includes(";") || raw.includes("_"))) {
    return { type: "cells", cells: decodeURIComponent(raw) };
  }
  return null;
}

function numOr(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n | 0 : null;
}

export function shareHash(grid, rule = Rule.CONWAY) {
  const q = new URLSearchParams();
  q.set("w", String(grid.w));
  q.set("h", String(grid.h));
  q.set("wrap", grid.wrap ? "1" : "0");
  q.set("rule", rule.id || rule.toBs());
  const pop = grid.population();
  if (pop > 0 && pop <= 400) q.set("cells", encodeCellList(grid));
  else q.set("rle", encodeRle(grid, rule.toBs()).replace(/\s+/g, ""));
  return `#${q.toString()}`;
}

export function bboxOf(cells) {
  if (!cells.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0, w: 0, h: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of cells) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}
