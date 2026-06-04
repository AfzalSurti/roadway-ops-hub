import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageWrapper } from "@/components/PageWrapper";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import {
  downloadDetailedExpenseSheetExcel,
  downloadDetailedExpenseSheetPdf,
  downloadSummaryExpenseSheetExcel,
  downloadSummaryExpenseSheetPdf,
  downloadVoucherReportExcel,
  downloadVoucherReportPdf,
  getSheetVouchers
} from "@/lib/expense-reports";
import { FileSpreadsheet } from "lucide-react";

export default function ExpenseReports() {
  const [sheetId, setSheetId] = useState("");

  const { data: sheets } = useQuery({
    queryKey: ["expense-sheets", "reports"],
    queryFn: () => api.getExpenseSheets({ limit: 200 })
  });

  const { data: sheet } = useQuery({
    queryKey: ["expense-sheet", sheetId],
    queryFn: () => api.getExpenseSheet(sheetId),
    enabled: Boolean(sheetId)
  });

  const vouchers = sheet ? getSheetVouchers(sheet) : [];

  return (
    <PageWrapper>
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title">Expense Reports</h1>
          <p className="page-subtitle">Generate summary, detailed, and voucher reports in PDF or Excel.</p>
        </div>
        <Button asChild variant="outline"><Link to="/admin/expenses">Dashboard</Link></Button>
      </div>

      <div className="glass-panel p-6 max-w-3xl space-y-4">
        <div>
          <p className="text-sm font-medium mb-2">Select expense sheet</p>
          <Select value={sheetId} onValueChange={setSheetId}>
            <SelectTrigger><SelectValue placeholder="Choose a submitted expense sheet" /></SelectTrigger>
            <SelectContent>
              {(sheets?.items ?? []).map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.employeeName} — {item.siteName} ({new Date(item.expenseDate).toLocaleDateString("en-IN")})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {sheet ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ReportButton label="Generate Summary Expense Sheet (Excel)" onClick={() => downloadSummaryExpenseSheetExcel(sheet)} />
            <ReportButton label="Generate Summary Expense Sheet (PDF)" onClick={() => downloadSummaryExpenseSheetPdf(sheet)} />
            <ReportButton label="Generate Detailed Expense Sheet (Excel)" onClick={() => downloadDetailedExpenseSheetExcel(sheet)} />
            <ReportButton label="Generate Detailed Expense Sheet (PDF)" onClick={() => downloadDetailedExpenseSheetPdf(sheet)} />
            <ReportButton label="Download Voucher Report (Excel)" onClick={() => downloadVoucherReportExcel(vouchers, sheet.id)} disabled={vouchers.length === 0} />
            <ReportButton label="Download Voucher Report (PDF)" onClick={() => downloadVoucherReportPdf(vouchers, { projectName: sheet.projectName ?? sheet.siteName, projectNumber: sheet.projectNumber })} disabled={vouchers.length === 0} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Select an expense sheet to enable report downloads.</p>
        )}
      </div>
    </PageWrapper>
  );
}

function ReportButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <Button variant="outline" className="justify-start h-auto py-3 px-4 text-left whitespace-normal" onClick={onClick} disabled={disabled}>
      <FileSpreadsheet className="h-4 w-4 mr-2 shrink-0" />
      {label}
    </Button>
  );
}
