import { getSessionUser, json, methodNotAllowed, readJson, sameOrigin, MAX_JSON_BYTES } from "./_lib.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ error: "不允许从其他网站调用此接口。" }, 403);
  const session = await getSessionUser(request, env);
  if (session.error) return json({ error: session.error }, session.status);
  if (!session.user) return json({ error: "请先登录后同步数据。" }, 401);
  const row = await env.DB.prepare("SELECT state_json, updated_at FROM user_data WHERE user_id = ? LIMIT 1").bind(session.user.id).first();
  if (!row) return json({ data: null, updatedAt: null });
  try {
    return json({ data: JSON.parse(row.state_json), updatedAt: row.updated_at });
  } catch {
    return json({ error: "账户数据无法读取。" }, 500);
  }
}

export async function onRequestPut(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ error: "不允许从其他网站调用此接口。" }, 403);
  const session = await getSessionUser(request, env);
  if (session.error) return json({ error: session.error }, session.status);
  if (!session.user) return json({ error: "请先登录后同步数据。" }, 401);
  const parsed = await readJson(request, MAX_JSON_BYTES);
  if (parsed.error) return json({ error: parsed.error }, 400);
  // Accept both { data: state } and a state object directly so the client can
  // migrate from its existing localStorage shape without a second transform.
  const data = parsed.value?.data && typeof parsed.value.data === "object"
    ? parsed.value.data
    : parsed.value;
  if (!data || typeof data !== "object" || Array.isArray(data)) return json({ error: "数据格式不正确。" }, 400);
  if (!Array.isArray(data.tasks) || !Array.isArray(data.records) || data.tasks.length > 2000 || data.records.length > 2000) {
    return json({ error: "任务或记录数量超出限制。" }, 400);
  }
  const serialized = JSON.stringify(data);
  if (new TextEncoder().encode(serialized).byteLength > MAX_JSON_BYTES) return json({ error: "数据内容过大。" }, 413);
  const updatedAt = Date.now();
  await env.DB.prepare(
    "INSERT INTO user_data (user_id, state_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at",
  ).bind(session.user.id, serialized, updatedAt).run();
  return json({ ok: true, updatedAt });
}

export function onRequest(context) {
  if (context.request.method === "GET") return onRequestGet(context);
  if (context.request.method === "PUT") return onRequestPut(context);
  return methodNotAllowed("GET, PUT");
}
