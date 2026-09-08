import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();

  try {
    const email = "account@sankalp.com";
    const password = "Account@123";
    const name = "Accounts Manager";

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`Accounts user already exists (${existing.email}). Bootstrap skipped.`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await prisma.user.create({
      data: { email, name, role: "ACCOUNTS", passwordHash }
    });

    console.log(`Accounts user created: ${created.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
