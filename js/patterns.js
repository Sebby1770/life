/** Stamp catalog for Life. Arts use o = live, . = dead. */

export const ARTS = {
  glider: ".o.\n..o\nooo",
  lwss: ".o..o\no....\no...o\noooo.",
  blinker: "ooo",
  toad: ".ooo\nooo.",
  beacon: "oo..\noo..\n..oo\n..oo",
  pulsar:
    "..ooo...ooo..\n.............\no....o.o....o\no....o.o....o\no....o.o....o\n..ooo...ooo..\n.............\n..ooo...ooo..\no....o.o....o\no....o.o....o\no....o.o....o\n.............\n..ooo...ooo..",
  gosper:
    "........................o...........\n......................o.o...........\n............oo......oo............oo\n...........o...o....oo............oo\noo........o.....o...oo..............\noo........o...o.oo....o.o...........\n..........o.....o.......o...........\n...........o...o....................\n............oo......................",
  acorn: ".o.....\n...o...\noo..ooo",
  rpentomino: ".oo\noo.\n.o.",
  pentadecathlon: "..o....o..\noo.oooo.oo\n..o....o..",
  block: "oo\noo",
  beehive: ".oo.\no..o\n.oo.",
  loaf: ".oo.\no..o\n.o.o\n..o.",
  boat: "oo.\no.o\n.o.",
};

export const STAMP_META = {
  glider: { name: "Glider", kind: "ship" },
  lwss: { name: "LWSS", kind: "ship" },
  blinker: { name: "Blinker", kind: "osc" },
  toad: { name: "Toad", kind: "osc" },
  beacon: { name: "Beacon", kind: "osc" },
  pulsar: { name: "Pulsar", kind: "osc" },
  gosper: { name: "Gosper gun", kind: "gun" },
  acorn: { name: "Acorn", kind: "methuselah" },
  rpentomino: { name: "R-pentomino", kind: "methuselah" },
  pentadecathlon: { name: "Pentadecathlon", kind: "osc" },
  block: { name: "Block", kind: "still" },
  beehive: { name: "Beehive", kind: "still" },
  loaf: { name: "Loaf", kind: "still" },
  boat: { name: "Boat", kind: "still" },
};

export const STAMP_IDS = [
  "glider",
  "lwss",
  "blinker",
  "toad",
  "beacon",
  "pulsar",
  "gosper",
  "acorn",
  "rpentomino",
  "pentadecathlon",
  "block",
  "beehive",
  "loaf",
  "boat",
];

export function artSize(art) {
  const lines = String(art).split("\n");
  return { w: Math.max(0, ...lines.map((l) => l.length)), h: lines.length };
}

export function cellsFromArt(art, ox = 0, oy = 0) {
  const cells = [];
  const lines = String(art).split("\n");
  for (let y = 0; y < lines.length; y += 1) {
    const line = lines[y];
    for (let x = 0; x < line.length; x += 1) {
      const c = line[x];
      if (c === "o" || c === "O" || c === "#" || c === "*") cells.push([ox + x, oy + y]);
    }
  }
  return cells;
}

export function placeArt(grid, art, ox, oy) {
  let n = 0;
  for (const [x, y] of cellsFromArt(art, ox, oy)) {
    if (grid.set(x, y, true)) n += 1;
  }
  return n;
}

export function placeStamp(grid, id, ox, oy) {
  const art = ARTS[id];
  if (!art) throw new Error(`unknown stamp: ${id}`);
  return placeArt(grid, art, ox, oy);
}

export function stampSize(id) {
  const art = ARTS[id];
  if (!art) return { w: 0, h: 0 };
  return artSize(art);
}

export function centeredOrigin(grid, id) {
  const { w, h } = stampSize(id);
  return [Math.max(0, Math.floor((grid.w - w) / 2)), Math.max(0, Math.floor((grid.h - h) / 2))];
}

export function placeStampCentered(grid, id) {
  const [ox, oy] = centeredOrigin(grid, id);
  placeStamp(grid, id, ox, oy);
  return [ox, oy];
}

export function nextStampId(id) {
  const i = STAMP_IDS.indexOf(id);
  return STAMP_IDS[(i + 1) % STAMP_IDS.length];
}
