import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageWrapper } from "@/components/PageWrapper";
import { ExpenseStatusBadge } from "@/components/expense/ExpenseStatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ExpenseEntryItem } from "@/lib/domain";
import {
  downloadDetailedExpenseSheetExcel,
  downloadDetailedExpenseSheetPdf,
  downloadSummaryExpenseSheetExcel,
  downloadSummaryExpenseSheetPdf,
  downloadVoucherReportExcel,
  downloadVoucherReportPdf,
  getSheetVouchers
} from "@/lib/expense-reports";
import { Loader2, Plus, Send, Trash2 } from "lucide-react";

type ExpenseSheetPageProps = {
  basePath: "/admin/expenses" | "/app/expenses";
};

export default function ExpenseSheetPage({ basePath }: ExpenseSheetPageProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, user } = useAuth();
  const isNew = id === "new";
  const canEdit = !isAdmin;

  const [reviewComments, setReviewComments] = useState("");
  const [entryForm, setEntryForm] = useState({
    categoryId: "",
    entryDate: new Date().toISOString().slice(0, 10),
    amount: "",
    description: "",
    billAvailable: "NO" as "YES" | "NO",
    billNumber: "",
    billFile: null as File | null
  });

  const { data: categories = [] } = useQuery({ queryKey: ["expense-categories"], queryFn: () => api.getExpenseCategories() });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: () => api.getProjects(), enabled: canEdit || isAdmin });
  const { data: profile } = useQuery({ queryKey: ["profile", "me"], queryFn: () => api.getProfile(), enabled: canEdit && isNew });

  const [headerForm, setHeaderForm] = useState({
    projectId: "",
    siteName: "",
    siteIncharge: "",
    totalPersons: "1",
    expenseDate: new Date().toISOString().slice(0, 10),
    mobileNumber: "",
    bankAccount: "",
    sheetNumber: ""
  });

  const { data: sheet, isLoading } = useQuery({
    queryKey: ["expense-sheet", id],
    queryFn: () => api.getExpenseSheet(id!),
    enabled: Boolean(id) && !isNew
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["expense-sheet", id] });
    void queryClient.invalidateQueries({ queryKey: ["expense-sheets"] });
    void queryClient.invalidateQueries({ queryKey: ["expense-dashboard"] });
  };

  const handleProjectSelect = (projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    setHeaderForm((prev) => ({
      ...prev,
      projectId,
      siteName: project?.name ?? prev.siteName
    }));
  };

  const createMutation = useMutation({
    mutationFn: () =>
      api.createExpenseSheet({
        projectId: headerForm.projectId || null,
        siteName: headerForm.siteName.trim(),
        siteIncharge: headerForm.siteIncharge.trim(),
        totalPersons: Number(headerForm.totalPersons),
        expenseDate: new Date(headerForm.expenseDate).toISOString(),
        mobileNumber: headerForm.mobileNumber || profile?.contactNumber || null,
        bankAccount: headerForm.bankAccount || null,
        sheetNumber: headerForm.sheetNumber ? Number(headerForm.sheetNumber) : null
      }),
    onSuccess: (created) => {
      toast.success("Expense sheet created");
      navigate(`${basePath}/${created.id}`, { replace: true });
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const submitMutation = useMutation({
    mutationFn: () => api.submitExpenseSheet(id!),
    onSuccess: () => {
      toast.success("Expense sheet submitted");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const reviewMutation = useMutation({
    mutationFn: (status: "APPROVED" | "REJECTED") => api.reviewExpenseSheet(id!, { status, comments: reviewComments || null }),
    onSuccess: () => {
      toast.success("Review saved");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const addEntryMutation = useMutation({
    mutationFn: async () => {
      let billAttachmentUrl: string | null = null;
      if (entryForm.billAvailable === "YES") {
        if (!entryForm.billFile) throw new Error("Upload bill attachment");
        const uploaded = await api.uploadFile(entryForm.billFile);
        billAttachmentUrl = uploaded.url;
      }
      return api.addExpenseEntry(id!, {
        categoryId: entryForm.categoryId,
        entryDate: entryForm.entryDate,
        amount: Number(entryForm.amount),
        description: entryForm.description,
        billAvailable: entryForm.billAvailable === "YES",
        billNumber: entryForm.billNumber || null,
        billAttachmentUrl
      });
    },
    onSuccess: () => {
      toast.success("Entry added");
      setEntryForm((prev) => ({ ...prev, amount: "", description: "", billNumber: "", billFile: null }));
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const deleteEntryMutation = useMutation({
    mutationFn: (entryId: string) => api.deleteExpenseEntry(entryId),
    onSuccess: () => {
      toast.success("Entry removed");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const editable = sheet && (sheet.status === "DRAFT" || sheet.status === "REJECTED") && sheet.employeeId === user?.id;

  if (isNew && canEdit) {
    return (
      <PageWrapper>
        <div className="page-header">
          <h1 className="page-title">Create Expense Sheet</h1>
          <p className="page-subtitle">Enter site details before adding daily expense entries.</p>
        </div>
        <div className="glass-panel p-6 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
          <Field label="Project">
            <Select value={headerForm.projectId} onValueChange={handleProjectSelect}>
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.projectNumber ? `${p.projectNumber} — ${p.name}` : p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Expense Date"><Input type="date" value={headerForm.expenseDate} onChange={(e) => setHeaderForm((p) => ({ ...p, expenseDate: e.target.value }))} /></Field>
          <Field label="Site Name">
            <Input
              value={headerForm.siteName}
              onChange={(e) => setHeaderForm((p) => ({ ...p, siteName: e.target.value }))}
              placeholder="Filled from project name; you can edit"
            />
          </Field>
          <Field label="Site Incharge"><Input value={headerForm.siteIncharge} onChange={(e) => setHeaderForm((p) => ({ ...p, siteIncharge: e.target.value }))} /></Field>
          <Field label="Total Persons at Site"><Input type="number" min={1} value={headerForm.totalPersons} onChange={(e) => setHeaderForm((p) => ({ ...p, totalPersons: e.target.value }))} /></Field>
          <Field label="Mobile Number"><Input value={headerForm.mobileNumber || profile?.contactNumber || ""} onChange={(e) => setHeaderForm((p) => ({ ...p, mobileNumber: e.target.value }))} /></Field>
          <Field label="Bank Account"><Input value={headerForm.bankAccount} onChange={(e) => setHeaderForm((p) => ({ ...p, bankAccount: e.target.value }))} /></Field>
          <Field label="Sheet Number"><Input type="number" value={headerForm.sheetNumber} onChange={(e) => setHeaderForm((p) => ({ ...p, sheetNumber: e.target.value }))} /></Field>
        </div>
        <Button className="mt-4" onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !headerForm.siteName || !headerForm.siteIncharge}>
          {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Create Sheet
        </Button>
      </PageWrapper>
    );
  }

  if (isLoading || !sheet) {
    return <PageWrapper><p className="text-muted-foreground">Loading expense sheet…</p></PageWrapper>;
  }

  const vouchers = getSheetVouchers(sheet);

  return (
    <PageWrapper>
      <div className="page-header flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title">{sheet.siteName}</h1>
          <p className="page-subtitle">
            {sheet.employeeName} · {sheet.projectNumber ?? "No project"} · <ExpenseStatusBadge status={sheet.status} />
          </p>
        </div>
        <Button asChild variant="outline"><Link to={basePath}>Back</Link></Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <Info label="Site Incharge" value={sheet.siteIncharge} />
        <Info label="Persons at Site" value={String(sheet.totalPersons)} />
        <Info label="Total Amount" value={`₹${(sheet.totalAmount ?? 0).toLocaleString("en-IN")}`} />
        <Info label="Mobile" value={sheet.mobileNumber ?? "-"} />
        <Info label="Bank Account" value={sheet.bankAccount ?? "-"} />
        <Info label="Expense Date" value={new Date(sheet.expenseDate).toLocaleDateString("en-IN")} />
      </div>

      {isAdmin && sheet.status === "SUBMITTED" ? (
        <div className="glass-panel p-4 mb-6 space-y-3">
          <h3 className="font-semibold">Review Expense Sheet</h3>
          <Textarea value={reviewComments} onChange={(e) => setReviewComments(e.target.value)} placeholder="Comments (optional)" />
          <div className="flex gap-2">
            <Button onClick={() => reviewMutation.mutate("APPROVED")} disabled={reviewMutation.isPending}>Approve</Button>
            <Button variant="destructive" onClick={() => reviewMutation.mutate("REJECTED")} disabled={reviewMutation.isPending}>Reject</Button>
          </div>
        </div>
      ) : null}

      {sheet.latestApproval ? (
        <div className="glass-panel p-4 mb-6 text-sm">
          <p><strong>Reviewed by:</strong> {sheet.latestApproval.reviewer?.name ?? "Admin"}</p>
          <p><strong>Date:</strong> {new Date(sheet.latestApproval.reviewedAt).toLocaleString("en-IN")}</p>
          <p><strong>Status:</strong> {sheet.latestApproval.status}</p>
          {sheet.latestApproval.comments ? <p><strong>Comments:</strong> {sheet.latestApproval.comments}</p> : null}
        </div>
      ) : null}

      <div className="glass-panel p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Expense Entries</h3>
          {editable ? (
            <Button size="sm" className="gap-1" onClick={() => addEntryMutation.mutate()} disabled={addEntryMutation.isPending || !entryForm.categoryId || !entryForm.amount}>
              <Plus className="h-3.5 w-3.5" /> Add Entry
            </Button>
          ) : null}
        </div>

        {editable ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-6 p-4 rounded-xl border border-border/40 bg-secondary/10">
            <Field label="Category">
              <Select value={entryForm.categoryId} onValueChange={(v) => setEntryForm((p) => ({ ...p, categoryId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Entry Date"><Input type="date" value={entryForm.entryDate} onChange={(e) => setEntryForm((p) => ({ ...p, entryDate: e.target.value }))} /></Field>
            <Field label="Amount"><Input type="number" min={0} step="0.01" value={entryForm.amount} onChange={(e) => setEntryForm((p) => ({ ...p, amount: e.target.value }))} /></Field>
            <Field label="Description" className="md:col-span-2">
              <Input value={entryForm.description} onChange={(e) => setEntryForm((p) => ({ ...p, description: e.target.value }))} />
            </Field>
            <Field label="Bill Available?">
              <Select value={entryForm.billAvailable} onValueChange={(v) => setEntryForm((p) => ({ ...p, billAvailable: v as "YES" | "NO", billFile: null }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="YES">Yes</SelectItem>
                  <SelectItem value="NO">No</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {entryForm.billAvailable === "YES" ? (
              <>
                <Field label="Bill Number (optional)"><Input value={entryForm.billNumber} onChange={(e) => setEntryForm((p) => ({ ...p, billNumber: e.target.value }))} /></Field>
                <Field label="Bill Attachment (JPG/PNG/PDF)">
                  <Input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setEntryForm((p) => ({ ...p, billFile: e.target.files?.[0] ?? null }))} />
                </Field>
              </>
            ) : null}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 text-muted-foreground">
                <th className="py-2 pr-3 text-left">Date</th>
                <th className="py-2 px-3 text-left">Category</th>
                <th className="py-2 px-3 text-left">Description</th>
                <th className="py-2 px-3 text-right">Amount</th>
                <th className="py-2 px-3 text-left">Bill</th>
                <th className="py-2 px-3 text-left">Voucher</th>
                {editable ? <th className="py-2 pl-3 text-right">Action</th> : null}
              </tr>
            </thead>
            <tbody>
              {sheet.entries.map((entry: ExpenseEntryItem) => (
                <tr key={entry.id} className="border-b border-border/20">
                  <td className="py-2 pr-3">{new Date(entry.entryDate).toLocaleDateString("en-IN")}</td>
                  <td className="py-2 px-3">{entry.category?.name}</td>
                  <td className="py-2 px-3">{entry.description}</td>
                  <td className="py-2 px-3 text-right tabular-nums">₹{entry.amount.toLocaleString("en-IN")}</td>
                  <td className="py-2 px-3">{entry.billAvailable ? "Yes" : "No"}</td>
                  <td className="py-2 px-3">{entry.voucher?.voucherNumber ?? "-"}</td>
                  {editable ? (
                    <td className="py-2 pl-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => deleteEntryMutation.mutate(entry.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editable ? (
          <Button className="mt-4 gap-2" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending || sheet.entries.length === 0}>
            <Send className="h-4 w-4" /> Submit for Approval
          </Button>
        ) : null}
      </div>

      <div className="glass-panel p-6">
        <h3 className="font-semibold mb-3">Reports</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => downloadSummaryExpenseSheetExcel(sheet)}>Summary Excel</Button>
          <Button variant="outline" onClick={() => downloadSummaryExpenseSheetPdf(sheet)}>Summary PDF</Button>
          <Button variant="outline" onClick={() => downloadDetailedExpenseSheetExcel(sheet)}>Detailed Excel</Button>
          <Button variant="outline" onClick={() => downloadDetailedExpenseSheetPdf(sheet)}>Detailed PDF</Button>
          <Button variant="outline" onClick={() => downloadVoucherReportExcel(vouchers, sheet.id)} disabled={vouchers.length === 0}>Voucher Excel</Button>
          <Button variant="outline" onClick={() => downloadVoucherReportPdf(vouchers, { projectName: sheet.projectName ?? sheet.siteName, projectNumber: sheet.projectNumber })} disabled={vouchers.length === 0}>Voucher PDF</Button>
        </div>
      </div>
    </PageWrapper>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><Label className="text-xs text-muted-foreground mb-1.5 block">{label}</Label>{children}</div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border/40 bg-secondary/20 px-3 py-2.5"><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium mt-0.5">{value}</p></div>;
}
