import { getSessionUser, json, methodNotAllowed, readJson, sameOrigin } from "../_lib.js";
import { awardTaskXp } from "../_profile.js";

export async function onRequestPatch(context) {
  const { request, env, params } = context;
  if (!sameOrigin(request)) return json({ error: "不允许从其他网站调用此接口。" }, 403);
  const session = await getSessionUser(request, env);
  if (session.error) return json({ error: session.error }, session.status);
  if (!session.user) return json({ error: "请先登录。" }, 401);
  const parsed = await readJson(request, 2_000);
  if (parsed.error) return json({ error: parsed.error }, 400);
  const done = parsed.value?.done === true;
  const task = await env.DB.prepare(
    "SELECT * FROM collab_tasks WHERE id = ? AND (owner_id = ? OR friend_id = ?) LIMIT 1",
  ).bind(params.id, session.user.id, session.user.id).first();
  if (!task) return json({ error: "没有找到这个协作任务。" }, 404);

  const wasDone = Number(task.done) === 1;
  if (done === wasDone) return json({ ok: true, message: "状态未变化。" });

  if (done) {
    await env.DB.prepare(
      "UPDATE collab_tasks SET done = 1, done_by = ?, completed_at = ? WHERE id = ?",
    ).bind(session.user.id, Date.now(), task.id).run();
    const forOwner = await awardTaskXp(env, task.owner_id, "collab");
    const forFriend = await awardTaskXp(env, task.friend_id, "collab");
    return json({
      ok: true,
      xp: {
        owner: { awarded: forOwner.awarded, gain: forOwner.gain || 0, leveledUp: forOwner.leveledUp || false },
        friend: { awarded: forFriend.awarded, gain: forFriend.gain || 0, leveledUp: forFriend.leveledUp || false },
      },
    });
  }

  await env.DB.prepare("UPDATE collab_tasks SET done = 0, done_by = NULL, completed_at = NULL WHERE id = ?")
    .bind(task.id).run();
  return json({ ok: true, message: "任务已恢复进行中。" });
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  if (!sameOrigin(request)) return json({ error: "不允许从其他网站调用此接口。" }, 403);
  const session = await getSessionUser(request, env);
  if (session.error) return json({ error: session.error }, session.status);
  if (!session.user) return json({ error: "请先登录。" }, 401);
  const task = await env.DB.prepare(
    "SELECT id FROM collab_tasks WHERE id = ? AND owner_id = ? LIMIT 1",
  ).bind(params.id, session.user.id).first();
  if (!task) return json({ error: "只有任务发起人可以删除协作任务。" }, 403);
  await env.DB.prepare("DELETE FROM collab_tasks WHERE id = ?").bind(params.id).run();
  return json({ ok: true, message: "协作任务已删除。" });
}

export function onRequest(context) {
  const method = context.request.method;
  if (method === "PATCH") return onRequestPatch(context);
  if (method === "DELETE") return onRequestDelete(context);
  return methodNotAllowed("PATCH, DELETE");
}
