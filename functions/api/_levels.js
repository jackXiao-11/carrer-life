export const LEVELS = [
  { level: 1, name: "凡人", xp: 0 },
  { level: 2, name: "炼气期", xp: 100 },
  { level: 3, name: "筑基期", xp: 250 },
  { level: 4, name: "金丹期", xp: 450 },
  { level: 5, name: "元婴期", xp: 700 },
  { level: 6, name: "化神期", xp: 1000 },
  { level: 7, name: "炼虚期", xp: 1400 },
  { level: 8, name: "合体期", xp: 1900 },
  { level: 9, name: "大乘期", xp: 2500 },
  { level: 10, name: "渡劫·飞升", xp: 3300 },
];

export const CHECKIN_XP = 10;
export const TASK_XP = 10;
export const COLLAB_XP = 15;
export const DAILY_TASK_XP_LIMIT = 5;

export function getLevelInfo(xp) {
  const safeXp = Math.max(0, Number(xp) || 0);
  let current = LEVELS[0];
  for (const entry of LEVELS) {
    if (safeXp >= entry.xp) current = entry;
  }
  const next = LEVELS[current.level] || null;
  const span = next ? next.xp - current.xp : 1;
  const gained = next ? safeXp - current.xp : 1;
  return {
    level: current.level,
    name: current.name,
    xp: safeXp,
    nextLevel: next ? next.level : null,
    nextName: next ? next.name : null,
    nextXp: next ? next.xp : null,
    remainingXp: next ? Math.max(0, next.xp - safeXp) : 0,
    progress: next ? Math.min(1, gained / span) : 1,
  };
}

export function shanghaiToday() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}
