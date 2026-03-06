import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { configureDatabase, prisma } from "./prisma/client.js";

async function bootstrap() {
  await prisma.$connect();
  await configureDatabase();

  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "HighwayOps backend started");
  });
}

bootstrap().catch(async (error) => {
  logger.error({ err: error }, "Failed to start server");
  await prisma.$disconnect();
  process.exit(1);
});