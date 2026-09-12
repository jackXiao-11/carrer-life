/** 建议：GET 列表（站长看全部，普通用户看自己）；POST 提交建议。 */
import { ADMIN_EMAIL, getSessionUser, json, methodNotAllowed, readJson, sameOrigin } from "./_lib.js";

const TYPES = new Set(["feature", "bug", "ux", "other"]);

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ error: "不允许从其他网站调用此接口。" }, 403);
  const session = await getSessionUser(request, env);
  if (session.error) return json({ error: session.error }, session.status);
  if (!session.user) return json({ error: "请先登录。" }, 401);
  const isAdmin = session.user.email === ADMIN_EMAIL;
  const rows = await env.DB.prepare(
    `SELECT f.id, f.type, f.content, f.status, f.reply, f.created_at, f.updated_at, f.user_id, p.display_name
     FROM feedback f
     LEFT JOIN profiles p ON p.user_id = f.user_id
     ${isAdmin ? "" : "WHERE f.user_id = ?"}
     ORDER BY CASE f.status WHEN 'pending' THEN 0 WHEN 'processing' THEN 1 ELSE 2 END, f.created_at DESC
     LIMIT 200`,
  ).bind(...(isAdmin ? [] : [session.user.id])).all();
  return json({
    isAdmin,
    feedback: (rows.results || []).map((row) => ({
      id: row.id,
      type: row.type,
      content: row.content,
      status: row.status,
      reply: row.reply || "",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      mine: row.user_id === session.user.id,
      authorName: row.display_name || "无名修士",
    })),
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ error: "不允许从其他网站调用此接口。" }, 403);
  const session = await getSessionUser(request, env);
  if (session.error) return json({ error: session.error }, session.status);
  if (!session.user) return json({ error: "请先登录后再提交建议。" }, 401);
  const parsed = await readJson(request, 4_000);
  if (parsed.error) return json({ error: parsed.error }, 400);
  const type = TYPES.has(parsed.value?.type) ? parsed.value.type : "feature";
  const content = String(parsed.value?.content || "").trim();
  if (content.length < 5 || content.length > 500) {
    return json({ error: "建议内容需为 5 到 500 个字符。" }, 400);
  }
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM feedback WHERE user_id = ? AND created_at > ?",
  ).bind(session.user.id, Date.now() - 86400 * 1000).first();
  if ((recent?.count || 0) >= 10) return json({ error: "今天提交的建议有点多，明天再来吧。" }, 429);
  const id = crypto.randomUUID();
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO feedback (id, user_id, type, content, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', ?, ?)",
  ).bind(id, session.user.id, type, content, now, now).run();
  return json({ ok: true, id }, 201);
}

export function onRequest(context) {
  const method = context.request.method;
  if (method === "GET") return onRequestGet(context);
  if (method === "POST") return onRequestPost(context);
  return methodNotAllowed("GET, POST");
}
