/**
 * Seeds a demo expense sheet (summary + detailed + voucher PDFs) for an employee.
 * Usage: npm run seed:demo-expense -- --email=ypatil1999@gmail.com
 */
import { PrismaClient } from "@prisma/client";
import { DEFAULT_EXPENSE_CATEGORIES } from "../data/expense-categories.js";

const DEMO_SITE_NAME = "[PDF Demo] Utility site visit for Surat-Sachin-Navsari DPR Project";

function getArgValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : undefined;
}

function parseDate(isoDate: string) {
  return new Date(`${isoDate}T12:00:00.000Z`);
}

async function nextVoucherNumber(prisma: PrismaClient) {
  const year = new Date().getFullYear();
  const prefix = `VCH-${year}-`;
  const count = await prisma.voucher.count({
    where: { voucherNumber: { startsWith: prefix } }
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

type SeedEntry = {
  date: string;
  categoryId: string;
  description: string;
  amount: number;
  billAvailable: boolean;
  billNumber?: string;
};

const DEMO_ENTRIES: SeedEntry[] = [
  // 22-12-2025 — summary totals: Printing 430, Food 330, Hotel 600, Travel 268 (detailed lines)
  { date: "2025-12-22", categoryId: "exp_cat_travel", description: "Home to Vadodara Station (Auto Charges)", amount: 50, billAvailable: false },
  { date: "2025-12-22", categoryId: "exp_cat_travel", description: "Vadodara Station to Site (Auto Charges)", amount: 48, billAvailable: false },
  { date: "2025-12-22", categoryId: "exp_cat_travel", description: "Local travel at site", amount: 70, billAvailable: false },
  { date: "2025-12-22", categoryId: "exp_cat_travel", description: "Site to hotel (Auto)", amount: 100, billAvailable: false },
  { date: "2025-12-22", categoryId: "exp_cat_printing", description: "Xerox / printing at site office", amount: 430, billAvailable: true, billNumber: "B-2212-01" },
  { date: "2025-12-22", categoryId: "exp_cat_food", description: "Lunch", amount: 180, billAvailable: false },
  { date: "2025-12-22", categoryId: "exp_cat_food", description: "Dinner", amount: 150, billAvailable: false },
  { date: "2025-12-22", categoryId: "exp_cat_hotel", description: "Hotel rent — night stay", amount: 600, billAvailable: true, billNumber: "H-2212-01" },
  // 23-12-2025 — Food 175, Travel 173; voucher-style lines (no bill)
  { date: "2025-12-23", categoryId: "exp_cat_food", description: "Breakfast", amount: 75, billAvailable: false },
  { date: "2025-12-23", categoryId: "exp_cat_food", description: "Lunch", amount: 100, billAvailable: false },
  { date: "2025-12-23", categoryId: "exp_cat_travel", description: "Surat to Vadodara (Train Charges)", amount: 75, billAvailable: false },
  { date: "2025-12-23", categoryId: "exp_cat_travel", description: "Vadodara Station to Home (Auto Charges)", amount: 30, billAvailable: false },
  { date: "2025-12-23", categoryId: "exp_cat_travel", description: "Local conveyance", amount: 68, billAvailable: false },
  // 31-12-2025 — Food 170, Travel 298
  { date: "2025-12-31", categoryId: "exp_cat_food", description: "Breakfast", amount: 55, billAvailable: false },
  { date: "2025-12-31", categoryId: "exp_cat_food", description: "Lunch", amount: 65, billAvailable: false },
  { date: "2025-12-31", categoryId: "exp_cat_food", description: "Dinner", amount: 50, billAvailable: false },
  { date: "2025-12-31", categoryId: "exp_cat_travel", description: "Site visit local auto", amount: 120, billAvailable: false },
  { date: "2025-12-31", categoryId: "exp_cat_travel", description: "Return travel", amount: 98, billAvailable: false },
  { date: "2025-12-31", categoryId: "exp_cat_travel", description: "Parking / misc travel", amount: 80, billAvailable: false }
];

async function main() {
  const email = (getArgValue("email") ?? "ypatil1999@gmail.com").toLowerCase();
  const prisma = new PrismaClient();

  try {
    const employee = await prisma.user.findUnique({ where: { email } });
    if (!employee) {
      console.error(`No user found for email: ${email}`);
      process.exit(1);
    }

    const now = new Date();
    await prisma.expenseCategory.createMany({
      data: DEFAULT_EXPENSE_CATEGORIES.map((category) => ({
        id: category.id,
        name: category.name,
        sortOrder: category.sortOrder,
        isActive: true,
        createdAt: now,
        updatedAt: now
      })),
      skipDuplicates: true
    });

    const project =
      (await prisma.project.findFirst({
        where: { projectNumber: { contains: "GSIR2302", mode: "insensitive" } },
        orderBy: { createdAt: "desc" }
      })) ??
      (await prisma.project.findFirst({ orderBy: { createdAt: "desc" } }));

    const existing = await prisma.expenseSheet.findMany({
      where: { employeeId: employee.id, siteName: DEMO_SITE_NAME },
      select: { id: true }
    });
    if (existing.length > 0) {
      await prisma.expenseSheet.deleteMany({
        where: { id: { in: existing.map((s) => s.id) } }
      });
      console.log(`Removed ${existing.length} previous demo sheet(s).`);
    }

    const sheet = await prisma.expenseSheet.create({
      data: {
        employeeId: employee.id,
        projectId: project?.id ?? null,
        employeeDisplayName: employee.name,
        siteName: DEMO_SITE_NAME,
        siteIncharge: "Zulfibhai Petiwala",
        totalPersons: 1,
        expenseDate: parseDate("2025-12-31"),
        mobileNumber: employee.contactNumber?.replace(/\D/g, "").slice(-10) || "9023982952",
        bankAccount: "50100671694993",
        sheetNumber: 1,
        status: "DRAFT"
      }
    });

    let voucherCount = 0;
    for (const item of DEMO_ENTRIES) {
      const entry = await prisma.expenseEntry.create({
        data: {
          expenseSheetId: sheet.id,
          categoryId: item.categoryId,
          entryDate: parseDate(item.date),
          amount: item.amount,
          description: item.description,
          billAvailable: item.billAvailable,
          billNumber: item.billNumber ?? null,
          billAttachmentUrl: item.billAvailable ? "https://example.com/demo-bill.pdf" : null
        }
      });

      if (!item.billAvailable) {
        const voucherNumber = await nextVoucherNumber(prisma);
        await prisma.voucher.create({
          data: {
            voucherNumber,
            entry: { connect: { id: entry.id } }
          }
        });
        voucherCount += 1;
      }
    }

    const total = DEMO_ENTRIES.reduce((sum, e) => sum + e.amount, 0);
    console.log("\nDemo expense sheet created successfully.\n");
    console.log(`  Employee : ${employee.name} <${employee.email}>`);
    console.log(`  Sheet ID : ${sheet.id}`);
    console.log(`  Project  : ${project?.projectNumber ?? "—"} ${project?.name ?? ""}`.trim());
    console.log(`  Entries  : ${DEMO_ENTRIES.length}`);
    console.log(`  Vouchers : ${voucherCount}`);
    console.log(`  Total    : ₹${total.toLocaleString("en-IN")}`);
    console.log("\nLogin as this employee → Expenses → open the sheet tagged [PDF Demo] → download Summary / Detailed / Voucher PDF.\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
