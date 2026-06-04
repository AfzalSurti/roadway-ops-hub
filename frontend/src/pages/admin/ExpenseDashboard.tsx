import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PageWrapper } from "@/components/PageWrapper";
import { ExpenseStatusBadge } from "@/components/expense/ExpenseStatusBadge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { ExpenseEmployeeCategoryCharts } from "@/components/expense/ExpenseEmployeeCategoryCharts";
import { BarChart3, CheckCircle2, Clock3, FileSpreadsheet, Plus, Receipt, Wallet, XCircle } from "lucide-react";

export default function ExpenseDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["expense-dashboard"],
    queryFn: () => api.getExpenseDashboard()
  });

  const kpis = [
    { label: "Expenses This Month", value: stats?.totalExpensesThisMonth ?? 0, icon: Wallet, tone: "text-primary bg-primary/10" },
    { label: "Expenses Today", value: stats?.totalExpensesToday ?? 0, icon: Receipt, tone: "text-sky-600 bg-sky-500/10" },
    { label: "Pending Approvals", value: stats?.pendingApprovals ?? 0, icon: Clock3, tone: "text-amber-700 bg-amber-500/10" },
    { label: "Approved", value: stats?.approvedExpenses ?? 0, icon: CheckCircle2, tone: "text-emerald-600 bg-emerald-500/10" },
    { label: "Rejected", value: stats?.rejectedExpenses ?? 0, icon: XCircle, tone: "text-rose-600 bg-rose-500/10" },
    { label: "Voucher Entries", value: stats?.totalVoucherEntries ?? 0, icon: FileSpreadsheet, tone: "text-indigo-600 bg-indigo-500/10" }
  ];

  return (
    <PageWrapper>
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title">Expense Dashboard</h1>
          <p className="page-subtitle">Track site expenses, approvals, and voucher entries across the organization.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="gap-2">
            <Link to="/admin/expenses/my/new">
              <Plus className="h-4 w-4" />
              Create Expense Bill
            </Link>
          </Button>
          <Button asChild variant="outline"><Link to="/admin/expenses/my">My Expense Sheets</Link></Button>
          <Button asChild variant="outline"><Link to="/admin/expenses/list">All Expenses</Link></Button>
          <Button asChild variant="outline"><Link to="/admin/expenses/vouchers">Voucher Register</Link></Button>
          <Button asChild variant="outline"><Link to="/admin/expenses/reports">Reports</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="kpi-card">
            <div className={`p-2.5 rounded-xl ${kpi.tone} w-fit mb-3`}>
              <kpi.icon className="h-5 w-5" />
            </div>
            <p className="text-3xl font-bold">{isLoading ? "…" : `₹${kpi.value.toLocaleString("en-IN")}`}</p>
            <p className="text-sm text-muted-foreground mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="mb-6">
        <ExpenseEmployeeCategoryCharts />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <div className="glass-panel p-5">
          <h3 className="font-semibold mb-4 inline-flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Expense By Category</h3>
          <div className="space-y-2">
            {(stats?.expenseByCategory ?? []).map((row) => (
              <div key={row.categoryId} className="flex items-center justify-between text-sm gap-3">
                <span className="truncate">{row.categoryName}</span>
                <span className="font-medium tabular-nums">₹{row.total.toLocaleString("en-IN")}</span>
              </div>
            ))}
            {!isLoading && (stats?.expenseByCategory.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No expense data yet.</p>
            ) : null}
          </div>
        </div>
        <div className="glass-panel p-5">
          <h3 className="font-semibold mb-4">Monthly Expense Trend</h3>
          <div className="space-y-2">
            {(stats?.monthlyExpenseTrend ?? []).map((row) => (
              <div key={row.month} className="flex items-center justify-between text-sm">
                <span>{row.month}</span>
                <span className="font-medium tabular-nums">₹{row.total.toLocaleString("en-IN")}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-panel p-6">
        <h3 className="font-semibold mb-4">Recent Expenses</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 text-muted-foreground">
                <th className="py-2 pr-4 text-left">Employee</th>
                <th className="py-2 px-4 text-left">Project / Site</th>
                <th className="py-2 px-4 text-left">Date</th>
                <th className="py-2 px-4 text-right">Amount</th>
                <th className="py-2 px-4 text-left">Status</th>
                <th className="py-2 pl-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.recentSheets ?? []).map((sheet) => {
                const total = sheet.entries?.reduce((sum, e) => sum + e.amount, 0) ?? 0;
                return (
                  <tr key={sheet.id} className="border-b border-border/20">
                    <td className="py-2.5 pr-4">{sheet.employee?.name ?? "-"}</td>
                    <td className="py-2.5 px-4">{sheet.project?.projectNumber ?? sheet.siteName}</td>
                    <td className="py-2.5 px-4">{new Date(sheet.expenseDate).toLocaleDateString("en-IN")}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">₹{total.toLocaleString("en-IN")}</td>
                    <td className="py-2.5 px-4"><ExpenseStatusBadge status={sheet.status} /></td>
                    <td className="py-2.5 pl-4 text-right">
                      <Button asChild size="sm" variant="outline"><Link to={`/admin/expenses/${sheet.id}`}>View</Link></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </PageWrapper>
  );
}
