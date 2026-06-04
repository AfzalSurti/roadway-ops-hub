import { PrismaClient } from "@prisma/client";
import { seedDemoExpense } from "./seed-demo-expense-core.js";

const DEFAULT_DEMO_EMAIL = "ypatil1999@gmail.com";

function getEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function isDisabled(): boolean {
  const value = process.env.DEMO_EXPENSE_SEED?.trim().toLowerCase();
  return value === "0" || value === "false" || value === "no" || value === "off";
}

async function main() {
  if (isDisabled()) {
    console.log("DEMO_EXPENSE_SEED is disabled. Skipping demo expense seed.");
    return;
  }

  const email = getEnv("DEMO_EXPENSE_SEED_EMAIL") ?? DEFAULT_DEMO_EMAIL;
  const prisma = new PrismaClient();

  try {
    const result = await seedDemoExpense(prisma, email);
    if (!result.ok) {
      console.log(`Demo expense seed skipped: ${result.reason}`);
      return;
    }

    console.log("Demo expense sheet ready for PDF testing.");
    console.log(`  Employee : ${result.employeeEmail}`);
    console.log(`  Sheet ID : ${result.sheetId}`);
    console.log(`  Entries  : ${result.entryCount}`);
    console.log(`  Vouchers : ${result.voucherCount}`);
    console.log(`  Total    : Rs. ${result.total.toLocaleString("en-IN")}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Demo expense seed failed (non-fatal):", error);
});
