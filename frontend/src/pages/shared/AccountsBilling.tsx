import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageWrapper } from "@/components/PageWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExpenseStatusBadge } from "@/components/expense/ExpenseStatusBadge";
import { api } from "@/lib/api";
import type { ExpenseSheetItem, ExpenseSheetStatus, FinancialProjectBillStatusRow } from "@/lib/domain";
import {
  formatHodCurrency,
  formatHodFinancialYearLabel,
  getProjectCompanyCode,
  getProjectFinancialYearShort,
  HOD_COMPANY_OPTIONS,
  collectHodFinancialYearOptions,
} from "@/lib/hod-dashboard";
import { Eye, Landmark, Loader2, Receipt, RefreshCcw, Search, X } from "lucide-react";

type Tab = "ra-bills" | "expenses";

function money(value: number) {
  return formatHodCurrency(value);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN");
}

export default function AccountsBilling({
  title = "Accounts",
  subtitle = "RA bills and expenses (read-only).",
}: {
  title?: string;
  subtitle?: string;
}) {
  const [tab, setTab] = useState<Tab>("ra-bills");
  const [search, setSearch] = useState("");
  const [organizationFilter, setOrganizationFilter] = useState("ALL");
  const [financialYearFilter, setFinancialYearFilter] = useState("ALL");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [expenseStatus, setExpenseStatus] = useState<ExpenseSheetStatus | "ALL">("ALL");
  const [selectedSheet, setSelectedSheet] = useState<ExpenseSheetItem | null>(null);

  const {
    data: billStatus,
    isLoading: loadingBills,
    isFetching: fetchingBills,
    refetch: refetchBills,
  } = useQuery({
    queryKey: ["accounts-bill-status"],
    queryFn: () => api.getAllProjectsBillStatus(),
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: expenseData,
    isLoading: loadingExpenses,
    isFetching: fetchingExpenses,
    refetch: refetchExpenses,
  } = useQuery({
    queryKey: ["accounts-expense-sheets"],
    queryFn: () => api.getExpenseSheets({ page: 1, limit: 500 }),
    staleTime: 2 * 60 * 1000,
  });

  const billRows = billStatus?.rows ?? [];
  const expenseSheets = expenseData?.items ?? [];

  const financialYearOptions = useMemo(
    () =>
      collectHodFinancialYearOptions(
        billRows.map((row) => ({ name: row.dprProject, projectNumber: row.projectNo }))
      ),
    [billRows]
  );

  const projectOptions = useMemo(() => {
    const fromBills = billRows.map((r) => ({ id: r.projectId, label: r.projectNo || r.dprProject }));
    const fromExpenses = expenseSheets
      .filter((s) => s.projectId)
      .map((s) => ({
        id: s.projectId!,
        label: s.projectNumber || s.projectName || s.projectId!,
      }));
    const map = new Map<string, string>();
    for (const p of [...fromBills, ...fromExpenses]) {
      if (!map.has(p.id)) map.set(p.id, p.label);
    }
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  }, [billRows, expenseSheets]);

  const filteredBills = useMemo(() => {
    const q = search.trim().toLowerCase();
    return billRows.filter((row) => {
      const projectRef = { name: row.dprProject, projectNumber: row.projectNo };
      if (organizationFilter !== "ALL" && getProjectCompanyCode(projectRef) !== organizationFilter) return false;
      const fy = getProjectFinancialYearShort(projectRef);
      if (financialYearFilter !== "ALL" && String(fy ?? "") !== financialYearFilter) return false;
      if (projectFilter !== "ALL" && row.projectId !== projectFilter) return false;
      if (!q) return true;
      return [row.dprProject, row.projectNo, row.remark].join(" ").toLowerCase().includes(q);
    });
  }, [billRows, search, organizationFilter, financialYearFilter, projectFilter]);

  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenseSheets.filter((sheet) => {
      const projectRef = {
        name: sheet.projectName || "",
        projectNumber: sheet.projectNumber,
      };
      if (organizationFilter !== "ALL" && getProjectCompanyCode(projectRef) !== organizationFilter) return false;
      const fy = getProjectFinancialYearShort(projectRef);
      if (financialYearFilter !== "ALL" && String(fy ?? "") !== financialYearFilter) return false;
      if (projectFilter !== "ALL" && sheet.projectId !== projectFilter) return false;
      if (expenseStatus !== "ALL" && sheet.status !== expenseStatus) return false;
      if (!q) return true;
      return [
        sheet.employeeName,
        sheet.siteName,
        sheet.projectName,
        sheet.projectNumber,
        sheet.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [expenseSheets, search, organizationFilter, financialYearFilter, projectFilter, expenseStatus]);

  const billTotals = useMemo(() => {
    return filteredBills.reduce(
      (acc, row) => ({
        wo: acc.wo + (Number(row.workOrderAmountExclGst) || 0),
        received: acc.received + (Number(row.receivedAmountExclGst) || 0),
        claimed: acc.claimed + (Number(row.raBillRaisedClaim) || 0),
        excessClaimed: acc.excessClaimed + (Number(row.excessBillRaisedClaim) || 0),
      }),
      { wo: 0, received: 0, claimed: 0, excessClaimed: 0 }
    );
  }, [filteredBills]);

  const expenseTotal = useMemo(
    () => filteredExpenses.reduce((sum, sheet) => sum + (Number(sheet.totalAmount) || 0), 0),
    [filteredExpenses]
  );

  const clearFilters = () => {
    setSearch("");
    setOrganizationFilter("ALL");
    setFinancialYearFilter("ALL");
    setProjectFilter("ALL");
    setExpenseStatus("ALL");
  };

  const refetch = () => {
    void refetchBills();
    void refetchExpenses();
  };
  const isFetching = fetchingBills || fetchingExpenses;

  return (
    <PageWrapper>
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title inline-flex items-center gap-2">
            <Landmark className="h-6 w-6" /> {title}
          </h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="rounded-full">
            {tab === "ra-bills"
              ? `Showing ${filteredBills.length} of ${billRows.length}`
              : `Showing ${filteredExpenses.length} of ${expenseSheets.length}`}
          </Badge>
          <Button size="sm" variant="outline" className="gap-1" disabled={isFetching} onClick={refetch}>
            {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-secondary/40 rounded-lg w-fit mb-4">
        <button
          type="button"
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
            tab === "ra-bills" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setTab("ra-bills")}
        >
          <Landmark className="h-4 w-4" /> RA Bills
          <Badge variant="outline" className="rounded-full text-[10px] px-1.5 py-0">
            {filteredBills.length}
          </Badge>
        </button>
        <button
          type="button"
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
            tab === "expenses" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setTab("expenses")}
        >
          <Receipt className="h-4 w-4" /> Expenses
          <Badge variant="outline" className="rounded-full text-[10px] px-1.5 py-0">
            {filteredExpenses.length}
          </Badge>
        </button>
      </div>

      <div className="glass-panel p-4 space-y-3 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground mb-1.5 block">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={tab === "ra-bills" ? "Project, number, remark..." : "Employee, site, project..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Organization</label>
            <Select value={organizationFilter} onValueChange={setOrganizationFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All ({tab === "ra-bills" ? billRows.length : expenseSheets.length})</SelectItem>
                {HOD_COMPANY_OPTIONS.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.code} — {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Financial Year</label>
            <Select value={financialYearFilter} onValueChange={setFinancialYearFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {financialYearOptions.map((fy) => (
                  <SelectItem key={fy} value={String(fy)}>
                    {formatHodFinancialYearLabel(fy)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Project</label>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All projects</SelectItem>
                {projectOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {tab === "expenses" ? (
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Status</label>
              <Select
                value={expenseStatus}
                onValueChange={(v) => setExpenseStatus(v as ExpenseSheetStatus | "ALL")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="SUBMITTED">Submitted</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" className="gap-1" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" /> Clear filters
          </Button>
        </div>
      </div>

      {tab === "ra-bills" ? (
        loadingBills ? (
          <div className="glass-panel p-10 text-center text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading RA bills...
          </div>
        ) : filteredBills.length === 0 ? (
          <div className="glass-panel p-10 text-center text-muted-foreground">No RA bill records match the filters.</div>
        ) : (
          <div className="glass-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1100px]">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/30">
                    <th className="text-left font-medium p-3">Project No</th>
                    <th className="text-left font-medium p-3">Project / Work</th>
                    <th className="text-right font-medium p-3">WO Amt (Excl. GST)</th>
                    <th className="text-right font-medium p-3">Received</th>
                    <th className="text-right font-medium p-3">Financial Progress</th>
                    <th className="text-right font-medium p-3">RA Bill Raised</th>
                    <th className="text-right font-medium p-3">Excess Raised</th>
                    <th className="text-left font-medium p-3">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBills.map((row: FinancialProjectBillStatusRow) => (
                    <tr key={row.projectId} className="border-b border-border/20 hover:bg-secondary/20">
                      <td className="p-3 font-mono text-xs">{row.projectNo || "—"}</td>
                      <td className="p-3 max-w-[260px]">
                        <span className="line-clamp-2">{row.dprProject || "—"}</span>
                      </td>
                      <td className="p-3 text-right tabular-nums">{money(row.workOrderAmountExclGst)}</td>
                      <td className="p-3 text-right tabular-nums">{money(row.receivedAmountExclGst)}</td>
                      <td className="p-3 text-right tabular-nums">{row.financialProgressPct?.toFixed(2) ?? "0.00"}%</td>
                      <td className="p-3 text-right tabular-nums">{money(row.raBillRaisedClaim)}</td>
                      <td className="p-3 text-right tabular-nums">{money(row.excessBillRaisedClaim)}</td>
                      <td className="p-3 text-xs max-w-[180px] truncate" title={row.remark}>
                        {row.remark || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border/50 bg-secondary/30 font-semibold text-xs">
                    <td className="p-3" colSpan={2}>
                      Total ({filteredBills.length})
                    </td>
                    <td className="p-3 text-right tabular-nums">{money(billTotals.wo)}</td>
                    <td className="p-3 text-right tabular-nums">{money(billTotals.received)}</td>
                    <td className="p-3"></td>
                    <td className="p-3 text-right tabular-nums">{money(billTotals.claimed)}</td>
                    <td className="p-3 text-right tabular-nums">{money(billTotals.excessClaimed)}</td>
                    <td className="p-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )
      ) : loadingExpenses ? (
        <div className="glass-panel p-10 text-center text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading expenses...
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="glass-panel p-10 text-center text-muted-foreground">No expense sheets match the filters.</div>
      ) : (
        <div className="glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1000px]">
              <thead>
                <tr className="text-muted-foreground border-b border-border/30">
                  <th className="text-left font-medium p-3">Employee</th>
                  <th className="text-left font-medium p-3">Site</th>
                  <th className="text-left font-medium p-3">Project</th>
                  <th className="text-left font-medium p-3">Expense Date</th>
                  <th className="text-center font-medium p-3">Status</th>
                  <th className="text-right font-medium p-3">Amount</th>
                  <th className="text-right font-medium p-3 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((sheet) => (
                  <tr key={sheet.id} className="border-b border-border/20 hover:bg-secondary/20">
                    <td className="p-3">{sheet.employeeName || sheet.employee?.name || "—"}</td>
                    <td className="p-3">{sheet.siteName || "—"}</td>
                    <td className="p-3 text-xs">
                      <div className="font-mono">{sheet.projectNumber || "—"}</div>
                      <div className="text-muted-foreground truncate max-w-[200px]">{sheet.projectName || ""}</div>
                    </td>
                    <td className="p-3">{formatDate(sheet.expenseDate)}</td>
                    <td className="p-3 text-center">
                      <ExpenseStatusBadge status={sheet.status} />
                    </td>
                    <td className="p-3 text-right tabular-nums">{money(sheet.totalAmount || 0)}</td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setSelectedSheet(sheet)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border/50 bg-secondary/30 font-semibold text-xs">
                  <td className="p-3" colSpan={5}>
                    Total ({filteredExpenses.length})
                  </td>
                  <td className="p-3 text-right tabular-nums">{money(expenseTotal)}</td>
                  <td className="p-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {selectedSheet ? (
        <ExpenseSheetDetailDialog sheet={selectedSheet} onClose={() => setSelectedSheet(null)} />
      ) : null}
    </PageWrapper>
  );
}

function ExpenseSheetDetailDialog({
  sheet,
  onClose,
}: {
  sheet: ExpenseSheetItem;
  onClose: () => void;
}) {
  const { data: detail, isLoading } = useQuery({
    queryKey: ["accounts-expense-sheet", sheet.id],
    queryFn: () => api.getExpenseSheet(sheet.id),
    staleTime: 60_000,
  });

  const view = detail ?? sheet;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-3xl rounded-2xl border border-border bg-card shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border/40 px-5 py-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold">Expense Sheet (read-only)</p>
            <p className="text-xs text-muted-foreground">
              {view.employeeName || view.employee?.name} · {view.siteName}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="p-5 space-y-4 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Detail label="Status" value={<ExpenseStatusBadge status={view.status} />} />
            <Detail label="Expense Date" value={formatDate(view.expenseDate)} />
            <Detail label="Project" value={`${view.projectNumber || "—"} · ${view.projectName || ""}`} />
            <Detail label="Total Amount" value={money(view.totalAmount || 0)} />
            <Detail label="Site Incharge" value={view.siteIncharge || "—"} />
            <Detail label="Persons" value={String(view.totalPersons ?? "—")} />
          </div>
          {isLoading ? (
            <div className="text-muted-foreground inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading entries...
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/40">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/30 bg-secondary/20">
                    <th className="text-left font-medium p-2.5">Category</th>
                    <th className="text-left font-medium p-2.5">Date</th>
                    <th className="text-left font-medium p-2.5">Description</th>
                    <th className="text-right font-medium p-2.5">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(view.entries ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-muted-foreground">
                        No entries
                      </td>
                    </tr>
                  ) : (
                    (view.entries ?? []).map((entry) => (
                      <tr key={entry.id} className="border-b border-border/20">
                        <td className="p-2.5">{entry.category?.name || "—"}</td>
                        <td className="p-2.5">{formatDate(entry.entryDate)}</td>
                        <td className="p-2.5">{entry.description || "—"}</td>
                        <td className="p-2.5 text-right tabular-nums">{money(entry.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/40 bg-secondary/20 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div className="mt-0.5 break-words">{value}</div>
    </div>
  );
}
