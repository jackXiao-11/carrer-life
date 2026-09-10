import { getSessionUser, json, methodNotAllowed, readJson, sameOrigin } from "../_lib.js";
import { awardTaskXp } from "../_profile.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ error: "不允许从其他网站调用此接口。" }, 403);
  const session = await getSessionUser(request, env);
  if (session.error) return json({ error: session.error }, session.status);
  if (!session.user) return json({ error: "请先登录。" }, 401);
  const parsed = await readJson(request, 2_000);
  if (parsed.error) return json({ error: parsed.error }, 400);
  const type = parsed.value?.type === "collab" ? "collab" : "task";
  const result = await awardTaskXp(env, session.user.id, type);
  return json(result);
}

export function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return methodNotAllowed("POST");
}
