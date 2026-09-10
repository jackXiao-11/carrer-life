import { getSessionUser, json, methodNotAllowed, readJson, sameOrigin } from "./_lib.js";
import { ensureProfile, profilePayload } from "./_profile.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ error: "不允许从其他网站调用此接口。" }, 403);
  const session = await getSessionUser(request, env);
  if (session.error) return json({ error: session.error }, session.status);
  if (!session.user) return json({ error: "请先登录。" }, 401);
  const row = await ensureProfile(env, session.user.id);
  return json({ profile: profilePayload(row) });
}

export async function onRequestPut(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ error: "不允许从其他网站调用此接口。" }, 403);
  const session = await getSessionUser(request, env);
  if (session.error) return json({ error: session.error }, session.status);
  if (!session.user) return json({ error: "请先登录。" }, 401);
  const parsed = await readJson(request, 4_000);
  if (parsed.error) return json({ error: parsed.error }, 400);
  const displayName = String(parsed.value?.displayName || "").trim();
  if (!displayName || displayName.length < 1 || displayName.length > 16) {
    return json({ error: "道号需为 1 到 16 个字符。" }, 400);
  }
  await ensureProfile(env, session.user.id);
  await env.DB.prepare("UPDATE profiles SET display_name = ?, updated_at = ? WHERE user_id = ?")
    .bind(displayName, Date.now(), session.user.id).run();
  const row = await env.DB.prepare("SELECT * FROM profiles WHERE user_id = ? LIMIT 1").bind(session.user.id).first();
  return json({ ok: true, profile: profilePayload(row) });
}

export function onRequest(context) {
  const method = context.request.method;
  if (method === "GET") return onRequestGet(context);
  if (method === "PUT") return onRequestPut(context);
  return methodNotAllowed("GET, PUT");
}
