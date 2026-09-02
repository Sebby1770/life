/** Tiny WebAudio ticks. No autoplay — starts after a user gesture. */

let ctx = null;
let unlocked = false;
let muted = false;

function ac() {
  if (ctx) return ctx;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

export function setMuted(value) {
  muted = Boolean(value);
  if (muted && ctx && ctx.state === "running") ctx.suspend().catch(() => {});
  if (!muted && unlocked && ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
}

export function isMuted() {
  return muted;
}

export function unlock() {
  unlocked = true;
  const c = ac();
  if (!c) return;
  if (!muted && c.state === "suspended") c.resume().catch(() => {});
}

function tone(freq, dur, gain, type = "sine", at = 0) {
  if (muted || !unlocked) return;
  const c = ac();
  if (!c || c.state !== "running") return;
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Quiet tick when a cluster of cells is born. */
export function tickBirths(n) {
  if (n < 3) return;
  const g = Math.min(0.018, 0.006 + n * 0.0004);
  tone(880 + Math.min(n, 24) * 8, 0.04, g, "triangle");
}

export function winChime() {
  tone(523.25, 0.12, 0.04, "sine", 0);
  tone(659.25, 0.14, 0.035, "sine", 0.08);
  tone(783.99, 0.22, 0.04, "triangle", 0.16);
}

export function failThud() {
  tone(110, 0.18, 0.03, "sine", 0);
}
