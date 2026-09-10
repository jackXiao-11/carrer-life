import { getSessionUser, json, methodNotAllowed, readJson, sameOrigin } from "./_lib.js";

const CATEGORIES = new Set(["work", "software", "english"]);

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ error: "不允许从其他网站调用此接口。" }, 403);
  const session = await getSessionUser(request, env);
  if (session.error) return json({ error: session.error }, session.status);
  if (!session.user) return json({ error: "请先登录。" }, 401);
  const me = session.user.id;
  const rows = await env.DB.prepare(
    `SELECT c.*, owner.display_name AS owner_name, friend.display_name AS friend_name
     FROM collab_tasks c
     LEFT JOIN profiles owner ON owner.user_id = c.owner_id
     LEFT JOIN profiles friend ON friend.user_id = c.friend_id
     WHERE c.owner_id = ? OR c.friend_id = ?
     ORDER BY c.done ASC, c.created_at DESC LIMIT 100`,
  ).bind(me, me).all();
  const tasks = (rows.results || []).map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    estimate: row.estimate,
    note: row.note,
    done: Number(row.done) === 1,
    iAmOwner: row.owner_id === me,
    partnerName: row.owner_id === me ? (row.friend_name || "无名修士") : (row.owner_name || "无名修士"),
    createdAt: row.created_at,
    completedAt: row.completed_at,
  }));
  return json({ tasks });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ error: "不允许从其他网站调用此接口。" }, 403);
  const session = await getSessionUser(request, env);
  if (session.error) return json({ error: session.error }, session.status);
  if (!session.user) return json({ error: "请先登录。" }, 401);
  const parsed = await readJson(request, 8_000);
  if (parsed.error) return json({ error: parsed.error }, 400);
  const title = String(parsed.value?.title || "").trim();
  const friendId = String(parsed.value?.friendId || "");
  const category = CATEGORIES.has(parsed.value?.category) ? parsed.value.category : "work";
  const estimate = String(parsed.value?.estimate || "").trim().slice(0, 40);
  const note = String(parsed.value?.note || "").trim().slice(0, 500);
  if (!title || title.length > 80) return json({ error: "任务标题需为 1 到 80 个字符。" }, 400);
  if (!friendId) return json({ error: "请选择一起协作的好友。" }, 400);
  if (friendId === session.user.id) return json({ error: "不能和自己协作。" }, 400);

  const friendship = await env.DB.prepare(
    `SELECT id FROM friendships WHERE status = 'accepted'
     AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)) LIMIT 1`,
  ).bind(session.user.id, friendId, friendId, session.user.id).first();
  if (!friendship) return json({ error: "只能和已互为好友的修行者协作。" }, 403);

  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO collab_tasks (id, title, category, estimate, note, owner_id, friend_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(id, title, category, estimate, note, session.user.id, friendId, Date.now()).run();
  return json({ ok: true, id }, 201);
}

export function onRequest(context) {
  const method = context.request.method;
  if (method === "GET") return onRequestGet(context);
  if (method === "POST") return onRequestPost(context);
  return methodNotAllowed("GET, POST");
}
