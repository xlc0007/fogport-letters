import type Database from "better-sqlite3";
import type { FastifyInstance } from "fastify";
import type { HealthResponse } from "@fogport/shared";
import { config } from "../config.js";

export async function registerHealthRoutes(
  app: FastifyInstance,
  db: Database.Database,
): Promise<void> {
  app.get("/api/health", async () => {
    db.prepare("SELECT 1 AS ok").get();

    const response: HealthResponse = {
      status: "ok",
      mode: config.activeMode,
      requestedMode: config.requestedMode,
      qwenConfigured: config.qwenConfigured,
      version: config.version,
      time: new Date().toISOString(),
    };
    return response;
  });
}
