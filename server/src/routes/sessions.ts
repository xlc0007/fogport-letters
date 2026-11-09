import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type {
  CreateSessionResponse,
  GetSessionResponse,
  SubmitTurnResponse,
} from "@fogport/shared";
import { config } from "../config.js";
import { GameError } from "../errors.js";
import { createSessionInputSchema, submitTurnInputSchema } from "../game/protocol.js";
import type { SessionService } from "../game/sessionService.js";
import { toSessionSnapshot, toTurnView } from "../game/state.js";
import type { SessionRepository } from "../db/sessionRepository.js";

const sessionIdSchema = z
  .string()
  .min(16)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

export async function registerSessionRoutes(
  app: FastifyInstance,
  service: SessionService,
  repository: SessionRepository,
): Promise<void> {
  app.post("/api/sessions", async (request, reply) => {
    const parsed = createSessionInputSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    const session = service.createSession(parsed.data.playerName);
    const response: CreateSessionResponse = {
      mode: config.activeMode,
      session: toSessionSnapshot(session),
    };
    return reply.code(201).send(response);
  });

  app.get<{ Params: { id: string } }>("/api/sessions/:id", async (request) => {
    const id = parseSessionId(request.params.id);
    const session = service.getSession(id);
    const turns = repository.listTurns(id).map(toTurnView);

    const response: GetSessionResponse = {
      mode: config.activeMode,
      session: toSessionSnapshot(session),
      turns,
    };
    return response;
  });

  app.post<{ Params: { id: string }; Body: unknown }>(
    "/api/sessions/:id/turns",
    async (request) => {
      const id = parseSessionId(request.params.id);
      const parsed = submitTurnInputSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        throw validationError(parsed.error);
      }

      const response: SubmitTurnResponse = await service.submitTurn(
        id,
        parsed.data.action,
        config.activeMode,
      );
      return response;
    },
  );
}

function parseSessionId(raw: string): string {
  const parsed = sessionIdSchema.safeParse(raw);
  if (!parsed.success) {
    throw new GameError("SESSION_NOT_FOUND", "没有找到这局游戏。", 404, false);
  }
  return parsed.data;
}

function validationError(error: z.ZodError): GameError {
  const details = error.issues.slice(0, 3).map((issue) => issue.message);
  const hasNonChineseMessage = details.some((message) => !/[\u4e00-\u9fff]/.test(message));
  const message = hasNonChineseMessage
    ? "请求参数不合法，请检查请求体格式与字段长度。"
    : details.join("；") || "请求参数不合法。";
  return new GameError("VALIDATION_ERROR", message, 400, false);
}
