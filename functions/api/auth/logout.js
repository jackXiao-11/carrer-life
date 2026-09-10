import { clearSessionCookie, getCookie, hashToken, json, methodNotAllowed, sameOrigin, SESSION_COOKIE } from "../_lib.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ error: "不允许从其他网站调用此接口。" }, 403);
  const token = getCookie(request, SESSION_COOKIE);
  if (token && env.DB) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await hashToken(token)).run();
  }
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie(request) });
}

export function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return methodNotAllowed("POST");
}
