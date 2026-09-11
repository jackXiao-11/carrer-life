import { getSessionUser, json, methodNotAllowed, sameOrigin } from "./_lib.js";
import { ensureProfile } from "./_profile.js";
import { getLevelInfo } from "./_levels.js";

const MB = 1024 * 1024;
const MAX_FILE_SIZE = 5 * MB;
const MAX_FILE_COUNT = 500;
const QUOTA_PER_LEVEL = 100 * MB;
const ADMIN_EMAIL = "2435726542@qq.com";
const ADMIN_QUOTA = 3 * 1024 * MB;
const NON_ADMIN_GLOBAL_CAP = 2 * 1024 * MB;
const CHUNK_SIZE = 700 * 1024;

function isAdminUser(user) {
  return user?.email === ADMIN_EMAIL;
}

function quotaOf(user, xp) {
  return isAdminUser(user) ? ADMIN_QUOTA : getLevelInfo(xp).level * QUOTA_PER_LEVEL;
}

function sanitizeName(name) {
  const trimmed = String(name || "").trim();
  const safe = trimmed.replace(/[\/\\\r\n\u0000-\u001f]/g, "_").slice(0, 180);
  return safe || "未命名文件";
}

async function usageOf(env, userId) {
  const row = await env.DB.prepare(
    "SELECT COALESCE(SUM(size), 0) AS used, COUNT(*) AS count FROM files WHERE user_id = ?",
  ).bind(userId).first();
  return { used: Number(row?.used) || 0, count: Number(row?.count) || 0 };
}

async function globalUsageOf(env) {
  const row = await env.DB.prepare(
    `SELECT COALESCE(SUM(f.size), 0) AS used FROM files f
     JOIN accounts a ON a.id = f.user_id WHERE a.email != ?`,
  ).bind(ADMIN_EMAIL).first();
  return Number(row?.used) || 0;
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 65536) {
    binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + 65536));
  }
  return btoa(binary);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ error: "不允许从其他网站调用此接口。" }, 403);
  const session = await getSessionUser(request, env);
  if (session.error) return json({ error: session.error }, session.status);
  if (!session.user) return json({ error: "请先登录。" }, 401);
  const profile = await ensureProfile(env, session.user.id);
  const level = getLevelInfo(profile.xp).level;
  const admin = isAdminUser(session.user);
  const rows = await env.DB.prepare(
    "SELECT id, name, size, type, created_at FROM files WHERE user_id = ? ORDER BY created_at DESC LIMIT 500",
  ).bind(session.user.id).all();
  const usage = await usageOf(env, session.user.id);
  return json({
    files: (rows.results || []).map((file) => ({
      id: file.id,
      name: file.name,
      size: file.size,
      type: file.type,
      createdAt: file.created_at,
    })),
    usage: { used: usage.used, count: usage.count, quota: quotaOf(session.user, profile.xp), level, isAdmin: admin },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ error: "不允许从其他网站调用此接口。" }, 403);
  const session = await getSessionUser(request, env);
  if (session.error) return json({ error: session.error }, session.status);
  if (!session.user) return json({ error: "请先登录。" }, 401);

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "上传格式不正确。" }, 400);
  }
  const file = form.get("file");
  if (!file || typeof file === "string") return json({ error: "没有收到文件。" }, 400);
  if (file.size <= 0) return json({ error: "文件为空。" }, 400);
  if (file.size > MAX_FILE_SIZE) return json({ error: "单个文件不能超过 5MB。" }, 413);

  const profile = await ensureProfile(env, session.user.id);
  const level = getLevelInfo(profile.xp).level;
  const admin = isAdminUser(session.user);
  const usage = await usageOf(env, session.user.id);
  if (usage.count >= MAX_FILE_COUNT) return json({ error: "文件数量已达上限（500 个）。" }, 413);
  const quota = quotaOf(session.user, profile.xp);
  if (usage.used + file.size > quota) {
    return json({
      error: admin
        ? `站长存储空间已满（${quota / (1024 * MB)}GB）。`
        : `存储空间不足：当前 Lv.${level} 境界配额 ${quota / MB}MB，完成任务提升境界可扩容。`,
    }, 413);
  }
  if (!admin && (await globalUsageOf(env)) + file.size > NON_ADMIN_GLOBAL_CAP) {
    return json({ error: "普通用户的共享存储空间（2GB）已满，请联系站长。" }, 507);
  }

  const id = crypto.randomUUID();
  const name = sanitizeName(file.name);
  const buffer = new Uint8Array(await file.arrayBuffer());
  const statements = [
    env.DB.prepare(
      "INSERT INTO files (id, user_id, name, size, type, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(id, session.user.id, name, file.size, file.type || "", Date.now()),
  ];
  for (let offset = 0, index = 0; offset < buffer.length; offset += CHUNK_SIZE, index += 1) {
    const encoded = bytesToBase64(buffer.subarray(offset, offset + CHUNK_SIZE));
    statements.push(
      env.DB.prepare("INSERT INTO file_chunks (file_id, chunk_index, data) VALUES (?, ?, ?)")
        .bind(id, index, encoded),
    );
  }
  await env.DB.batch(statements);
  return json({ ok: true, file: { id, name, size: file.size } }, 201);
}

export function onRequest(context) {
  const method = context.request.method;
  if (method === "GET") return onRequestGet(context);
  if (method === "POST") return onRequestPost(context);
  return methodNotAllowed("GET, POST");
}
