import { allowDbRequest, createSession, json, methodNotAllowed, readJson, sameOrigin, sessionCookie, hashPassword } from "../_lib.js";

export async function onRequestPost(context) {
  try {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ error: "不允许从其他网站调用此接口。" }, 403);
  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
  if (!(await allowDbRequest(env, `register:${clientIp}`, 5, 60_000))) {
    return json({ error: "注册请求过于频繁，请一分钟后再试。" }, 429);
  }
    if (!env.DB) return json({ error: "账户服务尚未配置，请稍后再试。" }, 503);
    const parsed = await readJson(request, 12_000);
    if (parsed.error) return json({ error: parsed.error }, 400);
    const email = String(parsed.value?.email || "").trim().toLowerCase();
    const password = String(parsed.value?.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
      return json({ error: "请输入有效的邮箱地址。" }, 400);
    }
    if (password.length < 8 || password.length > 128) {
      return json({ error: "密码长度需为 8 到 128 个字符。" }, 400);
    }
    const existing = await env.DB.prepare("SELECT id FROM accounts WHERE email = ? LIMIT 1").bind(email).first();
    if (existing) return json({ error: "该邮箱已注册，请直接登录。" }, 409);
    const id = crypto.randomUUID();
    const passwordData = await hashPassword(password);
    const now = Date.now();
    await env.DB.prepare(
      "INSERT INTO accounts (id, email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?)",
    ).bind(id, email, passwordData.hash, passwordData.salt, now).run();
    const token = await createSession(env, id);
    return json({ user: { id, email } }, 201, { "Set-Cookie": sessionCookie(request, token) });
  } catch (error) {
    return json({ error: "注册失败：" + (error?.message || String(error)) }, 500);
  }
}

export function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return methodNotAllowed("POST");
}
