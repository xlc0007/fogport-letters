import {
  createHostedGame,
  createQwenGenerator,
  playHostedTurn,
  toCreateSessionResponse,
  toGetSessionResponse,
} from "./game.mjs";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const TABLE = "game_sessions";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function fail(code, message, status, retryable = false) {
  return json({ error: { code, message, retryable } }, status);
}

function databaseFailure() {
  const error = new Error("database_unavailable");
  error.code = "INTERNAL_ERROR";
  error.statusCode = 500;
  error.retryable = true;
  return error;
}

function normalizePayload(raw) {
  if (typeof raw === "string") return JSON.parse(raw);
  return raw;
}

async function readJson(request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    throw Object.assign(new Error("invalid_input"), {
      code: "VALIDATION_ERROR",
      statusCode: 400,
      retryable: false,
    });
  }
  const text = await request.text();
  if (text.length > 16_384) {
    throw Object.assign(new Error("payload_too_large"), {
      code: "VALIDATION_ERROR",
      statusCode: 413,
      retryable: false,
    });
  }
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error("invalid_json"), {
      code: "VALIDATION_ERROR",
      statusCode: 400,
      retryable: false,
    });
  }
}

function qwenSettings(env) {
  const apiKey = (env("QWEN_API_KEY") ?? "").trim();
  const baseUrl =
    (env("QWEN_BASE_URL") ?? "").trim() ||
    "https://dashscope.aliyuncs.com/compatible-mode/v1";
  const model =
    (env("QWEN_MODEL") ?? "").trim() || "qwen3.7-max-2026-06-08";
  const configured = apiKey.length > 0;
  return {
    configured,
    mode: configured ? "qwen" : "demo",
    generator: configured
      ? createQwenGenerator({ apiKey, baseUrl, model })
      : undefined,
  };
}

export function createApp({ db, env = () => undefined }) {
  const qwen = qwenSettings(env);

  async function loadSession(id) {
    const result = await db
      .from(TABLE)
      .select("id,payload,version")
      .eq("id", id)
      .limit(1);
    if (result.error) throw databaseFailure();
    return result.data?.[0] ?? null;
  }

  async function saveSession(row, payload) {
    const now = new Date().toISOString();
    const result = await db
      .from(TABLE)
      .update({
        payload,
        version: row.version + 1,
        updated_at: now,
      })
      .eq("id", row.id)
      .eq("version", row.version)
      .select("id,version");
    if (result.error) throw databaseFailure();
    if (!result.data?.length) {
      return fail(
        "TURN_CONFLICT",
        "这局游戏刚刚被另一次请求更新，请刷新后再继续。",
        409,
        true,
      );
    }
    return null;
  }

  return async (context) => {
    const request = context.request;
    const pathname = new URL(request.url).pathname;
    const match = pathname.match(
      /^\/(?:functions\/v1\/)?(?:app|app-d[0-9a-f]{32})(\/.*)?$/,
    );
    if (!match) return fail("NOT_FOUND", "没有找到这个接口。", 404);
    const path = match[1] || "/";

    try {
      if (path === "/api/health" && request.method === "GET") {
        return json({
          status: "ok",
          mode: qwen.mode,
          requestedMode: "auto",
          qwenConfigured: qwen.configured,
          version: "0.1.0",
          time: new Date().toISOString(),
        });
      }

      if (path === "/api/sessions" && request.method !== "POST") {
        return fail("VALIDATION_ERROR", "这个接口只接受 POST。", 405);
      }
      if (path === "/api/sessions" && request.method === "POST") {
        const body = await readJson(request);
        const id = crypto.randomUUID();
        const payload = createHostedGame(
          typeof body?.playerName === "string" ? body.playerName : undefined,
          id,
        );
        const now = new Date().toISOString();
        const inserted = await db.from(TABLE).insert({
          id,
          payload,
          version: 1,
          created_at: now,
          updated_at: now,
        });
        if (inserted.error) throw databaseFailure();
        return json(toCreateSessionResponse(payload, qwen.mode), 201);
      }

      const sessionMatch = path.match(/^\/api\/sessions\/([^/]+)$/);
      if (sessionMatch && !UUID.test(sessionMatch[1])) {
        return fail("SESSION_NOT_FOUND", "没有找到这局游戏。", 404);
      }
      if (sessionMatch && request.method === "GET") {
        const row = await loadSession(sessionMatch[1]);
        if (!row) return fail("SESSION_NOT_FOUND", "没有找到这局游戏。", 404);
        const payload = normalizePayload(row.payload);
        return json(toGetSessionResponse(payload, qwen.mode));
      }

      const turnMatch = path.match(/^\/api\/sessions\/([^/]+)\/turns$/);
      if (turnMatch && request.method !== "POST") {
        return fail("VALIDATION_ERROR", "这个接口只接受 POST。", 405);
      }
      if (turnMatch) {
        if (!UUID.test(turnMatch[1])) {
          return fail("SESSION_NOT_FOUND", "没有找到这局游戏。", 404);
        }
        const body = await readJson(request);
        if (typeof body?.action !== "string") {
          return fail("VALIDATION_ERROR", "请提供行动内容。", 400);
        }
        const row = await loadSession(turnMatch[1]);
        if (!row) return fail("SESSION_NOT_FOUND", "没有找到这局游戏。", 404);
        const payload = normalizePayload(row.payload);
        const result = await playHostedTurn(
          payload,
          body.action,
          qwen.mode,
          qwen.generator,
        );
        const writeFailure = await saveSession(row, result.payload);
        if (writeFailure) return writeFailure;
        return json(result.response);
      }

      return fail("NOT_FOUND", "没有找到这个接口。", 404);
    } catch (error) {
      if (
        error &&
        typeof error.code === "string" &&
        typeof error.statusCode === "number"
      ) {
        return fail(
          error.code,
          error.message || "服务器暂时无法处理这次请求。",
          error.statusCode,
          Boolean(error.retryable),
        );
      }
      return fail(
        "INTERNAL_ERROR",
        "服务器暂时无法处理这次请求，请稍后重试。",
        500,
        true,
      );
    }
  };
}
