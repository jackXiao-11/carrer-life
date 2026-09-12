import { getSessionUser, json, methodNotAllowed, readJson, sameOrigin } from "./_lib.js";
import { ensureProfile, profilePayload } from "./_profile.js";

/** 校验头像 data URL：格式合法 + base64 可解码 + 是真实的 JPEG/PNG/WebP 图片（魔数校验）。 */
function isValidImageDataUrl(value) {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return false;
  let bytes;
  try {
    const binary = atob(match[2]);
    bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return false;
  }
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isWebp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  return isJpeg || isPng || isWebp;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ error: "不允许从其他网站调用此接口。" }, 403);
  const session = await getSessionUser(request, env);
  if (session.error) return json({ error: session.error }, session.status);
  if (!session.user) return json({ error: "请先登录。" }, 401);
  const row = await ensureProfile(env, session.user.id);
  return json({ profile: profilePayload(row) });
}

export async function onRequestPut(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ error: "不允许从其他网站调用此接口。" }, 403);
  const session = await getSessionUser(request, env);
  if (session.error) return json({ error: session.error }, session.status);
  if (!session.user) return json({ error: "请先登录。" }, 401);
  const parsed = await readJson(request, 200_000);
  if (parsed.error) return json({ error: parsed.error }, 400);
  const displayName = parsed.value?.displayName !== undefined ? String(parsed.value.displayName || "").trim() : undefined;
  if (displayName !== undefined && (!displayName || displayName.length > 16)) {
    return json({ error: "道号需为 1 到 16 个字符。" }, 400);
  }
  const avatar = parsed.value?.avatar !== undefined ? String(parsed.value.avatar || "") : undefined;
  if (avatar !== undefined && avatar !== "" && !(isValidImageDataUrl(avatar) && avatar.length <= 160_000)) {
    return json({ error: "头像格式不正确或过大，请重新选择图片。" }, 400);
  }
  if (displayName === undefined && avatar === undefined) return json({ error: "没有需要保存的内容。" }, 400);
  await ensureProfile(env, session.user.id);
  if (displayName !== undefined && avatar !== undefined) {
    await env.DB.prepare("UPDATE profiles SET display_name = ?, avatar = ?, updated_at = ? WHERE user_id = ?")
      .bind(displayName, avatar, Date.now(), session.user.id).run();
  } else if (displayName !== undefined) {
    await env.DB.prepare("UPDATE profiles SET display_name = ?, updated_at = ? WHERE user_id = ?")
      .bind(displayName, Date.now(), session.user.id).run();
  } else {
    await env.DB.prepare("UPDATE profiles SET avatar = ?, updated_at = ? WHERE user_id = ?")
      .bind(avatar, Date.now(), session.user.id).run();
  }
  const row = await env.DB.prepare("SELECT * FROM profiles WHERE user_id = ? LIMIT 1").bind(session.user.id).first();
  return json({ ok: true, profile: profilePayload(row) });
}

export function onRequest(context) {
  const method = context.request.method;
  if (method === "GET") return onRequestGet(context);
  if (method === "PUT") return onRequestPut(context);
  return methodNotAllowed("GET, PUT");
}
