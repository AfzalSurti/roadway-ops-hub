import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();

  try {
    const email = "operations@sankalp.com";
    const password = "Operations@123";
    const name = "Operations Manager";

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`Operations user already exists (${existing.email}). Bootstrap skipped.`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await prisma.user.create({
      data: { email, name, role: "OPERATIONS", passwordHash }
    });

    console.log(`Operations user created: ${created.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
