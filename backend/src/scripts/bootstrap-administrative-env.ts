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
    const email = getEnv("BOOTSTRAP_ADMINISTRATIVE_EMAIL");
    const password = getEnv("BOOTSTRAP_ADMINISTRATIVE_PASSWORD");
    const name = getEnv("BOOTSTRAP_ADMINISTRATIVE_NAME") ?? "Administrative";
    const forceReset = getBooleanEnv("FORCE_BOOTSTRAP_ADMINISTRATIVE");

    if (!email || !password) {
      console.log("BOOTSTRAP_ADMINISTRATIVE_EMAIL or BOOTSTRAP_ADMINISTRATIVE_PASSWORD not set. Skipping administrative bootstrap.");
      return;
    }

    if (password.length < 8) {
      throw new Error("BOOTSTRAP_ADMINISTRATIVE_PASSWORD must be at least 8 characters.");
    }

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    const passwordHash = await bcrypt.hash(password, 10);

    if (forceReset) {
      if (existingEmail) {
        const updated = await prisma.user.update({
          where: { email },
          data: {
            name,
            role: "PMO",
            passwordHash
          }
        });
        console.log(`Administrative user updated (forced): ${updated.email}`);
        return;
      }

      const created = await prisma.user.create({
        data: {
          email,
          name,
          role: "PMO",
          passwordHash
        }
      });
      console.log(`Administrative user created (forced): ${created.email}`);
      return;
    }

    const existingPmo = await prisma.user.findFirst({ where: { role: "PMO" } });
    if (existingPmo) {
      console.log(`Administrative user already exists (${existingPmo.email}). Bootstrap skipped.`);
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
        role: "PMO",
        passwordHash
      }
    });

    console.log(`Administrative user created: ${created.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});