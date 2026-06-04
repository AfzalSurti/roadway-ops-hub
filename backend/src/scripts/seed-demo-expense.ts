/**
 * Manual run: npm run seed:demo-expense -- --email=ypatil1999@gmail.com
 */
import { PrismaClient } from "@prisma/client";
import { seedDemoExpense } from "./seed-demo-expense-core.js";

function getArgValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : undefined;
}

async function main() {
  const email = (getArgValue("email") ?? "ypatil1999@gmail.com").toLowerCase();
  const prisma = new PrismaClient();

  try {
    const result = await seedDemoExpense(prisma, email);
    if (!result.ok) {
      console.error(result.reason);
      process.exit(1);
    }

    console.log("\nDemo expense sheet created successfully.\n");
    console.log(`  Employee : ${result.employeeEmail}`);
    console.log(`  Sheet ID : ${result.sheetId}`);
    console.log(`  Entries  : ${result.entryCount}`);
    console.log(`  Vouchers : ${result.voucherCount}`);
    console.log(`  Total    : Rs. ${result.total.toLocaleString("en-IN")}`);
    console.log("\nOpen Expenses → sheet tagged [PDF Demo] → download all three PDFs.\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
