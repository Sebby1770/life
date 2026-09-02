/** Canvas glow cells — lime/cyan on a void. */

export const THEMES = {
  lime: {
    void: "#050b14",
    board: "#07111d",
    young: "#e8ff7a",
    mid: "#c6ff4a",
    old: "#4ad4ff",
    glow: "rgba(180, 255, 90, 0.65)",
    spark: "#b8ff4a",
  },
  fire: {
    void: "#140805",
    board: "#1d0c07",
    young: "#ffe9a0",
    mid: "#ff7a2a",
    old: "#c81e1e",
    glow: "rgba(255, 120, 40, 0.65)",
    spark: "#ff8a3a",
  },
  ocean: {
    void: "#041018",
    board: "#071820",
    young: "#d4ffff",
    mid: "#3ee0ff",
    old: "#3a6cff",
    glow: "rgba(80, 220, 255, 0.65)",
    spark: "#5ef0ff",
  },
  mono: {
    void: "#09090b",
    board: "#121214",
    young: "#f4f4f0",
    mid: "#c8c8c2",
    old: "#7a7a74",
    glow: "rgba(255, 255, 255, 0.35)",
    spark: "#e8e8e2",
  },
};

export class Renderer {
  constructor(canvas, sparkCanvas) {
    this.canvas = canvas;
    this.sparkCanvas = sparkCanvas;
    this.ctx = canvas.getContext("2d");
    this.sparkCtx = sparkCanvas ? sparkCanvas.getContext("2d") : null;
    this.cam = { x: 0, y: 0, scale: 1 };
    this.reducedMotion = false;
    this.hover = null;
    this.ghost = null;
    this.target = null;
    this.history = [];
    this.dpr = 1;
    this.themeId = "lime";
    this.theme = THEMES.lime;
    this.ageHeat = true;
  }

  setTheme(id) {
    this.themeId = THEMES[id] ? id : "lime";
    this.theme = THEMES[this.themeId];
  }

  setAgeHeat(on) {
    this.ageHeat = Boolean(on);
  }

  setReducedMotion(on) {
    this.reducedMotion = Boolean(on);
  }

  resetCamera(grid) {
    this.cam.x = 0;
    this.cam.y = 0;
    this.fit(grid);
  }

  fit(grid) {
    const cssW = Math.max(1, this.canvas.clientWidth || this.canvas.width);
    const cssH = Math.max(1, this.canvas.clientHeight || this.canvas.height);
    const s = Math.min(cssW / grid.w, cssH / grid.h);
    this.cam.scale = Math.max(2, s);
    this.cam.x = (grid.w - cssW / this.cam.scale) / 2;
    this.cam.y = (grid.h - cssH / this.cam.scale) / 2;
  }

  screenToCell(px, py) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (px - rect.left) / this.cam.scale + this.cam.x;
    const y = (py - rect.top) / this.cam.scale + this.cam.y;
    return [Math.floor(x), Math.floor(y)];
  }

  zoomAt(px, py, factor) {
    const rect = this.canvas.getBoundingClientRect();
    const lx = px - rect.left;
    const ly = py - rect.top;
    const beforeX = lx / this.cam.scale + this.cam.x;
    const beforeY = ly / this.cam.scale + this.cam.y;
    this.cam.scale = Math.min(48, Math.max(2, this.cam.scale * factor));
    this.cam.x = beforeX - lx / this.cam.scale;
    this.cam.y = beforeY - ly / this.cam.scale;
  }

  pan(dx, dy) {
    this.cam.x -= dx / this.cam.scale;
    this.cam.y -= dy / this.cam.scale;
  }

  resize() {
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    this.dpr = dpr;
    const w = Math.max(320, this.canvas.clientWidth || 320);
    const h = Math.max(320, this.canvas.clientHeight || 320);
    if (this.canvas.width !== Math.floor(w * dpr) || this.canvas.height !== Math.floor(h * dpr)) {
      this.canvas.width = Math.floor(w * dpr);
      this.canvas.height = Math.floor(h * dpr);
    }
    if (this.sparkCanvas) {
      const sw = Math.max(120, this.sparkCanvas.clientWidth || w);
      const sh = Math.max(36, this.sparkCanvas.clientHeight || 40);
      this.sparkCanvas.width = Math.floor(sw * dpr);
      this.sparkCanvas.height = Math.floor(sh * dpr);
    }
  }

  pushPop(pop) {
    this.history.push(pop);
    if (this.history.length > 160) this.history.shift();
  }

  clearHistory() {
    this.history = [];
  }

  draw(grid) {
    this.resize();
    const ctx = this.ctx;
    const dpr = this.dpr;
    const cssW = this.canvas.width / dpr;
    const cssH = this.canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = this.theme.void;
    ctx.fillRect(0, 0, cssW, cssH);

    const s = this.cam.scale;
    const ox = -this.cam.x * s;
    const oy = -this.cam.y * s;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cssW, cssH);
    ctx.clip();

    ctx.fillStyle = this.theme.board;
    ctx.fillRect(ox, oy, grid.w * s, grid.h * s);

    if (s >= 8) {
      ctx.strokeStyle = "rgba(70, 130, 170, 0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      const x0 = Math.max(0, Math.floor(this.cam.x));
      const y0 = Math.max(0, Math.floor(this.cam.y));
      const x1 = Math.min(grid.w, Math.ceil(this.cam.x + cssW / s) + 1);
      const y1 = Math.min(grid.h, Math.ceil(this.cam.y + cssH / s) + 1);
      for (let x = x0; x <= x1; x += 1) {
        ctx.moveTo(ox + x * s, oy + y0 * s);
        ctx.lineTo(ox + x * s, oy + y1 * s);
      }
      for (let y = y0; y <= y1; y += 1) {
        ctx.moveTo(ox + x0 * s, oy + y * s);
        ctx.lineTo(ox + x1 * s, oy + y * s);
      }
      ctx.stroke();
    }

    if (this.target && this.target.length) {
      ctx.fillStyle = "rgba(255, 92, 168, 0.18)";
      ctx.strokeStyle = "rgba(255, 92, 168, 0.55)";
      ctx.lineWidth = Math.max(1, s * 0.08);
      for (const [x, y] of this.target) {
        roundCell(ctx, ox + x * s, oy + y * s, s, 0.18);
        ctx.fill();
        ctx.stroke();
      }
    }

    if (this.ghost && this.ghost.length) {
      ctx.fillStyle = "rgba(94, 240, 255, 0.28)";
      for (const [x, y] of this.ghost) {
        roundCell(ctx, ox + x * s, oy + y * s, s, 0.2);
        ctx.fill();
      }
    }

    const glow = !this.reducedMotion && s >= 5;
    if (glow) {
      ctx.shadowColor = this.theme.glow;
      ctx.shadowBlur = Math.min(18, s * 0.7);
    }

    const { w, h, cells, ages } = grid;
    const x0 = Math.max(0, Math.floor(this.cam.x) - 1);
    const y0 = Math.max(0, Math.floor(this.cam.y) - 1);
    const x1 = Math.min(w, Math.ceil(this.cam.x + cssW / s) + 1);
    const y1 = Math.min(h, Math.ceil(this.cam.y + cssH / s) + 1);
    const pad = Math.max(0.5, s * 0.08);

    for (let y = y0; y < y1; y += 1) {
      const row = y * w;
      for (let x = x0; x < x1; x += 1) {
        if (!cells[row + x]) continue;
        const age = ages[row + x] || 1;
        ctx.fillStyle = cellColor(age, this.theme, this.ageHeat);
        const px = ox + x * s + pad;
        const py = oy + y * s + pad;
        const sz = s - pad * 2;
        roundCell(ctx, px, py, sz, 0.22);
        ctx.fill();
      }
    }

    ctx.shadowBlur = 0;

    if (this.hover) {
      const [hx, hy] = this.hover;
      if (hx >= 0 && hy >= 0 && hx < w && hy < h) {
        ctx.strokeStyle = "rgba(94, 240, 255, 0.8)";
        ctx.lineWidth = Math.max(1, s * 0.08);
        roundCell(ctx, ox + hx * s, oy + hy * s, s, 0.2);
        ctx.stroke();
      }
    }

    ctx.strokeStyle = "rgba(94, 240, 255, 0.22)";
    ctx.lineWidth = 2;
    ctx.strokeRect(ox + 0.5, oy + 0.5, grid.w * s - 1, grid.h * s - 1);
    ctx.restore();

    this.drawSpark();
  }

  drawSpark() {
    if (!this.sparkCtx || !this.sparkCanvas) return;
    const ctx = this.sparkCtx;
    const dpr = this.dpr;
    const w = this.sparkCanvas.width / dpr;
    const h = this.sparkCanvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(5, 12, 20, 0.9)";
    ctx.fillRect(0, 0, w, h);
    const hist = this.history;
    if (hist.length < 2) return;
    const max = Math.max(1, ...hist);
    ctx.beginPath();
    ctx.strokeStyle = this.theme.spark;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < hist.length; i += 1) {
      const x = (i / (hist.length - 1)) * (w - 4) + 2;
      const y = h - 4 - (hist[i] / max) * (h - 8);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    if (!this.reducedMotion) {
      ctx.strokeStyle = "rgba(94, 240, 255, 0.35)";
      ctx.stroke();
    }
  }
}

function roundCell(ctx, x, y, s, rRatio) {
  const r = Math.max(0.5, s * rRatio);
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, s, s, r);
  else ctx.rect(x, y, s, s);
}

function cellColor(age, theme, ageHeat) {
  if (!ageHeat) return theme.mid;
  if (age <= 1) return theme.young;
  if (age <= 8) return theme.mid;
  return theme.old;
}
