import { getSessionUser, json, methodNotAllowed, sameOrigin } from "./_lib.js";
import { getLevelInfo } from "./_levels.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ error: "不允许从其他网站调用此接口。" }, 403);
  const rows = await env.DB.prepare(
    `SELECT p.user_id, p.display_name, p.xp FROM profiles p
     JOIN accounts a ON a.id = p.user_id
     WHERE p.xp > 0 ORDER BY p.xp DESC, p.updated_at ASC LIMIT 10`,
  ).all();
  const entries = (rows.results || []).map((row, index) => ({
    rank: index + 1,
    displayName: row.display_name,
    xp: row.xp,
    level: getLevelInfo(row.xp).level,
    levelName: getLevelInfo(row.xp).name,
  }));
  let myRank = null;
  const session = await getSessionUser(request, env);
  if (!session.error && session.user) {
    const mine = await env.DB.prepare(
      "SELECT (SELECT COUNT(*) FROM profiles p2 WHERE p2.xp > p.xp) + 1 AS rank, p.xp FROM profiles p WHERE p.user_id = ?",
    ).bind(session.user.id).first();
    if (mine) myRank = { rank: mine.rank, xp: mine.xp, ...getLevelInfo(mine.xp) };
  }
  return json({ entries, myRank });
}

export function onRequest(context) {
  if (context.request.method === "GET") return onRequestGet(context);
  return methodNotAllowed("GET");
}
