import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

function getEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function getBooleanEnv(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

async function main() {
  const prisma = new PrismaClient();

  try {
    const email = getEnv("BOOTSTRAP_ADMIN_EMAIL");
    const password = getEnv("BOOTSTRAP_ADMIN_PASSWORD");
    const name = getEnv("BOOTSTRAP_ADMIN_NAME") ?? "Admin";
    const forceReset = getBooleanEnv("FORCE_BOOTSTRAP_ADMIN");

    if (!email || !password) {
      console.log("BOOTSTRAP_ADMIN_EMAIL or BOOTSTRAP_ADMIN_PASSWORD not set. Skipping admin bootstrap.");
      return;
    }

    if (password.length < 8) {
      throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters.");
    }

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    const passwordHash = await bcrypt.hash(password, 10);

    if (forceReset) {
      if (existingEmail) {
        const updated = await prisma.user.update({
          where: { email },
          data: {
            name,
            role: "ADMIN",
            passwordHash
          }
        });
        console.log(`Admin updated (forced): ${updated.email}`);
        return;
      }

      const created = await prisma.user.create({
        data: {
          email,
          name,
          role: "ADMIN",
          passwordHash
        }
      });
      console.log(`Admin created (forced): ${created.email}`);
      return;
    }

    const existingAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (existingAdmin) {
      console.log(`Admin already exists (${existingAdmin.email}). Bootstrap skipped.`);
      return;
    }

    if (existingEmail) {
      console.log(`User with email ${email} already exists. Bootstrap skipped.`);
      return;
    }

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
