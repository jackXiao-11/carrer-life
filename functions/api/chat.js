const DEEPSEEK_MODEL = "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b";
const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_BODY_BYTES = 48_000;
const WINDOW_MS = 60_000;
const REQUESTS_PER_WINDOW = 12;
const requestWindows = new Map();

async function handlePost(context) {
  const { request, env } = context;
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    return json({ error: "不允许从其他网站调用此接口。" }, 403);
  }

  if (!request.headers.get("Content-Type")?.includes("application/json")) {
    return json({ error: "请求格式不正确。" }, 415);
  }

  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_BODY_BYTES) return json({ error: "请求内容过长。" }, 413);

  const clientId = request.headers.get("CF-Connecting-IP") || "unknown";
  if (!allowRequest(clientId)) return json({ error: "请求太频繁，请一分钟后再试。" }, 429);

  let body;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return json({ error: "请求内容过长。" }, 413);
    }
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "无法读取请求内容。" }, 400);
  }

  const validationError = validateBody(body);
  if (validationError) return json({ error: validationError }, 400);

  try {
    const stream = body.model === "deepseek"
      ? await streamDeepSeek(env, body.messages)
      : await streamCodex(env, body.messages);
    return textStream(stream);
  } catch (error) {
    console.error("AI request failed", error?.message || error);
    if (error?.code === "NOT_CONFIGURED") {
      return json({ error: "Codex 尚未启用：站点管理员需要先配置 OpenAI API。" }, 503);
    }
    return json({ error: "AI 服务暂时不可用，可能是免费额度已用完，请稍后再试。" }, 502);
  }
}

export function onRequest(context) {
  if (context.request.method === "POST") return handlePost(context);
  return json({ error: "只支持 POST 请求。" }, 405, { Allow: "POST" });
}

async function streamDeepSeek(env, messages) {
  if (!env.AI) throw new Error("Workers AI binding is missing");
  const upstream = await env.AI.run(DEEPSEEK_MODEL, {
    messages: withSystemPrompt(messages),
    max_tokens: 900,
    stream: true,
  });
  if (!upstream?.getReader) throw new Error("Workers AI did not return a stream");
  return sseToTextStream(upstream, (event) => event.response || "", true);
}

async function streamCodex(env, messages) {
  if (!env.OPENAI_API_KEY || !env.OPENAI_MODEL) {
    const error = new Error("OpenAI configuration is missing");
    error.code = "NOT_CONFIGURED";
    throw error;
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      instructions: systemPrompt(),
      input: messages,
      max_output_tokens: 900,
      stream: true,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI returned ${response.status}`);
  if (!response.body) throw new Error("OpenAI did not return a stream");
  return sseToTextStream(
    response.body,
    (event) => event.type === "response.output_text.delta" ? event.delta || "" : "",
  );
}

function sseToTextStream(upstream, getDelta, hideReasoning = false) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let upstreamReader;

  return new ReadableStream({
    async start(controller) {
      upstreamReader = upstream.getReader();
      let buffer = "";
      let rawText = "";
      let emittedLength = 0;

      try {
        while (true) {
          const { done, value } = await upstreamReader.read();
          buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
          buffer = buffer.replace(/\r\n/g, "\n");

          let boundary;
          while ((boundary = buffer.indexOf("\n\n")) !== -1) {
            const block = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const payload = block.split("\n")
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.slice(5).trimStart())
              .join("\n");
            if (!payload || payload === "[DONE]") continue;

            let event;
            try {
              event = JSON.parse(payload);
            } catch {
              continue;
            }
            if (event.error) throw new Error("Upstream AI stream failed");

            const delta = getDelta(event);
            if (!delta) continue;
            rawText += delta;
            const visibleText = hideReasoning ? visibleAnswer(rawText) : rawText;
            if (visibleText.length > emittedLength) {
              controller.enqueue(encoder.encode(visibleText.slice(emittedLength)));
              emittedLength = visibleText.length;
            }
          }

          if (done) break;
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        upstreamReader.releaseLock();
      }
    },
    cancel(reason) {
      return upstreamReader?.cancel(reason);
    },
  });
}

function visibleAnswer(value) {
  let text = value.replace(/<think>[\s\S]*?<\/think>/gi, "");
  const openTag = text.toLowerCase().lastIndexOf("<think>");
  if (openTag !== -1) text = text.slice(0, openTag);

  const tag = "<think>";
  const lowerText = text.toLowerCase();
  for (let length = Math.min(tag.length - 1, text.length); length > 0; length -= 1) {
    if (tag.startsWith(lowerText.slice(-length))) return text.slice(0, -length);
  }
  return text.trimStart();
}

function validateBody(body) {
  if (!body || !["deepseek", "codex"].includes(body.model)) return "请选择有效的 AI 模型。";
  if (!Array.isArray(body.messages) || !body.messages.length || body.messages.length > MAX_MESSAGES) {
    return `对话必须包含 1 到 ${MAX_MESSAGES} 条消息。`;
  }
  for (const message of body.messages) {
    if (!message || !["user", "assistant"].includes(message.role)) return "对话角色不正确。";
    if (typeof message.content !== "string" || !message.content.trim() || message.content.length > MAX_MESSAGE_LENGTH) {
      return `每条消息必须为 1 到 ${MAX_MESSAGE_LENGTH} 个字符。`;
    }
  }
  return "";
}

function withSystemPrompt(messages) {
  return [{ role: "system", content: systemPrompt() }, ...messages];
}

function systemPrompt() {
  return "你是 Career Life 的学习助手。默认使用简洁、准确、适合零基础学习者的中文回答；涉及命令时解释用途和风险；不知道时明确说明，不编造。用户明确要求添加、完成、删除任务，或记录成果时，除了自然语言说明，还可在回复末尾追加一个严格 JSON 操作标记：<career-action>{\\\"type\\\":\\\"task.create\\\",\\\"args\\\":{\\\"title\\\":\\\"任务名\\\",\\\"category\\\":\\\"work\\\",\\\"date\\\":\\\"YYYY-MM-DD\\\",\\\"minutes\\\":30,\\\"notes\\\":\\\"\\\"}}</career-action>。允许的 type 只有 task.create、task.complete、task.delete、record.create、week.summary；不要猜测任务 ID，不要在缺少标题或成果内容时生成操作标记。";
}

function allowRequest(clientId) {
  const now = Date.now();
  const current = requestWindows.get(clientId);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    requestWindows.set(clientId, { startedAt: now, count: 1 });
    if (requestWindows.size > 1000) pruneWindows(now);
    return true;
  }
  current.count += 1;
  return current.count <= REQUESTS_PER_WINDOW;
}

function pruneWindows(now) {
  for (const [key, value] of requestWindows) {
    if (now - value.startedAt >= WINDOW_MS) requestWindows.delete(key);
  }
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

function textStream(stream) {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
