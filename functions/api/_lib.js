const SESSION_COOKIE = "career_life_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const MAX_JSON_BYTES = 1_000_000;

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

export function methodNotAllowed(allow) {
  return json({ error: "请求方法不支持。" }, 405, { Allow: allow });
}

export function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function readJson(request, maxBytes = MAX_JSON_BYTES) {
  if (!request.headers.get("Content-Type")?.includes("application/json")) {
    return { error: "请求格式不正确。" };
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    return { error: "请求内容过长。" };
  }
  try {
    const value = JSON.parse(raw);
    return { value };
  } catch {
    return { error: "无法读取请求内容。" };
  }
}

export function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const item of header.split(";")) {
    const index = item.indexOf("=");
    if (index < 0) continue;
    if (item.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(item.slice(index + 1).trim());
      } catch {
        return "";
      }
    }
  }
  return "";
}

export function sessionCookie(request, token, maxAge = SESSION_TTL_SECONDS) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${secure}`;
}

export function clearSessionCookie(request) {
  return sessionCookie(request, "", 0);
}

export async function hashToken(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64(new Uint8Array(digest));
}

export async function createSession(env, userId) {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = bytesToBase64(tokenBytes).replace(/[^a-zA-Z0-9]/g, "");
  const tokenHash = await hashToken(token);
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_SECONDS * 1000;
  await env.DB.prepare(
    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
  ).bind(tokenHash, userId, now, expiresAt).run();
  return token;
}

export async function getSessionUser(request, env) {
  if (!env.DB) return { error: "账户服务尚未配置。", status: 503 };
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return { user: null };
  const tokenHash = await hashToken(token);
  const row = await env.DB.prepare(
    "SELECT a.id, a.email FROM sessions s JOIN accounts a ON a.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? LIMIT 1",
  ).bind(tokenHash, Date.now()).first();
  if (!row) return { user: null };
  return { user: { id: row.id, email: row.email }, tokenHash };
}

export function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export async function hashPassword(password, saltBytes = crypto.getRandomValues(new Uint8Array(16))) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    // Cloudflare Workers caps PBKDF2 at 100,000 iterations.
    { name: "PBKDF2", salt: saltBytes, iterations: 100000, hash: "SHA-256" },
    key,
    256,
  );
  return { salt: bytesToBase64(saltBytes), hash: bytesToBase64(new Uint8Array(bits)) };
}

export async function verifyPassword(password, salt, expectedHash) {
  const result = await hashPassword(password, base64ToBytes(salt));
  const actual = base64ToBytes(result.hash);
  const expected = base64ToBytes(expectedHash);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ expected[index];
  return difference === 0;
}

export { SESSION_COOKIE, SESSION_TTL_SECONDS, MAX_JSON_BYTES };
