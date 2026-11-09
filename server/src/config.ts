import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import type { ActiveMode, RequestedMode } from "@fogport/shared";
import { GameError } from "./errors.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
export const serverRoot = path.resolve(currentDir, "..");
export const repoRoot = path.resolve(serverRoot, "..");

for (const envPath of [path.join(repoRoot, ".env"), path.join(serverRoot, ".env")]) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, quiet: true });
  }
}

function parseMode(raw: string | undefined): RequestedMode {
  const value = (raw ?? "auto").trim().toLowerCase();
  if (value === "auto" || value === "qwen" || value === "demo") {
    return value;
  }
  throw new Error(`GAME_MODE 必须是 auto、qwen 或 demo，当前值为“${raw ?? ""}”。`);
}

function parsePort(raw: string | undefined): number {
  if (!raw) return 3000;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT 必须是 1–65535 之间的整数。");
  }
  return port;
}

function parseTimeout(raw: string | undefined): number {
  if (!raw) return 45_000;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 3_000 || value > 180_000) {
    throw new Error("QWEN_TIMEOUT_MS 必须是 3000–180000 之间的整数。");
  }
  return value;
}

function resolveDatabasePath(raw: string | undefined): string {
  const configured = (raw ?? "").trim() || "./data/game.db";
  return path.isAbsolute(configured) ? configured : path.resolve(serverRoot, configured);
}

export interface QwenConfig {
  apiKey: string | null;
  baseUrl: string | null;
  model: string | null;
  timeoutMs: number;
}

const requestedMode = parseMode(process.env.GAME_MODE);
const apiKey = (process.env.QWEN_API_KEY ?? "").trim() || null;
const baseUrl = (process.env.QWEN_BASE_URL ?? "").trim().replace(/\/+$/, "") || null;
const model = (process.env.QWEN_MODEL ?? "").trim() || null;
const timeoutMs = parseTimeout(process.env.QWEN_TIMEOUT_MS);

function qwenConfigurationProblem(): string | null {
  const missing: string[] = [];
  if (!apiKey) missing.push("QWEN_API_KEY");
  if (!baseUrl) missing.push("QWEN_BASE_URL");
  if (!model) missing.push("QWEN_MODEL");
  if (missing.length > 0) {
    return `Qwen 配置不完整，缺少 ${missing.join("、")}。请在项目根目录的 .env 中补齐后重启服务。`;
  }
  try {
    const parsed = new URL(baseUrl!);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return "QWEN_BASE_URL 必须是 http(s) 地址，例如 https://dashscope.aliyuncs.com/compatible-mode/v1。";
    }
  } catch {
    return "QWEN_BASE_URL 不是有效的 URL。它应当是 OpenAI 兼容接口的地址，通常以 /v1 结尾。";
  }
  return null;
}

const qwenProblem = qwenConfigurationProblem();
const qwenConfigured = qwenProblem === null;

const activeMode: ActiveMode =
  requestedMode === "demo" ? "demo" : requestedMode === "qwen" ? "qwen" : qwenConfigured ? "qwen" : "demo";

export const config = {
  port: parsePort(process.env.PORT),
  requestedMode,
  activeMode,
  qwenConfigured,
  qwenProblem,
  qwen: {
    apiKey,
    baseUrl,
    model,
    timeoutMs,
  } satisfies QwenConfig,
  databasePath: resolveDatabasePath(process.env.DATABASE_PATH),
  clientDistPath: path.join(repoRoot, "client", "dist"),
  version: "0.1.0",
  logLevel: (process.env.LOG_LEVEL ?? "info").trim() || "info",
} as const;

export function qwenEndpoint(): string {
  const base = config.qwen.baseUrl!;
  return base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
}

export function assertQwenConfigured(): void {
  if (!config.qwenConfigured) {
    throw new GameError(
      "QWEN_CONFIG_MISSING",
      config.qwenProblem ?? "Qwen 配置不完整。",
      503,
      false,
    );
  }
}
