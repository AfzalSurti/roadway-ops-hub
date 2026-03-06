import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

export const prisma = new PrismaClient({
  log: env.NODE_ENV === "development" ? ["query", "info", "warn", "error"] : ["warn", "error"]
});

let sqliteConfigured = false;

export async function configureDatabase(): Promise<void> {
  const isSqlite = env.DATABASE_URL.startsWith("file:");
  if (!isSqlite) {
    return;
  }

  if (sqliteConfigured) {
    return;
  }

  await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
  await prisma.$queryRawUnsafe(`PRAGMA busy_timeout = ${env.SQLITE_BUSY_TIMEOUT_MS};`);
  await prisma.$queryRawUnsafe("PRAGMA foreign_keys = ON;");

  sqliteConfigured = true;
  logger.info({ busyTimeout: env.SQLITE_BUSY_TIMEOUT_MS }, "SQLite PRAGMA configured");
}