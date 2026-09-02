/** Medals and campaign unlock rules. */

export const ACHIEVEMENTS = [
  { id: "first-win", name: "First pulse", hint: "Win any challenge." },
  { id: "spark", name: "Spark", hint: "Complete Spark." },
  { id: "still", name: "Fossil", hint: "Complete Still." },
  { id: "glider-school", name: "Pilot", hint: "Graduate Glider School." },
  { id: "campaign", name: "Ten lives", hint: "Complete every challenge." },
  { id: "perfect", name: "Perfect pulse", hint: "Hold every star — 30/30." },
  { id: "daily", name: "Daily bread", hint: "Finish a daily soup." },
  { id: "gunner", name: "Gunner", hint: "Let a Gosper gun run 80 generations." },
  { id: "painter", name: "Painter", hint: "Lay 40 cells in one sandbox sitting." },
];

export function starTotal(records, challenges) {
  let n = 0;
  for (const ch of challenges) n += (records[ch.id]?.stars || 0);
  return n;
}

export function completedCount(records, challenges) {
  let n = 0;
  for (const ch of challenges) if (records[ch.id]?.completed) n += 1;
  return n;
}

/** Challenge index 0 is always open; later ones need the previous completed. */
export function isUnlocked(index, records, challenges) {
  if (index <= 0) return true;
  const prev = challenges[index - 1];
  return Boolean(records[prev.id]?.completed);
}

export function maybeCampaignMedals(store, challenges) {
  const records = {};
  for (const ch of challenges) records[ch.id] = store.challengeRecord(ch.id);
  const unlocked = [];
  if (completedCount(records, challenges) >= challenges.length) {
    if (store.unlockAchievement("campaign")) unlocked.push("campaign");
  }
  if (starTotal(records, challenges) >= challenges.length * 3) {
    if (store.unlockAchievement("perfect")) unlocked.push("perfect");
  }
  return unlocked;
}
