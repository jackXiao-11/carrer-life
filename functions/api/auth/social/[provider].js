import { json, methodNotAllowed, sameOrigin } from "../../_lib.js";

// Provider credentials and callback verification must be supplied before enabling
// a real OAuth flow. This endpoint deliberately does not pretend to authenticate.
export function onRequest(context) {
  if (!sameOrigin(context.request)) return json({ error: "不允许从其他网站调用此接口。" }, 403);
  if (!["GET", "POST"].includes(context.request.method)) return methodNotAllowed("GET, POST");
  const provider = context.params?.provider;
  if (!["wechat", "qq"].includes(provider)) return json({ error: "不支持的登录方式。" }, 404);
  return json({
    error: `${provider === "wechat" ? "微信" : "QQ"} 登录尚未配置，请先使用邮箱注册。`,
    code: "OAUTH_NOT_CONFIGURED",
  }, 501);
}
