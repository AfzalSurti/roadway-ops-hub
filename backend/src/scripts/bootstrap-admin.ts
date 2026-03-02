import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

type BootstrapArgs = {
  email?: string;
  password?: string;
  name?: string;
};

function getArgValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : undefined;
}

function parseArgs(): BootstrapArgs {
  return {
    email: getArgValue("email"),
    password: getArgValue("password"),
    name: getArgValue("name")
  };
}

async function main() {
  const prisma = new PrismaClient();

  try {
    const args = parseArgs();
    if (!args.email || !args.password) {
      console.error("Missing required args. Use: npm run bootstrap:admin -- --email=you@example.com --password=StrongPass123 --name='Admin User'");
      process.exit(1);
    }

    if (args.password.length < 8) {
      console.error("Password must be at least 8 characters.");
      process.exit(1);
    }

    const existingAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (existingAdmin) {
      console.log(`Admin already exists (${existingAdmin.email}). Bootstrap skipped.`);
      return;
    }

    const existingEmail = await prisma.user.findUnique({ where: { email: args.email } });
    if (existingEmail) {
      console.log(`User with email ${args.email} already exists. Bootstrap skipped.`);
      return;
    }

    const passwordHash = await bcrypt.hash(args.password, 10);
    const created = await prisma.user.create({
      data: {
        email: args.email,
        name: args.name?.trim() || "Admin",
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