/** 云存储：GET 下载指定文件（分片重组），中文文件名用 filename* 编码。仅所有者可下。 */
import { getSessionUser, json, methodNotAllowed, sameOrigin } from "../../_lib.js";

function base64ToBytes(encoded) {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function onRequestGet(context) {
  const { request, env, params } = context;
  if (!sameOrigin(request)) return json({ error: "不允许从其他网站调用此接口。" }, 403);
  const session = await getSessionUser(request, env);
  if (session.error) return json({ error: session.error }, session.status);
  if (!session.user) return json({ error: "请先登录。" }, 401);
  const file = await env.DB.prepare(
    "SELECT * FROM files WHERE id = ? AND user_id = ? LIMIT 1",
  ).bind(params.id, session.user.id).first();
  if (!file) return json({ error: "没有找到这个文件。" }, 404);
  const chunks = await env.DB.prepare(
    "SELECT data FROM file_chunks WHERE file_id = ? ORDER BY chunk_index",
  ).bind(params.id).all();
  const parts = (chunks.results || []).map((chunk) => base64ToBytes(chunk.data));
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  if (total !== file.size) return json({ error: "文件数据不完整，请删除后重新上传。" }, 500);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return new Response(output, {
    status: 200,
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function onRequest(context) {
  if (context.request.method === "GET") return onRequestGet(context);
  return methodNotAllowed("GET");
}
