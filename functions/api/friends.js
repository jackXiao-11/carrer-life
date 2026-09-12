/** 好友：GET 返回 friends/incoming/outgoing 三组；POST 按邮箱发申请（互发自动成为好友）。 */
import { getSessionUser, json, methodNotAllowed, readJson, sameOrigin } from "./_lib.js";
import { getLevelInfo } from "./_levels.js";
import { ensureProfile } from "./_profile.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ error: "不允许从其他网站调用此接口。" }, 403);
  const session = await getSessionUser(request, env);
  if (session.error) return json({ error: session.error }, session.status);
  if (!session.user) return json({ error: "请先登录。" }, 401);
  const me = session.user.id;

  const friendRows = await env.DB.prepare(
    `SELECT f.id, f.status,
            CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END AS other_id,
            p.display_name, p.xp, (f.requester_id = ?) AS outgoing
     FROM friendships f
     LEFT JOIN profiles p ON p.user_id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
     WHERE (f.requester_id = ? OR f.addressee_id = ?)
     ORDER BY f.created_at DESC`,
  ).bind(me, me, me, me, me).all();

  const friends = [];
  const incoming = [];
  const outgoing = [];
  for (const row of friendRows.results || []) {
    const item = {
      friendshipId: row.id,
      userId: row.other_id,
      displayName: row.display_name || "无名修士",
      level: getLevelInfo(row.xp || 0).level,
      levelName: getLevelInfo(row.xp || 0).name,
    };
    if (row.status === "accepted") friends.push(item);
    else if (Number(row.outgoing) === 1) outgoing.push(item);
    else incoming.push(item);
  }
  return json({ friends, incoming, outgoing });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ error: "不允许从其他网站调用此接口。" }, 403);
  const session = await getSessionUser(request, env);
  if (session.error) return json({ error: session.error }, session.status);
  if (!session.user) return json({ error: "请先登录。" }, 401);
  const parsed = await readJson(request, 4_000);
  if (parsed.error) return json({ error: parsed.error }, 400);
  const email = String(parsed.value?.email || "").trim().toLowerCase();
  if (!email) return json({ error: "请输入对方注册邮箱。" }, 400);

  const target = await env.DB.prepare("SELECT id FROM accounts WHERE email = ? LIMIT 1").bind(email).first();
  if (!target) return json({ error: "没有找到这个邮箱对应的修行者。" }, 404);
  if (target.id === session.user.id) return json({ error: "不能添加自己为好友。" }, 400);

  const existing = await env.DB.prepare(
    `SELECT id, status, requester_id FROM friendships
     WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?) LIMIT 1`,
  ).bind(session.user.id, target.id, target.id, session.user.id).first();
  if (existing) {
    if (existing.status === "accepted") return json({ error: "你们已经是好友了。" }, 409);
    if (existing.requester_id === session.user.id) return json({ error: "申请已发送，等待对方处理。" }, 409);
    await env.DB.prepare("UPDATE friendships SET status = 'accepted' WHERE id = ?").bind(existing.id).run();
    return json({ ok: true, autoAccepted: true, message: "对方也向你发过申请，已成为好友。" });
  }

  await ensureProfile(env, session.user.id);
  await ensureProfile(env, target.id);
  await env.DB.prepare(
    "INSERT INTO friendships (id, requester_id, addressee_id, status, created_at) VALUES (?, ?, ?, 'pending', ?)",
  ).bind(crypto.randomUUID(), session.user.id, target.id, Date.now()).run();
  return json({ ok: true, message: "好友申请已发送。" }, 201);
}

export function onRequest(context) {
  const method = context.request.method;
  if (method === "GET") return onRequestGet(context);
  if (method === "POST") return onRequestPost(context);
  return methodNotAllowed("GET, POST");
}
