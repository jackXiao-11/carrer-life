import { getSessionUser, json, methodNotAllowed, sameOrigin } from "../_lib.js";

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  if (!sameOrigin(request)) return json({ error: "不允许从其他网站调用此接口。" }, 403);
  const session = await getSessionUser(request, env);
  if (session.error) return json({ error: session.error }, session.status);
  if (!session.user) return json({ error: "请先登录。" }, 401);
  const file = await env.DB.prepare(
    "SELECT id FROM files WHERE id = ? AND user_id = ? LIMIT 1",
  ).bind(params.id, session.user.id).first();
  if (!file) return json({ error: "没有找到这个文件。" }, 404);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM file_chunks WHERE file_id = ?").bind(params.id),
    env.DB.prepare("DELETE FROM files WHERE id = ?").bind(params.id),
  ]);
  return json({ ok: true, message: "文件已删除。" });
}

export function onRequest(context) {
  if (context.request.method === "DELETE") return onRequestDelete(context);
  return methodNotAllowed("DELETE");
}
