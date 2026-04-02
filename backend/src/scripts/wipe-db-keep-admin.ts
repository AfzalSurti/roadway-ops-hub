import "dotenv/config";
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();

  try {
    const adminUsers = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true, email: true }
    });

    if (adminUsers.length === 0) {
      console.error("No ADMIN users found. Aborting wipe to avoid locking you out.");
      process.exit(1);
    }

    const adminIds = adminUsers.map((admin) => admin.id);

    await prisma.$transaction(async (tx) => {
      const tables = await tx.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
      `;

      const tablesToWipe = tables
        .map((table) => table.tablename)
        .filter((tableName) => tableName !== "_prisma_migrations" && tableName !== "User");

      if (tablesToWipe.length > 0) {
        const quotedTables = tablesToWipe.map((tableName) => `"${tableName}"`).join(", ");
        await tx.$executeRawUnsafe(`TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE;`);
      }

      await tx.user.deleteMany({
        where: { id: { notIn: adminIds } }
      });
    });

    console.log("Database wipe complete.");
    console.log(`Preserved ${adminUsers.length} admin user(s): ${adminUsers.map((x) => x.email).join(", ")}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
