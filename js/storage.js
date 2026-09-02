/** localStorage scores, settings, achievements. */

const KEY = "life-game-v1";

const DEFAULTS = {
  settings: {
    mute: false,
    reducedMotion: false,
  },
  challenges: {},
  daily: {},
  achievements: [],
};

function ls() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function loadState() {
  const store = ls();
  if (!store) return structuredClone(DEFAULTS);
  try {
    const raw = store.getItem(KEY);
    if (!raw) {
      const fresh = structuredClone(DEFAULTS);
      try {
        if (globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
          fresh.settings.reducedMotion = true;
        }
      } catch {
        /* ignore */
      }
      return fresh;
    }
    const data = JSON.parse(raw);
    return {
      settings: { ...DEFAULTS.settings, ...(data.settings || {}) },
      challenges: data.challenges && typeof data.challenges === "object" ? data.challenges : {},
      daily: data.daily && typeof data.daily === "object" ? data.daily : {},
      achievements: Array.isArray(data.achievements) ? data.achievements : [],
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function saveState(state) {
  const store = ls();
  if (!store) return false;
  try {
    store.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

let cache = null;

export function getState() {
  if (!cache) cache = loadState();
  return cache;
}

export function commit() {
  saveState(getState());
}

export function getSettings() {
  return getState().settings;
}

export function setSettings(partial) {
  Object.assign(getState().settings, partial);
  commit();
  return getState().settings;
}

export function challengeRecord(id) {
  return getState().challenges[id] || { stars: 0, completed: false };
}

export function setChallengeStars(id, stars) {
  const cur = challengeRecord(id);
  const next = Math.max(cur.stars || 0, stars | 0);
  getState().challenges[id] = { stars: next, completed: next > 0 };
  commit();
  return next;
}

export function dailyBest(iso) {
  return getState().daily[iso] || null;
}

export function setDailyBest(iso, entry) {
  const prev = dailyBest(iso);
  if (!prev || entry.score > prev.score) {
    getState().daily[iso] = { ...prev, ...entry, at: Date.now() };
    commit();
  }
  return getState().daily[iso];
}

export function unlockAchievement(id) {
  const list = getState().achievements;
  if (!list.includes(id)) {
    list.push(id);
    commit();
    return true;
  }
  return false;
}

export function clearProgress() {
  const settings = { ...getState().settings };
  cache = { ...structuredClone(DEFAULTS), settings };
  commit();
  return cache;
}
