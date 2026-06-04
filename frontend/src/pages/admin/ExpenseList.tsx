import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageWrapper } from "@/components/PageWrapper";
import { ExpenseStatusBadge } from "@/components/expense/ExpenseStatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import type { ExpenseSheetStatus } from "@/lib/domain";
import { Eye, Search } from "lucide-react";

export default function ExpenseList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [employeeId, setEmployeeId] = useState("ALL");
  const [projectId, setProjectId] = useState("ALL");
  const [billAvailable, setBillAvailable] = useState("ALL");

  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: () => api.getUsers() });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: () => api.getProjects() });
  const { data: categories = [] } = useQuery({ queryKey: ["expense-categories"], queryFn: () => api.getExpenseCategories() });

  const queryParams = useMemo(
    () => ({
      search: search.trim() || undefined,
      status: status === "ALL" ? undefined : (status as ExpenseSheetStatus),
      employeeId: employeeId === "ALL" ? undefined : employeeId,
      projectId: projectId === "ALL" ? undefined : projectId,
      billAvailable: billAvailable === "ALL" ? undefined : billAvailable === "YES",
      limit: 100
    }),
    [billAvailable, employeeId, projectId, search, status]
  );

  const { data, isLoading } = useQuery({
    queryKey: ["expense-sheets", queryParams],
    queryFn: () => api.getExpenseSheets(queryParams)
  });

  return (
    <PageWrapper>
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title">Expense List</h1>
          <p className="page-subtitle">Review and filter all employee expense sheets.</p>
        </div>
        <Button asChild variant="outline"><Link to="/admin/expenses">Back to Dashboard</Link></Button>
      </div>

      <div className="glass-panel p-4 mb-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        <div className="relative xl:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search site, employee, project…" className="pl-10" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="SUBMITTED">Submitted</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={employeeId} onValueChange={setEmployeeId}>
          <SelectTrigger><SelectValue placeholder="Employee" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All employees</SelectItem>
            {users.filter((u) => u.role === "EMPLOYEE").map((user) => (
              <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All projects</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>{project.projectNumber ?? project.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={billAvailable} onValueChange={setBillAvailable}>
          <SelectTrigger><SelectValue placeholder="Bill available" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All bills</SelectItem>
            <SelectItem value="YES">Bill available</SelectItem>
            <SelectItem value="NO">No bill (voucher)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="glass-panel p-6 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-border/40 text-muted-foreground">
              <th className="py-3 pr-4 text-left">Employee</th>
              <th className="py-3 px-4 text-left">Project</th>
              <th className="py-3 px-4 text-left">Site</th>
              <th className="py-3 px-4 text-left">Date</th>
              <th className="py-3 px-4 text-right">Amount</th>
              <th className="py-3 px-4 text-left">Status</th>
              <th className="py-3 pl-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : null}
            {(data?.items ?? []).map((sheet) => (
              <tr key={sheet.id} className="border-b border-border/20">
                <td className="py-3 pr-4">{sheet.employeeName}</td>
                <td className="py-3 px-4">{sheet.projectNumber ?? "-"}</td>
                <td className="py-3 px-4">{sheet.siteName}</td>
                <td className="py-3 px-4">{new Date(sheet.expenseDate).toLocaleDateString("en-IN")}</td>
                <td className="py-3 px-4 text-right tabular-nums">₹{(sheet.totalAmount ?? 0).toLocaleString("en-IN")}</td>
                <td className="py-3 px-4"><ExpenseStatusBadge status={sheet.status} /></td>
                <td className="py-3 pl-4 text-right">
                  <Button asChild size="sm" variant="outline" className="gap-1">
                    <Link to={`/admin/expenses/${sheet.id}`}><Eye className="h-3.5 w-3.5" />View</Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && (data?.items.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No expense sheets found.</p>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground mt-2">{categories.length} expense categories configured.</p>
    </PageWrapper>
  );
}
