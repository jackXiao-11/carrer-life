/** 建议：PATCH 仅站长可更新状态与回复。 */
import { ADMIN_EMAIL, getSessionUser, json, methodNotAllowed, readJson, sameOrigin } from "../_lib.js";

const STATUSES = new Set(["pending", "processing", "done", "rejected"]);

export async function onRequestPatch(context) {
  const { request, env, params } = context;
  if (!sameOrigin(request)) return json({ error: "不允许从其他网站调用此接口。" }, 403);
  const session = await getSessionUser(request, env);
  if (session.error) return json({ error: session.error }, session.status);
  if (!session.user) return json({ error: "请先登录。" }, 401);
  if (session.user.email !== ADMIN_EMAIL) return json({ error: "只有站长可以处理建议。" }, 403);
  const parsed = await readJson(request, 4_000);
  if (parsed.error) return json({ error: parsed.error }, 400);
  const status = parsed.value?.status !== undefined ? parsed.value.status : undefined;
  const reply = parsed.value?.reply !== undefined ? String(parsed.value.reply || "").slice(0, 500) : undefined;
  if (status !== undefined && !STATUSES.has(status)) return json({ error: "状态不正确。" }, 400);
  if (status === undefined && reply === undefined) return json({ error: "没有需要更新的内容。" }, 400);
  const row = await env.DB.prepare("SELECT id FROM feedback WHERE id = ? LIMIT 1").bind(params.id).first();
  if (!row) return json({ error: "没有找到这条建议。" }, 404);
  await env.DB.prepare(
    `UPDATE feedback SET
       status = COALESCE(?, status),
       reply = COALESCE(?, reply),
       updated_at = ?
     WHERE id = ?`,
  ).bind(status ?? null, reply ?? null, Date.now(), params.id).run();
  return json({ ok: true, message: "建议已更新。" });
}

export function onRequest(context) {
  if (context.request.method === "PATCH") return onRequestPatch(context);
  return methodNotAllowed("PATCH");
}
