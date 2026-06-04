import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageWrapper } from "@/components/PageWrapper";
import { ExpenseStatusBadge } from "@/components/expense/ExpenseStatusBadge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { downloadVoucherReportExcel, downloadVoucherReportPdf } from "@/lib/expense-reports";

export default function ExpenseVouchers() {
  const { data, isLoading } = useQuery({
    queryKey: ["expense-vouchers"],
    queryFn: () => api.getExpenseVouchers({ limit: "500" })
  });

  const vouchers = data?.items ?? [];
  const total = vouchers.reduce((sum, item) => sum + item.amount, 0);

  return (
    <PageWrapper>
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title">Voucher Register</h1>
          <p className="page-subtitle">Auto-generated vouchers for expenses without bills.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/admin/expenses">Dashboard</Link></Button>
          <Button variant="outline" disabled={vouchers.length === 0} onClick={() => downloadVoucherReportExcel(vouchers, "register")}>Export Excel</Button>
          <Button variant="outline" disabled={vouchers.length === 0} onClick={() => downloadVoucherReportPdf(vouchers, {})}>Export PDF</Button>
        </div>
      </div>

      <div className="glass-panel p-4 mb-4 text-sm">
        <p><strong>Total voucher entries:</strong> {vouchers.length}</p>
        <p><strong>Total voucher amount:</strong> ₹{total.toLocaleString("en-IN")}</p>
      </div>

      <div className="glass-panel p-6 overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead>
            <tr className="border-b border-border/40 text-muted-foreground">
              <th className="py-3 pr-4 text-left">Voucher No</th>
              <th className="py-3 px-4 text-left">Date</th>
              <th className="py-3 px-4 text-left">Employee</th>
              <th className="py-3 px-4 text-left">Project</th>
              <th className="py-3 px-4 text-left">Category</th>
              <th className="py-3 px-4 text-left">Description</th>
              <th className="py-3 px-4 text-right">Amount</th>
              <th className="py-3 pl-4 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">Loading…</td></tr> : null}
            {vouchers.map((voucher) => (
              <tr key={voucher.id} className="border-b border-border/20">
                <td className="py-3 pr-4 font-medium">{voucher.voucherNumber}</td>
                <td className="py-3 px-4">{new Date(voucher.date).toLocaleDateString("en-IN")}</td>
                <td className="py-3 px-4">{voucher.employeeName}</td>
                <td className="py-3 px-4">{voucher.projectNumber ?? voucher.projectName}</td>
                <td className="py-3 px-4">{voucher.expenseCategory}</td>
                <td className="py-3 px-4 max-w-[240px] truncate">{voucher.description}</td>
                <td className="py-3 px-4 text-right tabular-nums">₹{voucher.amount.toLocaleString("en-IN")}</td>
                <td className="py-3 pl-4"><ExpenseStatusBadge status={voucher.approvalStatus} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageWrapper>
  );
}
