import { createSession, json, methodNotAllowed, readJson, sameOrigin, sessionCookie, verifyPassword } from "../_lib.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ error: "不允许从其他网站调用此接口。" }, 403);
  if (!env.DB) return json({ error: "账户服务尚未配置，请稍后再试。" }, 503);
  const parsed = await readJson(request, 12_000);
  if (parsed.error) return json({ error: parsed.error }, 400);
  const email = String(parsed.value?.email || "").trim().toLowerCase();
  const password = String(parsed.value?.password || "");
  if (!email || !password || email.length > 160 || password.length > 128) {
    return json({ error: "邮箱或密码不正确。" }, 400);
  }
  const account = await env.DB.prepare(
    "SELECT id, email, password_hash, password_salt FROM accounts WHERE email = ? LIMIT 1",
  ).bind(email).first();
  if (!account || !(await verifyPassword(password, account.password_salt, account.password_hash))) {
    return json({ error: "邮箱或密码不正确。" }, 401);
  }
  const token = await createSession(env, account.id);
  return json({ user: { id: account.id, email: account.email } }, 200, { "Set-Cookie": sessionCookie(request, token) });
}

export function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return methodNotAllowed("POST");
}
