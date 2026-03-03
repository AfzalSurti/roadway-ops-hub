import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

function getEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

async function main() {
  const prisma = new PrismaClient();

  try {
    const email = getEnv("BOOTSTRAP_ADMIN_EMAIL");
    const password = getEnv("BOOTSTRAP_ADMIN_PASSWORD");
    const name = getEnv("BOOTSTRAP_ADMIN_NAME") ?? "Admin";

    if (!email || !password) {
      console.log("BOOTSTRAP_ADMIN_EMAIL or BOOTSTRAP_ADMIN_PASSWORD not set. Skipping admin bootstrap.");
      return;
    }

    if (password.length < 8) {
      throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters.");
    }

    const existingAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (existingAdmin) {
      console.log(`Admin already exists (${existingAdmin.email}). Bootstrap skipped.`);
      return;
    }

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      console.log(`User with email ${email} already exists. Bootstrap skipped.`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await prisma.user.create({
      data: {
        email,
        name,
        role: "ADMIN",
        passwordHash
      }
    });

    console.log(`Admin created: ${created.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
