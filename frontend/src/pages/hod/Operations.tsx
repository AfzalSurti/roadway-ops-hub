import { useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import type { PreContractActivityItem } from "@/lib/domain";
import { WORK_CATEGORY_OPTIONS, CLIENT_OPTIONS, SECURITY_DEPOSIT_TYPE_OPTIONS } from "@/lib/domain";
import { useQuery } from "@tanstack/react-query";
import { Cog, Eye, Loader2, RefreshCcw, Search, X } from "lucide-react";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN");
}

function formatCurrency(value: number) {
  if (!value) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export default function HodOperations() {
  const [search, setSearch] = useState("");
  const [workCategoryFilter, setWorkCategoryFilter] = useState("ALL");
  const [clientFilter, setClientFilter] = useState("ALL");
  const [selectedItem, setSelectedItem] = useState<PreContractActivityItem | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["hod-operations"],
    queryFn: () => api.getPreContractActivities({ page: 1, limit: 500 }),
    staleTime: 2 * 60 * 1000
  });

  const items = data?.items ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (workCategoryFilter !== "ALL" && item.workCategory !== workCategoryFilter) return false;
      if (clientFilter !== "ALL" && item.client !== clientFilter) return false;
      if (!q) return true;
      return [item.nameOfWork, item.workCategory, item.client, item.state].join(" ").toLowerCase().includes(q);
    });
  }, [items, search, workCategoryFilter, clientFilter]);

  const clearFilters = () => {
    setSearch("");
    setWorkCategoryFilter("ALL");
    setClientFilter("ALL");
  };

  return (
    <PageWrapper>
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title inline-flex items-center gap-2">
            <Cog className="h-6 w-6" /> Operations — Pre-Contract Activities
          </h1>
          <p className="page-subtitle">
            Read-only view of all pre-contract activities including security deposits, agreements, and work orders.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="rounded-full">{filtered.length} activit(ies)</Badge>
          <Button size="sm" variant="outline" className="gap-1" disabled={isFetching} onClick={() => refetch()}>
            {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
        </div>
      </div>

      <div className="glass-panel p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Name of work, client, state..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Work Category</label>
            <Select value={workCategoryFilter} onValueChange={setWorkCategoryFilter}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {WORK_CATEGORY_OPTIONS.map((o) => <SelectItem key={o.code} value={o.code}>{o.code} — {o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Client</label>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {CLIENT_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" className="gap-1" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" /> Clear filters
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="glass-panel p-10 text-center text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading activities...
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel p-10 text-center text-muted-foreground">No activities match the selected filters.</div>
      ) : (
        <div className="glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1400px]">
              <thead>
                <tr className="text-muted-foreground border-b border-border/30">
                  <th className="text-left font-medium p-3 w-12">Sr</th>
                  <th className="text-left font-medium p-3">Name of Work</th>
                  <th className="text-left font-medium p-3 w-16">W.C.</th>
                  <th className="text-left font-medium p-3">Client</th>
                  <th className="text-left font-medium p-3">State / Region</th>
                  <th className="text-left font-medium p-3">Award / LOA</th>
                  <th className="text-left font-medium p-3">Security Deposit</th>
                  <th className="text-left font-medium p-3">Agreement</th>
                  <th className="text-left font-medium p-3">Work Order</th>
                  <th className="text-left font-medium p-3">Insurance</th>
                  <th className="text-right font-medium p-3 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="border-b border-border/20 hover:bg-secondary/20">
                    <td className="p-3 font-medium tabular-nums">{item.srNo}</td>
                    <td className="p-3 max-w-[220px]"><span className="line-clamp-2">{item.nameOfWork}</span></td>
                    <td className="p-3 font-mono text-xs">{item.workCategory}</td>
                    <td className="p-3">{item.client}</td>
                    <td className="p-3">{item.state || "Not Selected"}</td>
                    <td className="p-3 text-xs">{formatDate(item.awardOfProjectDate)}</td>
                    <td className="p-3 text-xs">
                      {item.securityDepositType ? (
                        <div>
                          <Badge variant="outline" className="text-[10px] mb-0.5">
                            {SECURITY_DEPOSIT_TYPE_OPTIONS.find((o) => o.value === item.securityDepositType)?.label ?? item.securityDepositType}
                          </Badge>
                          {item.sdAmount ? <div className="tabular-nums">{formatCurrency(item.sdAmount)}</div> : null}
                        </div>
                      ) : "—"}
                    </td>
                    <td className="p-3 text-xs">{formatDate(item.signingAgreementDate)}</td>
                    <td className="p-3 text-xs">{formatDate(item.proceedingOrderDate)}</td>
                    <td className="p-3 text-xs max-w-[120px] truncate" title={item.insurancePolicy}>{item.insurancePolicy || "—"}</td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setSelectedItem(item)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-card border-b border-border/40 px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Pre-Contract Activity Details (read-only)</p>
                <p className="text-xs text-muted-foreground">Sr #{selectedItem.srNo}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelectedItem(null)}>Close</Button>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {([
                ["Name of Work", selectedItem.nameOfWork],
                ["Work Category", selectedItem.workCategory],
                ["Client", selectedItem.client],
                ["State / Region", selectedItem.state || "Not Selected"],
                ["Award of Project Date", formatDate(selectedItem.awardOfProjectDate)],
                ["Security Deposit Type", SECURITY_DEPOSIT_TYPE_OPTIONS.find((o) => o.value === selectedItem.securityDepositType)?.label ?? "—"],
                ["SD Bank", selectedItem.sdBank],
                ["SD Issued Date", formatDate(selectedItem.sdIssuedDate)],
                ["SD Number", selectedItem.sdNumber],
                ["SD Amount", formatCurrency(selectedItem.sdAmount)],
                ["SD Expiry Date", formatDate(selectedItem.sdExpiryDate)],
                ["Signing Agreement Date", formatDate(selectedItem.signingAgreementDate)],
                ["Proceeding / Work Order Date", formatDate(selectedItem.proceedingOrderDate)],
                ["Insurance Policy", selectedItem.insurancePolicy],
                ["Remarks", selectedItem.remarks]
              ] as const).map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border/40 bg-secondary/20 px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <p className="mt-0.5 break-words">{value || "—"}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
