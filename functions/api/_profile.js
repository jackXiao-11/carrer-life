import { CHECKIN_XP, TASK_XP, COLLAB_XP, DAILY_TASK_XP_LIMIT, getLevelInfo, shanghaiToday } from "./_levels.js";

export async function ensureProfile(env, userId) {
  await env.DB.prepare(
    "INSERT OR IGNORE INTO profiles (user_id, display_name, xp, updated_at) VALUES (?, '无名修士', 0, ?)",
  ).bind(userId, Date.now()).run();
  const row = await env.DB.prepare("SELECT * FROM profiles WHERE user_id = ? LIMIT 1").bind(userId).first();
  return row;
}

export function profilePayload(row, today = shanghaiToday()) {
  const level = getLevelInfo(row.xp);
  return {
    displayName: row.display_name,
    xp: row.xp,
    level,
    checkin: {
      streak: row.checkin_streak,
      checkedInToday: row.last_checkin_date === today,
      lastDate: row.last_checkin_date,
    },
    taskXp: {
      usedToday: row.xp_award_date === today ? row.xp_award_count : 0,
      limit: DAILY_TASK_XP_LIMIT,
    },
  };
}

export async function awardTaskXp(env, userId, type) {
  const today = shanghaiToday();
  const row = await ensureProfile(env, userId);
  const usedToday = row.xp_award_date === today ? row.xp_award_count : 0;
  if (usedToday >= DAILY_TASK_XP_LIMIT) {
    return { awarded: false, reason: "daily-limit", profile: profilePayload(row, today) };
  }
  const gain = type === "collab" ? COLLAB_XP : TASK_XP;
  const newXp = row.xp + gain;
  const oldLevel = getLevelInfo(row.xp).level;
  await env.DB.prepare(
    "UPDATE profiles SET xp = ?, xp_award_date = ?, xp_award_count = ?, updated_at = ? WHERE user_id = ?",
  ).bind(newXp, today, usedToday + 1, Date.now(), userId).run();
  const updated = { ...row, xp: newXp, xp_award_date: today, xp_award_count: usedToday + 1 };
  return {
    awarded: true,
    gain,
    leveledUp: getLevelInfo(newXp).level > oldLevel,
    profile: profilePayload(updated, today),
  };
}

export async function dailyCheckin(env, userId) {
  const today = shanghaiToday();
  const yesterday = new Date(Date.now() + 8 * 3600 * 1000 - 86400 * 1000).toISOString().slice(0, 10);
  const row = await ensureProfile(env, userId);
  if (row.last_checkin_date === today) return { error: "今天已经签到过了，明天再来。", status: 409 };
  const streak = row.last_checkin_date === yesterday ? row.checkin_streak + 1 : 1;
  const oldLevel = getLevelInfo(row.xp).level;
  const newXp = row.xp + CHECKIN_XP;
  await env.DB.prepare(
    "UPDATE profiles SET xp = ?, checkin_streak = ?, last_checkin_date = ?, updated_at = ? WHERE user_id = ?",
  ).bind(newXp, streak, today, Date.now(), userId).run();
  const updated = { ...row, xp: newXp, checkin_streak: streak, last_checkin_date: today };
  return {
    ok: true,
    gain: CHECKIN_XP,
    streak,
    leveledUp: getLevelInfo(newXp).level > oldLevel,
    profile: profilePayload(updated, today),
  };
}
