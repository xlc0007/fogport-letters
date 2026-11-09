import { createDatabaseClient, createSiteContext } from "./_qoder/backend.mjs";
import { createApp } from "./app.mjs";

const app = createApp({
  db: createDatabaseClient(),
  env: (name: string) => Deno.env.get(name),
});

Deno.serve(async (request) => {
  try {
    const context = createSiteContext(request);
    return await app(context);
  } catch {
    return Response.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "服务器暂时无法处理这次请求，请稍后重试。",
          retryable: true,
        },
      },
      {
        status: 500,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      },
    );
  }
});
