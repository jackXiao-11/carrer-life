import { getSessionUser, json, methodNotAllowed } from "../_lib.js";

export async function onRequestGet(context) {
  const session = await getSessionUser(context.request, context.env);
  if (session.error) return json({ error: session.error }, session.status);
  return json({ user: session.user });
}

export function onRequest(context) {
  if (context.request.method === "GET") return onRequestGet(context);
  return methodNotAllowed("GET");
}
