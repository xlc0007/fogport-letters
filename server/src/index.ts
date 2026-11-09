import { buildApp } from "./app.js";
import { config } from "./config.js";

async function main(): Promise<void> {
  const { app } = await buildApp();

  if (config.requestedMode === "qwen" && !config.qwenConfigured) {
    app.log.warn(config.qwenProblem ?? "Qwen 模式配置不完整，行动请求将返回错误。");
  } else if (config.activeMode === "demo") {
    app.log.info("未启用 Qwen，游戏运行在本地演示模式（demo）。");
  } else {
    app.log.info("游戏由 Qwen 生成剧情（qwen 模式）。");
  }

  const shutdown = async (signal: string) => {
    app.log.info(`收到 ${signal}，正在关闭服务。`);
    try {
      await app.close();
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, "关闭服务失败");
      process.exit(1);
    }
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  try {
    await app.listen({ port: config.port, host: "127.0.0.1" });
  } catch (error) {
    app.log.error({ err: error }, "服务启动失败");
    process.exit(1);
  }
}

void main();
