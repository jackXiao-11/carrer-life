/** 好友：POST 处理收到的申请（accept 同意 / reject 拒绝并删除记录）。 */
import { getSessionUser, json, methodNotAllowed, readJson, sameOrigin } from "../_lib.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ error: "不允许从其他网站调用此接口。" }, 403);
  const session = await getSessionUser(request, env);
  if (session.error) return json({ error: session.error }, session.status);
  if (!session.user) return json({ error: "请先登录。" }, 401);
  const parsed = await readJson(request, 4_000);
  if (parsed.error) return json({ error: parsed.error }, 400);
  const friendshipId = String(parsed.value?.id || "");
  const action = parsed.value?.action;
  if (!friendshipId || (action !== "accept" && action !== "reject")) {
    return json({ error: "请求参数不正确。" }, 400);
  }
  const row = await env.DB.prepare(
    "SELECT id FROM friendships WHERE id = ? AND addressee_id = ? AND status = 'pending' LIMIT 1",
  ).bind(friendshipId, session.user.id).first();
  if (!row) return json({ error: "没有找到这条好友申请。" }, 404);
  if (action === "accept") {
    await env.DB.prepare("UPDATE friendships SET status = 'accepted' WHERE id = ?").bind(friendshipId).run();
    return json({ ok: true, message: "已同意好友申请。" });
  }
  await env.DB.prepare("DELETE FROM friendships WHERE id = ?").bind(friendshipId).run();
  return json({ ok: true, message: "已拒绝好友申请。" });
}

export function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return methodNotAllowed("POST");
}
