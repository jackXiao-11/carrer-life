/** 膜拜：POST { targetId }。每人每天对同一目标限一次；返回对方最新被膜拜数。 */
import { getSessionUser, json, methodNotAllowed, readJson, sameOrigin } from "./_lib.js";
import { shanghaiToday } from "./_levels.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ error: "不允许从其他网站调用此接口。" }, 403);
  const session = await getSessionUser(request, env);
  if (session.error) return json({ error: session.error }, session.status);
  if (!session.user) return json({ error: "请先登录后再膜拜大佬。" }, 401);
  const parsed = await readJson(request, 2_000);
  if (parsed.error) return json({ error: parsed.error }, 400);
  const targetId = String(parsed.value?.targetId || "");
  if (!targetId) return json({ error: "参数不正确。" }, 400);
  if (targetId === session.user.id) return json({ error: "不能膜拜自己，修炼要脚踏实地。" }, 400);
  const target = await env.DB.prepare("SELECT id FROM accounts WHERE id = ? LIMIT 1").bind(targetId).first();
  if (!target) return json({ error: "没有找到这位修行者。" }, 404);

  const result = await env.DB.prepare(
    "INSERT OR IGNORE INTO worships (worshipper_id, target_id, date, created_at) VALUES (?, ?, ?, ?)",
  ).bind(session.user.id, targetId, shanghaiToday(), Date.now()).run();
  if (!result.meta?.changes) return json({ error: "今天已经膜拜过这位大佬了，明天再来。" }, 409);
  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM worships WHERE target_id = ?",
  ).bind(targetId).first();
  return json({ ok: true, count: count.count || 1, message: "膜拜成功，沾到了一丝道韵。" });
}

export function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return methodNotAllowed("POST");
}
