import { Grid, Rule, Rng, hashGrid, applyRle, applyCellList, parseShareHash, shareHash, parseRule } from "./engine.js";
import { ARTS, STAMP_IDS, STAMP_META, artSize, cellsFromArt, placeStamp, placeStampCentered, nextStampId } from "./patterns.js";
import { CHALLENGES, challengeById, checkRun, awardStars, gardenTarget, createChallengeGrid, seedKeepAlive } from "./challenges.js";
import { todayISO, makeDailySoup, scoreDaily, DAILY_MAX_GENS } from "./daily.js";
import * as store from "./storage.js";
import * as audio from "./audio.js";
import { Renderer } from "./renderer.js";
import { bindInput, isTypingTarget } from "./input.js";

const SPEEDS = [1, 2, 3, 5, 8, 12, 16, 24, 30, 45, 60];
const UNDO_LIMIT = 48;

const els = {};
const state = {
  screen: "title",
  mode: "sandbox",
  overlay: null,
  grid: new Grid(80, 48, true),
  rule: Rule.CONWAY,
  running: false,
  gen: 0,
  pop: 0,
  peak: 0,
  speed: 12,
  stampId: null,
  challenge: null,
  cooldown: 0,
  won: false,
  failed: false,
  hashes: new Map(),
  cycleAt: -1,
  dailyIso: todayISO(),
  dailyDone: false,
  panMode: false,
};

const undo = [];
let renderer;
let inputCtl;
let lastTs = 0;
let acc = 0;
let hudDirty = true;

function $(id) {
  return document.getElementById(id);
}

function init() {
  els.title = $("title-screen");
  els.play = $("play-screen");
  els.howto = $("overlay-howto");
  els.pause = $("overlay-pause");
  els.success = $("overlay-success");
  els.fail = $("overlay-fail");
  els.toast = $("toast");
  els.board = $("board");
  renderer = new Renderer(els.board, $("spark"));
  const settings = store.getSettings();
  audio.setMuted(settings.mute);
  renderer.setReducedMotion(settings.reducedMotion);
  $("chk-mute").checked = settings.mute;
  $("chk-motion").checked = settings.reducedMotion;

  buildStamps();
  buildChallenges();
  bindUi();
  inputCtl = bindInput(els.board, {
    unlock: () => audio.unlock(),
    paint: onPaint,
    hover: onHover,
    pan: (dx, dy) => renderer.pan(dx, dy),
    zoom: (x, y, f) => renderer.zoomAt(x, y, f),
    strokeStart: () => {
      if (canEdit()) pushUndo();
    },
    strokeEnd: () => {
      hudDirty = true;
      maybeGardenWin();
    },
    keydown: onKey,
    spaceTap: () => {
      if (state.overlay || state.screen !== "play") return;
      setRunning(!state.running);
    },
  });

  window.addEventListener("resize", () => {
    renderer.resize();
    renderer.draw(state.grid);
  });

  loadShareIfAny();
  updateChrome();
  renderer.resetCamera(state.grid);
  requestAnimationFrame(loop);
}

function buildStamps() {
  const root = $("stamps");
  root.innerHTML = "";
  const paint = document.createElement("button");
  paint.className = "stamp active";
  paint.dataset.stamp = "";
  paint.innerHTML = `<span class="mini" style="grid-template-columns:repeat(2,1fr)"><i class="on"></i><i></i><i></i><i class="on"></i></span>Paint`;
  paint.addEventListener("click", () => selectStamp(null));
  root.append(paint);
  for (const id of STAMP_IDS) {
    const art = ARTS[id];
    const { w, h } = artSize(art);
    const live = new Set(cellsFromArt(art).map(([x, y]) => `${x},${y}`));
    const btn = document.createElement("button");
    btn.className = "stamp";
    btn.dataset.stamp = id;
    btn.title = STAMP_META[id].name;
    let mini = `<span class="mini" style="grid-template-columns:repeat(${w},1fr);grid-template-rows:repeat(${h},1fr)">`;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) mini += `<i class="${live.has(`${x},${y}`) ? "on" : ""}"></i>`;
    }
    mini += `</span>${STAMP_META[id].name}`;
    btn.innerHTML = mini;
    btn.addEventListener("click", () => selectStamp(id));
    root.append(btn);
  }
}

function selectStamp(id) {
  state.stampId = id;
  for (const btn of $("stamps").querySelectorAll(".stamp")) {
    btn.classList.toggle("active", (btn.dataset.stamp || "") === (id || ""));
  }
}

function buildChallenges() {
  const root = $("challenge-list");
  root.innerHTML = "";
  CHALLENGES.forEach((ch, i) => {
    const rec = store.challengeRecord(ch.id);
    const btn = document.createElement("button");
    btn.dataset.cid = ch.id;
    btn.innerHTML = `<span>${i + 1}. ${ch.title}</span><span class="stars">${starText(rec.stars)}</span>`;
    btn.addEventListener("click", () => openChallenge(ch.id));
    root.append(btn);
  });
}

function starText(n) {
  return "★".repeat(n) + "☆".repeat(Math.max(0, 3 - n));
}

function bindUi() {
  $("btn-sandbox").addEventListener("click", () => openSandbox());
  $("btn-challenges").addEventListener("click", () => openChallenges());
  $("btn-daily").addEventListener("click", () => openDaily());
  $("btn-howto").addEventListener("click", () => showOverlay("howto"));
  $("btn-howto-close").addEventListener("click", () => hideOverlay());
  $("btn-menu").addEventListener("click", () => showOverlay("pause"));
  $("btn-settings").addEventListener("click", () => showOverlay("pause"));
  $("btn-resume").addEventListener("click", () => hideOverlay());
  $("btn-title").addEventListener("click", () => goTitle());
  $("btn-howto-from-pause").addEventListener("click", () => showOverlay("howto"));
  $("chk-mute").addEventListener("change", (e) => {
    store.setSettings({ mute: e.target.checked });
    audio.setMuted(e.target.checked);
  });
  $("chk-motion").addEventListener("change", (e) => {
    store.setSettings({ reducedMotion: e.target.checked });
    renderer.setReducedMotion(e.target.checked);
  });
  $("btn-clear-progress").addEventListener("click", () => {
    if (confirm("Erase challenge stars, daily scores, and achievements?")) {
      store.clearProgress();
      buildChallenges();
      toast("Progress wiped");
    }
  });
  $("btn-play").addEventListener("click", () => setRunning(true));
  $("btn-pause").addEventListener("click", () => setRunning(false));
  $("btn-step").addEventListener("click", () => {
    setRunning(false);
    doStep();
  });
  $("btn-clear").addEventListener("click", () => {
    if (state.mode === "daily") return;
    pushUndo();
    if (state.mode === "challenge" && state.challenge?.keepAlive) {
      seedKeepAlive(state.grid, state.challenge.seed ?? 42);
      state.cooldown = 0;
    } else state.grid.clear();
    resetRunStats();
    hudDirty = true;
  });
  $("btn-reseed").addEventListener("click", () => {
    if (state.mode !== "sandbox") return;
    pushUndo();
    state.grid.fillRandom(new Rng(Date.now()), 0.28);
    resetRunStats();
    hudDirty = true;
  });
  $("btn-undo").addEventListener("click", () => doUndo());
  $("btn-share").addEventListener("click", copyShare);
  $("chk-wrap").addEventListener("change", (e) => {
    state.grid.wrap = e.target.checked;
    hudDirty = true;
  });
  $("sel-rule").addEventListener("change", (e) => {
    state.rule = parseRule(e.target.value);
  });
  $("rng-size").addEventListener("input", (e) => {
    const w = Number(e.target.value);
    $("size-label").textContent = `${w}×${sizeH(w)}`;
  });
  $("rng-size").addEventListener("change", (e) => {
    const w = Number(e.target.value);
    resizeGrid(w, sizeH(w));
  });
  $("rng-speed").addEventListener("input", (e) => {
    state.speed = Number(e.target.value);
    hudDirty = true;
  });
  $("btn-run").addEventListener("click", () => {
    if (state.won) return;
    pushUndo();
    resetRunStats(false);
    setRunning(true);
  });
  $("btn-reset").addEventListener("click", () => {
    if (state.challenge) openChallenge(state.challenge.id);
  });
  $("btn-hint").addEventListener("click", () => {
    if (!state.challenge) return;
    toast(state.challenge.hint);
  });
  $("btn-next").addEventListener("click", () => {
    hideOverlay();
    const i = CHALLENGES.findIndex((c) => c.id === state.challenge?.id);
    const next = CHALLENGES[i + 1];
    if (next) openChallenge(next.id);
    else openChallenges();
  });
  $("btn-success-close").addEventListener("click", hideOverlay);
  $("btn-fail-close").addEventListener("click", () => {
    hideOverlay();
    if (state.mode === "challenge" && state.challenge) openChallenge(state.challenge.id);
  });
  $("btn-daily-go").addEventListener("click", () => {
    if (state.dailyDone) openDaily(true);
    resetRunStats();
    setRunning(true);
  });
  $("btn-pan").addEventListener("click", () => {
    state.panMode = !state.panMode;
    inputCtl?.setPanMode(state.panMode);
    $("btn-pan").classList.toggle("active", state.panMode);
    els.board.style.cursor = state.panMode ? "grab" : "crosshair";
  });
}

function sizeH(w) {
  return Math.max(24, Math.round(w * 0.6));
}

function canEdit() {
  if (state.overlay) return false;
  if (state.mode === "daily") return false;
  if (state.mode === "challenge") {
    if (state.won || state.failed) return false;
    if (state.challenge?.keepAlive) return true;
    return !state.running;
  }
  return true;
}

function onPaint(ev, erase, moving) {
  if (!canEdit()) return;
  const [x, y] = renderer.screenToCell(ev.clientX, ev.clientY);
  if (!state.grid.inBounds(x, y)) return;

  if (state.mode === "challenge" && state.challenge?.keepAlive) {
    if (erase) return;
    if (state.cooldown > 0) return;
    if (state.grid.get(x, y)) return;
    state.grid.set(x, y, true);
    state.cooldown = 8;
    state.pop = state.grid.population();
    hudDirty = true;
    return;
  }

  if (state.stampId && !erase) {
    if (moving) return;
    const { w, h } = artSize(ARTS[state.stampId]);
    const ox = x - Math.floor(w / 2);
    const oy = y - Math.floor(h / 2);
    const probe = state.grid.clone();
    placeStamp(probe, state.stampId, ox, oy);
    if (overBudget(probe.population())) {
      toast("Over budget");
      return;
    }
    placeStamp(state.grid, state.stampId, ox, oy);
    state.pop = state.grid.population();
    hudDirty = true;
    maybeGardenWin();
    return;
  }

  const nextAlive = !erase;
  if (state.mode === "challenge" && nextAlive && !state.grid.get(x, y)) {
    if (overBudget(state.grid.population() + 1)) return;
  }
  state.grid.set(x, y, nextAlive);
  state.pop = state.grid.population();
  hudDirty = true;
}

function overBudget(pop) {
  if (state.mode !== "challenge" || !state.challenge) return false;
  if (state.challenge.keepAlive) return false;
  return pop > state.challenge.budget;
}

function maybeGardenWin() {
  if (state.mode !== "challenge" || state.challenge?.id !== "garden" || state.won) return;
  if (checkRun(state.challenge, state.grid, { gen: 0, peak: state.grid.population() })) {
    celebrate(0);
  }
}

function onHover(ev) {
  const [x, y] = renderer.screenToCell(ev.clientX, ev.clientY);
  renderer.hover = [x, y];
  if (state.stampId && canEdit() && !(state.mode === "challenge" && state.challenge?.keepAlive)) {
    const { w, h } = artSize(ARTS[state.stampId]);
    const ox = x - Math.floor(w / 2);
    const oy = y - Math.floor(h / 2);
    renderer.ghost = cellsFromArt(ARTS[state.stampId], ox, oy);
  } else renderer.ghost = null;
}

function onKey(ev) {
  if (isTypingTarget(ev.target)) return;
  audio.unlock();
  const key = ev.key;
  if (key === "Escape") {
    ev.preventDefault();
    if (state.overlay === "howto") hideOverlay();
    else if (state.overlay === "pause") goTitle();
    else if (state.overlay) hideOverlay();
    else if (state.screen === "play") showOverlay("pause");
    return;
  }
  if (state.overlay) return;
  if (key === ".") {
    ev.preventDefault();
    setRunning(false);
    doStep();
    return;
  }
  if (key === "n" || key === "N") {
    state.stampId = nextStampId(state.stampId || "glider");
    selectStamp(state.stampId);
    return;
  }
  if (key === "[") {
    bumpSpeed(-1);
    return;
  }
  if (key === "]") {
    bumpSpeed(1);
    return;
  }
  if (key === "u" || key === "U") {
    doUndo();
    return;
  }
}

function bumpSpeed(dir) {
  let i = SPEEDS.findIndex((s) => s >= state.speed);
  if (i < 0) i = SPEEDS.length - 1;
  i = Math.max(0, Math.min(SPEEDS.length - 1, i + dir));
  state.speed = SPEEDS[i];
  $("rng-speed").value = String(state.speed);
  hudDirty = true;
}

function pushUndo() {
  undo.push({
    snap: state.grid.snapshot(),
    gen: state.gen,
    peak: state.peak,
    cooldown: state.cooldown,
    running: false,
    won: state.won,
    failed: state.failed,
    hashes: new Map(state.hashes),
  });
  if (undo.length > UNDO_LIMIT) undo.shift();
}

function doUndo() {
  const u = undo.pop();
  if (!u) return;
  state.grid.restore(u.snap);
  state.gen = u.gen;
  state.peak = u.peak;
  state.cooldown = u.cooldown;
  state.won = u.won;
  state.failed = u.failed;
  state.hashes = u.hashes;
  state.running = false;
  state.pop = state.grid.population();
  hudDirty = true;
}

function setRunning(on) {
  if (state.won && on) return;
  if (state.failed && on) return;
  if (state.overlay && on) return;
  state.running = Boolean(on);
  if (on && state.hashes.size === 0) state.hashes.set(hashGrid(state.grid), state.gen);
  hudDirty = true;
}

function resetRunStats(clearHashes = true) {
  state.gen = 0;
  state.pop = state.grid.population();
  state.peak = state.pop;
  state.won = false;
  state.failed = false;
  state.dailyDone = false;
  state.cycleAt = -1;
  if (clearHashes) state.hashes = new Map([[hashGrid(state.grid), 0]]);
  renderer.clearHistory();
  renderer.pushPop(state.pop);
  hudDirty = true;
}

function doStep() {
  if (state.won || state.failed) return;
  const result = state.grid.step(state.rule);
  state.gen += 1;
  state.pop = result.pop;
  if (state.pop > state.peak) state.peak = state.pop;
  renderer.pushPop(state.pop);
  if (result.births >= 3) audio.tickBirths(result.births);
  if (state.challenge?.keepAlive && state.cooldown > 0) state.cooldown -= 1;

  const h = hashGrid(state.grid);
  let cycled = false;
  if (state.hashes.has(h)) {
    cycled = true;
    state.cycleAt = state.gen;
  } else state.hashes.set(h, state.gen);

  if (state.mode === "challenge" && state.challenge) tickChallenge(cycled);
  else if (state.mode === "daily") tickDaily(cycled);

  hudDirty = true;
}

function tickChallenge(cycled) {
  const ch = state.challenge;
  const stats = { gen: state.gen, peak: state.peak, cycleAt: state.cycleAt, pop: state.pop };
  if (checkRun(ch, state.grid, stats)) {
    celebrate(state.gen);
    return;
  }
  if (state.pop === 0 && ch.id !== "peak-16") {
    failRun("Extinct.");
    return;
  }
  if (ch.id === "methuselah") {
    if (cycled && state.gen < 60) failRun("It settled too soon.");
    return;
  }
  if (ch.id === "keep-alive") {
    if (state.pop === 0) failRun("The seed went dark.");
    else if (state.gen >= ch.capGens && state.pop > 0) celebrate(state.gen);
    return;
  }
  if (ch.id === "peak-16") {
    if (state.gen >= ch.capGens) failRun("Never reached 16.");
    return;
  }
  if (cycled) failRun("That pattern is not the goal.");
  else if (state.gen >= ch.capGens) failRun("Time's up.");
}

function tickDaily(cycled) {
  if (state.pop === 0 || cycled || state.gen >= DAILY_MAX_GENS) {
    state.running = false;
    state.dailyDone = true;
    const score = scoreDaily(state.peak, state.gen);
    const best = store.setDailyBest(state.dailyIso, {
      score,
      peak: state.peak,
      gens: state.gen,
    });
    $("daily-score").textContent = String(score);
    $("daily-best").textContent = `Best ${best.score}`;
    $("daily-reason").textContent =
      state.pop === 0 ? "Extinct" : cycled ? "Stable" : "400 generation cap";
    store.unlockAchievement("daily");
    hudDirty = true;
  }
}

function celebrate(gens) {
  if (state.won) return;
  state.won = true;
  state.running = false;
  const stars = awardStars(state.challenge, {
    win: true,
    gens,
    peak: state.peak,
    pop: state.pop,
    lived: gens,
  });
  store.setChallengeStars(state.challenge.id, stars);
  store.unlockAchievement("first-win");
  store.unlockAchievement(state.challenge.id);
  buildChallenges();
  audio.winChime();
  $("success-title").textContent = `${state.challenge.title} complete`;
  $("success-stars").textContent = starText(stars);
  $("success-copy").textContent = stars === 3 ? "Perfect pulse." : stars === 2 ? "Strong pattern." : "It lives.";
  showOverlay("success");
}

function failRun(msg) {
  if (state.won || state.failed) return;
  state.failed = true;
  state.running = false;
  audio.failThud();
  $("fail-copy").textContent = msg;
  showOverlay("fail");
}

function copyShare() {
  const hash = shareHash(state.grid, state.rule);
  const url = `${location.origin}${location.pathname}${hash}`;
  try {
    history.replaceState(null, "", hash);
  } catch {
    /* ignore */
  }
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).then(
      () => toast("Share link copied"),
      () => toast(url),
    );
  } else toast(url);
}

function loadShareIfAny() {
  const parsed = parseShareHash(location.hash);
  if (!parsed) return;
  openSandbox();
  if (parsed.w && parsed.h) {
    state.grid = new Grid(parsed.w, parsed.h, parsed.wrap ?? true);
    $("rng-size").value = String(parsed.w);
    $("size-label").textContent = `${parsed.w}×${parsed.h}`;
  }
  if (parsed.rule) {
    try {
      state.rule = parseRule(parsed.rule);
      $("sel-rule").value = state.rule.id || "conway";
    } catch {
      state.rule = Rule.CONWAY;
    }
  }
  if (parsed.type === "rle") applyRle(state.grid, parsed.rle);
  else if (parsed.type === "cells") applyCellList(state.grid, parsed.cells);
  resetRunStats();
  renderer.resetCamera(state.grid);
}

function resizeGrid(w, h) {
  pushUndo();
  state.grid = state.grid.resize(w, h);
  resetRunStats();
  renderer.resetCamera(state.grid);
}

function openSandbox() {
  state.mode = "sandbox";
  state.screen = "play";
  state.challenge = null;
  state.rule = Rule.CONWAY;
  state.grid = new Grid(Number($("rng-size").value) || 80, sizeH(Number($("rng-size").value) || 80), $("chk-wrap").checked);
  placeStampCentered(state.grid, "gosper");
  renderer.target = null;
  undo.length = 0;
  resetRunStats();
  hideOverlay();
  showPlay();
  renderer.resetCamera(state.grid);
}

function openChallenges() {
  const next = CHALLENGES.find((c) => !store.challengeRecord(c.id).completed) || CHALLENGES[0];
  openChallenge(next.id);
}

function openChallenge(id) {
  const ch = challengeById(id);
  state.mode = "challenge";
  state.screen = "play";
  state.challenge = ch;
  state.rule = Rule.CONWAY;
  state.grid = createChallengeGrid(ch);
  state.cooldown = 0;
  renderer.target = ch.ghost ? gardenTarget(state.grid.w, state.grid.h) : null;
  selectStamp(null);
  undo.length = 0;
  resetRunStats();
  hideOverlay();
  showPlay();
  renderer.resetCamera(state.grid);
  $("mission-kicker").textContent = `Challenge ${CHALLENGES.indexOf(ch) + 1} / ${CHALLENGES.length}`;
  $("mission-title").textContent = ch.title;
  $("mission-flavor").textContent = ch.flavor;
  $("mission-stars").innerHTML = starMarkup(store.challengeRecord(ch.id).stars);
  for (const btn of $("challenge-list").querySelectorAll("button")) {
    btn.classList.toggle("active", btn.dataset.cid === ch.id);
  }
}

function starMarkup(n) {
  return `<span>${"★".repeat(n)}</span><span class="off">${"★".repeat(Math.max(0, 3 - n))}</span>`;
}

function openDaily(fresh = true) {
  state.mode = "daily";
  state.screen = "play";
  state.challenge = null;
  state.rule = Rule.CONWAY;
  state.dailyIso = todayISO();
  if (fresh) state.grid = makeDailySoup(state.dailyIso);
  renderer.target = null;
  undo.length = 0;
  resetRunStats();
  hideOverlay();
  showPlay();
  renderer.resetCamera(state.grid);
  const best = store.dailyBest(state.dailyIso);
  $("daily-date").textContent = state.dailyIso;
  $("daily-score").textContent = "—";
  $("daily-best").textContent = best ? `Best ${best.score}` : "No score yet";
  $("daily-reason").textContent = "Soup density 0.32 · 40×24";
}

function showPlay() {
  els.title.classList.add("hidden");
  els.play.classList.remove("hidden");
  const sandbox = state.mode === "sandbox";
  const challenge = state.mode === "challenge";
  const daily = state.mode === "daily";
  els.play.dataset.mode = state.mode;
  $("sandbox-tools").classList.toggle("hidden", !sandbox);
  $("stamps-wrap").classList.toggle("hidden", !sandbox);
  $("rail-left").classList.toggle("hidden", !sandbox);
  $("rail-right").classList.toggle("hidden", sandbox);
  $("mission").classList.toggle("hidden", !challenge);
  $("challenge-list").classList.toggle("hidden", !challenge);
  $("daily-panel").classList.toggle("hidden", !daily);
  $("btn-reseed").classList.toggle("hidden", !sandbox);
  $("btn-share").classList.toggle("hidden", !sandbox);
  $("btn-clear").disabled = daily;
  hudDirty = true;
  updateChrome();
  requestAnimationFrame(() => {
    renderer.resize();
    renderer.resetCamera(state.grid);
    renderer.draw(state.grid);
  });
}

function goTitle() {
  state.running = false;
  state.screen = "title";
  state.overlay = null;
  hideOverlay();
  els.play.classList.add("hidden");
  els.title.classList.remove("hidden");
}

function showOverlay(name) {
  state.overlay = name;
  if (name !== "howto") state.running = false;
  els.howto.classList.toggle("hidden", name !== "howto");
  els.pause.classList.toggle("hidden", name !== "pause");
  els.success.classList.toggle("hidden", name !== "success");
  els.fail.classList.toggle("hidden", name !== "fail");
}

function hideOverlay() {
  state.overlay = null;
  els.howto.classList.add("hidden");
  els.pause.classList.add("hidden");
  els.success.classList.add("hidden");
  els.fail.classList.add("hidden");
}

function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => els.toast.classList.add("hidden"), 2200);
}

function updateChrome() {
  $("hud-gen").textContent = String(state.gen);
  $("hud-pop").textContent = String(state.pop);
  $("hud-speed").textContent = `${state.speed} Hz`;
  const budgetEl = $("hud-budget");
  const scoreEl = $("hud-score");
  if (state.mode === "challenge" && state.challenge) {
    budgetEl.classList.remove("hidden");
    if (state.challenge.keepAlive) {
      budgetEl.innerHTML = `add <em>${state.cooldown === 0 ? "now" : `in ${state.cooldown}`}</em>`;
    } else {
      const left = Math.max(0, state.challenge.budget - state.grid.population());
      budgetEl.innerHTML = `budget <em>${left}/${state.challenge.budget}</em>`;
    }
  } else budgetEl.classList.add("hidden");
  if (state.mode === "daily") {
    scoreEl.classList.remove("hidden");
    scoreEl.innerHTML = `score <em>${scoreDaily(state.peak, state.gen)}</em>`;
  } else scoreEl.classList.add("hidden");
  $("btn-play").classList.toggle("hidden", state.running);
  $("btn-pause").classList.toggle("hidden", !state.running);
}

function loop(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min(64, ts - lastTs);
  lastTs = ts;
  if (state.running && state.screen === "play" && !state.overlay) {
    acc += dt;
    const interval = 1000 / Math.max(1, state.speed);
    let steps = 0;
    const cap = state.mode === "daily" ? 16 : 8;
    while (acc >= interval && steps < cap) {
      acc -= interval;
      doStep();
      steps += 1;
      if (!state.running) break;
    }
  } else acc = 0;
  if (state.screen === "play") {
    renderer.draw(state.grid);
    if (hudDirty) {
      updateChrome();
      hudDirty = false;
    }
  }
  requestAnimationFrame(loop);
}

init();
