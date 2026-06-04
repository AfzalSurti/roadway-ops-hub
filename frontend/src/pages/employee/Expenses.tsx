import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageWrapper } from "@/components/PageWrapper";
import { ExpenseStatusBadge } from "@/components/expense/ExpenseStatusBadge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { Plus } from "lucide-react";

export default function EmployeeExpenses() {
  const { data, isLoading } = useQuery({
    queryKey: ["expense-sheets", "mine"],
    queryFn: () => api.getExpenseSheets({ limit: 100 })
  });

  return (
    <PageWrapper>
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title">My Expenses</h1>
          <p className="page-subtitle">Create and submit site expense sheets for approval.</p>
        </div>
        <Button asChild className="gap-2">
          <Link to="/app/expenses/new"><Plus className="h-4 w-4" /> New Expense Sheet</Link>
        </Button>
      </div>

      <div className="glass-panel p-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 text-muted-foreground">
              <th className="py-3 pr-4 text-left">Site</th>
              <th className="py-3 px-4 text-left">Project</th>
              <th className="py-3 px-4 text-left">Date</th>
              <th className="py-3 px-4 text-right">Amount</th>
              <th className="py-3 px-4 text-left">Status</th>
              <th className="py-3 pl-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Loading…</td></tr> : null}
            {(data?.items ?? []).map((sheet) => (
              <tr key={sheet.id} className="border-b border-border/20">
                <td className="py-3 pr-4">{sheet.siteName}</td>
                <td className="py-3 px-4">{sheet.projectNumber ?? "-"}</td>
                <td className="py-3 px-4">{new Date(sheet.expenseDate).toLocaleDateString("en-IN")}</td>
                <td className="py-3 px-4 text-right tabular-nums">₹{(sheet.totalAmount ?? 0).toLocaleString("en-IN")}</td>
                <td className="py-3 px-4"><ExpenseStatusBadge status={sheet.status} /></td>
                <td className="py-3 pl-4 text-right">
                  <Button asChild size="sm" variant="outline"><Link to={`/app/expenses/${sheet.id}`}>Open</Link></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && (data?.items.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No expense sheets yet. Create your first sheet.</p>
        ) : null}
      </div>
    </PageWrapper>
  );
}
