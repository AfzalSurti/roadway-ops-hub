import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { configureSqlite, prisma } from "./prisma/client.js";

async function bootstrap() {
  await prisma.$connect();
  await configureSqlite();

  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "HighwayOps backend started");
  });
}

bootstrap().catch(async (error) => {
  logger.error({ err: error }, "Failed to start server");
  await prisma.$disconnect();
  process.exit(1);
});