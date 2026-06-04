import MyExpensesList from "@/pages/shared/MyExpensesList";

export default function AdminMyExpenses() {
  return (
    <MyExpensesList
      basePath="/admin/expenses/my"
      title="My Expense Bills"
      subtitle="Create your own expense sheets, vouchers, and reports — same as the employee expense workspace."
      backTo="/admin/expenses"
      backLabel="Back to Expense Dashboard"
    />
  );
}
