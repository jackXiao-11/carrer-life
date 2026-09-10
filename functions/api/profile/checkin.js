import { getSessionUser, json, methodNotAllowed, sameOrigin } from "../_lib.js";
import { dailyCheckin } from "../_profile.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ error: "不允许从其他网站调用此接口。" }, 403);
  const session = await getSessionUser(request, env);
  if (session.error) return json({ error: session.error }, session.status);
  if (!session.user) return json({ error: "请先登录。" }, 401);
  const result = await dailyCheckin(env, session.user.id);
  if (result.error) return json({ error: result.error }, result.status);
  return json(result);
}

export function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return methodNotAllowed("POST");
}
