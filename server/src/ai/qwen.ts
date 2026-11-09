import { assertQwenConfigured, config, qwenEndpoint } from "../config.js";
import { GameError } from "../errors.js";
import { buildQwenMessages, type TurnPromptContext } from "./prompt.js";

interface QwenChatResponse {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
}

export interface QwenRequestOptions {
  temperature?: number;
}

export async function generateWithQwen(
  context: TurnPromptContext,
  correction?: string,
  options: QwenRequestOptions = {},
): Promise<unknown> {
  assertQwenConfigured();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.qwen.timeoutMs);

  try {
    const response = await fetch(qwenEndpoint(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        authorization: `Bearer ${config.qwen.apiKey}`,
      },
      body: JSON.stringify({
        model: config.qwen.model,
        messages: buildQwenMessages(context, correction),
        temperature: options.temperature ?? 0.85,
        max_tokens: 2200,
        stream: false,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw upstreamError(response.status);
    }

    let payload: QwenChatResponse;
    try {
      payload = (await response.json()) as QwenChatResponse;
    } catch (error) {
      throw new GameError(
        "QWEN_INVALID_OUTPUT",
        "Qwen 返回了无法解析的响应体。请稍后重试。",
        502,
        true,
        { cause: error },
      );
    }

    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      throw new GameError(
        "QWEN_INVALID_OUTPUT",
        "Qwen 没有返回可用的剧情内容。请检查所选模型是否支持 OpenAI 兼容的对话接口与 JSON 输出。",
        502,
        true,
      );
    }

    return content;
  } catch (error) {
    if (error instanceof GameError) {
      throw error;
    }
    if (controller.signal.aborted) {
      throw new GameError(
        "QWEN_TIMEOUT",
        `Qwen 响应超时（超过 ${Math.round(config.qwen.timeoutMs / 1000)} 秒）。请稍后重试，或检查 QWEN_TIMEOUT_MS 与网络状况。`,
        504,
        true,
        { cause: error },
      );
    }
    throw new GameError(
      "QWEN_UPSTREAM_ERROR",
      "无法连接 Qwen 服务。请检查 QWEN_BASE_URL 是否正确、网络是否可达，然后重试。",
      502,
      true,
      { cause: error },
    );
  } finally {
    clearTimeout(timer);
  }
}

function upstreamError(status: number): GameError {
  if (status === 401 || status === 403) {
    return new GameError(
      "QWEN_UPSTREAM_ERROR",
      "Qwen 鉴权失败。请检查 QWEN_API_KEY 是否有效、是否有该模型权限。",
      502,
      false,
    );
  }
  if (status === 404) {
    return new GameError(
      "QWEN_UPSTREAM_ERROR",
      "Qwen 接口或模型不存在。请检查 QWEN_BASE_URL（通常是 OpenAI 兼容的 /v1 地址）与 QWEN_MODEL。",
      502,
      false,
    );
  }
  if (status === 429) {
    return new GameError(
      "QWEN_UPSTREAM_ERROR",
      "Qwen 请求被限流或额度不足。请稍后重试，并检查账户额度。",
      502,
      true,
    );
  }
  if (status >= 500) {
    return new GameError(
      "QWEN_UPSTREAM_ERROR",
      `Qwen 上游服务暂时不可用（HTTP ${status}）。请稍后重试。`,
      502,
      true,
    );
  }
  return new GameError(
    "QWEN_UPSTREAM_ERROR",
    `Qwen 请求失败（HTTP ${status}）。请检查 QWEN_MODEL 与请求参数。`,
    502,
    false,
  );
}
