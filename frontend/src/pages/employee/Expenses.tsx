import MyExpensesList from "@/pages/shared/MyExpensesList";

export default function EmployeeExpenses() {
  return (
    <MyExpensesList
      basePath="/app/expenses"
      title="My Expenses"
      subtitle="Create expense sheets, entries, vouchers, and download summary or detailed reports."
    />
  );
}
