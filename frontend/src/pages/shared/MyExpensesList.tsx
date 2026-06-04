import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageWrapper } from "@/components/PageWrapper";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, Loader2, Plus, RefreshCcw } from "lucide-react";

type MyExpensesListProps = {
  basePath: "/app/expenses" | "/admin/expenses/my";
  title?: string;
  subtitle?: string;
  backTo?: string;
  backLabel?: string;
};

export default function MyExpensesList({
  basePath,
  title = "My Expense Bills",
  subtitle = "Create expense sheets, entries, vouchers, and download summary or detailed reports.",
  backTo,
  backLabel = "Back"
}: MyExpensesListProps) {
  const { user } = useAuth();
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["expense-sheets", "mine", basePath, user?.id],
    queryFn: () =>
      api.getExpenseSheets({
        employeeId: user?.id,
        limit: 100
      }),
    staleTime: 60_000,
    refetchInterval: false,
    retry: 1,
    enabled: Boolean(user?.id)
  });

  const showLoading = isPending && !data;

  return (
    <PageWrapper>
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {backTo ? (
            <Button asChild variant="outline" className="gap-2">
              <Link to={backTo}>
                <ArrowLeft className="h-4 w-4" />
                {backLabel}
              </Link>
            </Button>
          ) : null}
          <Button asChild className="gap-2">
            <Link to={`${basePath}/new`}>
              <Plus className="h-4 w-4" /> New Expense Sheet
            </Link>
          </Button>
        </div>
      </div>

      <div className="glass-panel p-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 text-muted-foreground">
              <th className="py-3 pr-4 text-left">Site</th>
              <th className="py-3 px-4 text-left">Project</th>
              <th className="py-3 px-4 text-left">Date</th>
              <th className="py-3 px-4 text-right">Amount</th>
              <th className="py-3 pl-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {showLoading ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading expense sheets…
                  </span>
                </td>
              </tr>
            ) : null}
            {isError ? (
              <tr>
                <td colSpan={5} className="py-10 text-center">
                  <p className="text-sm text-rose-500 mb-3">{error instanceof Error ? error.message : "Failed to load expenses"}</p>
                  <Button size="sm" variant="outline" onClick={() => void refetch()}>
                    <RefreshCcw className="h-3.5 w-3.5 mr-1" />
                    Retry
                  </Button>
                </td>
              </tr>
            ) : null}
            {!showLoading && !isError
              ? (data?.items ?? []).map((sheet) => (
                  <tr key={sheet.id} className="border-b border-border/20">
                    <td className="py-3 pr-4">{sheet.siteName}</td>
                    <td className="py-3 px-4">{sheet.projectNumber ?? "-"}</td>
                    <td className="py-3 px-4">{new Date(sheet.expenseDate).toLocaleDateString("en-IN")}</td>
                    <td className="py-3 px-4 text-right tabular-nums">₹{(sheet.totalAmount ?? 0).toLocaleString("en-IN")}</td>
                    <td className="py-3 pl-4 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`${basePath}/${sheet.id}`}>Open</Link>
                      </Button>
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
        {!showLoading && !isError && (data?.items.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No expense sheets yet. Create your first sheet.</p>
        ) : null}
        {isFetching && !showLoading ? <p className="text-xs text-muted-foreground mt-2">Refreshing…</p> : null}
      </div>
    </PageWrapper>
  );
}
