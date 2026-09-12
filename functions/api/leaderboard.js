/** 广场排行榜：经验前十（含头像/站长标记/连签/被膜拜数）+ 全站统计 + 我的排名。 */
import { ADMIN_EMAIL, getSessionUser, json, methodNotAllowed, sameOrigin } from "./_lib.js";
import { getLevelInfo, shanghaiToday } from "./_levels.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ error: "不允许从其他网站调用此接口。" }, 403);
  const today = shanghaiToday();
  const rows = await env.DB.prepare(
    `SELECT p.user_id, p.display_name, p.xp, p.avatar, p.checkin_streak, p.last_checkin_date, p.updated_at, a.email, a.created_at,
            (SELECT COUNT(*) FROM worships w WHERE w.target_id = p.user_id) AS worship_count
     FROM profiles p
     JOIN accounts a ON a.id = p.user_id
     WHERE p.xp > 0 ORDER BY p.xp DESC, p.updated_at ASC LIMIT 10`,
  ).all();
  const entries = (rows.results || []).map((row, index) => ({
    rank: index + 1,
    userId: row.user_id,
    displayName: row.display_name,
    isAdmin: row.email === ADMIN_EMAIL,
    avatar: row.avatar || null,
    xp: row.xp,
    level: getLevelInfo(row.xp).level,
    levelName: getLevelInfo(row.xp).name,
    streak: row.checkin_streak || 0,
    checkedInToday: row.last_checkin_date === today,
    createdAt: row.created_at,
    worships: row.worship_count || 0,
  }));
  const statsRow = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM accounts) AS cultivators,
       (SELECT COUNT(*) FROM profiles WHERE last_checkin_date = ?) AS today_checkins,
       (SELECT COALESCE(SUM(xp), 0) FROM profiles) AS total_xp,
       (SELECT COUNT(*) FROM files) AS file_count`,
  ).bind(today).first();
  const stats = {
    cultivators: statsRow.cultivators || 0,
    todayCheckins: statsRow.today_checkins || 0,
    totalXp: statsRow.total_xp || 0,
    fileCount: statsRow.file_count || 0,
  };
  let myRank = null;
  const session = await getSessionUser(request, env);
  if (!session.error && session.user) {
    const mine = await env.DB.prepare(
      "SELECT (SELECT COUNT(*) FROM profiles p2 WHERE p2.xp > p.xp) + 1 AS rank, p.xp FROM profiles p WHERE p.user_id = ?",
    ).bind(session.user.id).first();
    if (mine) myRank = { rank: mine.rank, xp: mine.xp, ...getLevelInfo(mine.xp) };
  }
  return json({ entries, stats, myRank });
}

export function onRequest(context) {
  if (context.request.method === "GET") return onRequestGet(context);
  return methodNotAllowed("GET");
}
