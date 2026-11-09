import fs from "node:fs";
import path from "node:path";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import type { ApiErrorResponse } from "@fogport/shared";
import { config } from "./config.js";
import { openDatabase } from "./db/database.js";
import { SessionRepository } from "./db/sessionRepository.js";
import { SessionService } from "./game/sessionService.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerSessionRoutes } from "./routes/sessions.js";
import { GameError } from "./errors.js";

export interface BuiltApp {
  app: FastifyInstance;
  service: SessionService;
}

export async function buildApp(): Promise<BuiltApp> {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "headers.authorization",
          "authorization",
        ],
        censor: "[REDACTED]",
      },
    },
    bodyLimit: 16 * 1024,
  });

  const db = openDatabase(config.databasePath);
  const repository = new SessionRepository(db);
  const service = new SessionService(repository);

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("X-Frame-Options", "DENY");
    return payload;
  });

  app.addHook("onClose", async () => {
    db.close();
  });

  app.setErrorHandler((error: FastifyError | GameError, request, reply) => {
    if (error instanceof GameError) {
      if (error.statusCode >= 500) {
        request.log.error(
          {
            code: error.code,
            errorName: error.name,
            statusCode: error.statusCode,
          },
          error.message,
        );
      }
      const body: ApiErrorResponse = {
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
        },
      };
      return reply.code(error.statusCode).send(body);
    }

    const statusCode =
      typeof error.statusCode === "number" && error.statusCode >= 400 ? error.statusCode : 500;

    if (statusCode < 500) {
      const message =
        statusCode === 413
          ? "请求体过大。"
          : statusCode === 415
            ? "请求 Content-Type 不受支持，请使用 application/json。"
            : "请求格式不正确，请提交合法的 JSON 请求体。";
      const body: ApiErrorResponse = {
        error: {
          code: "VALIDATION_ERROR",
          message,
          retryable: false,
        },
      };
      return reply.code(statusCode).send(body);
    }

    request.log.error({ err: error }, "unhandled request error");
    const body: ApiErrorResponse = {
      error: {
        code: "INTERNAL_ERROR",
        message: "服务端遇到了内部错误。请稍后重试。",
        retryable: true,
      },
    };
    return reply.code(500).send(body);
  });

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      try {
        const parsed = new URL(origin);
        const isLocal =
          parsed.hostname === "localhost" ||
          parsed.hostname === "127.0.0.1" ||
          parsed.hostname === "::1";
        callback(null, isLocal && (parsed.protocol === "http:" || parsed.protocol === "https:"));
      } catch {
        callback(null, false);
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["content-type"],
  });

  await registerHealthRoutes(app, db);
  await registerSessionRoutes(app, service, repository);

  const clientIndex = path.join(config.clientDistPath, "index.html");
  const hasClientBuild = fs.existsSync(clientIndex);
  if (hasClientBuild) {
    await app.register(fastifyStatic, {
      root: config.clientDistPath,
      prefix: "/",
      setHeaders(reply, filePath) {
        if (filePath.endsWith("index.html")) {
          reply.header("Cache-Control", "no-cache");
        } else {
          reply.header("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    });
  }

  app.setNotFoundHandler((request, reply) => {
    const pathname = request.url.split("?")[0];
    if (pathname === "/api" || pathname.startsWith("/api/")) {
      const body: ApiErrorResponse = {
        error: {
          code: "NOT_FOUND",
          message: "接口不存在。",
          retryable: false,
        },
      };
      return reply.code(404).send(body);
    }

    const looksLikeAsset = pathname.startsWith("/assets/") || /\.[a-zA-Z0-9]+$/.test(pathname);
    if (hasClientBuild && !looksLikeAsset && (request.method === "GET" || request.method === "HEAD")) {
      return reply.type("text/html; charset=utf-8").sendFile("index.html");
    }

    return reply
      .code(404)
      .type("text/plain; charset=utf-8")
      .send("页面不存在。开发时请访问 Vite 前端地址，或先运行 npm run build 后再访问服务端。");
  });

  return { app, service };
}
