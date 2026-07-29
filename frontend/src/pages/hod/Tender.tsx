import { useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import type { TenderBidItem, TenderBidStatus } from "@/lib/domain";
import { WORK_CATEGORY_OPTIONS, CLIENT_OPTIONS } from "@/lib/domain";
import { useQuery } from "@tanstack/react-query";
import { Gavel, Loader2, RefreshCcw, Search, X } from "lucide-react";

function formatCurrency(value: number) {
  if (!value) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export default function HodTender() {
  const [search, setSearch] = useState("");
  const [workCategoryFilter, setWorkCategoryFilter] = useState("ALL");
  const [clientFilter, setClientFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<TenderBidStatus | "ALL">("ALL");

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["hod-tender-bids"],
    queryFn: () => api.getTenderBids({ page: 1, limit: 500 }),
    staleTime: 2 * 60 * 1000
  });

  const items = data?.items ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((bid) => {
      if (workCategoryFilter !== "ALL" && bid.workCategory !== workCategoryFilter) return false;
      if (clientFilter !== "ALL" && bid.client !== clientFilter) return false;
      if (statusFilter !== "ALL" && bid.status !== statusFilter) return false;
      if (!q) return true;
      return [bid.nameOfWork, bid.workCategory, bid.client, bid.state].join(" ").toLowerCase().includes(q);
    });
  }, [items, search, workCategoryFilter, clientFilter, statusFilter]);

  const allottedCount = useMemo(() => filtered.filter((b) => b.status === "ALLOTTED").length, [filtered]);

  const clearFilters = () => {
    setSearch("");
    setWorkCategoryFilter("ALL");
    setClientFilter("ALL");
    setStatusFilter("ALL");
  };

  return (
    <PageWrapper>
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title inline-flex items-center gap-2">
            <Gavel className="h-6 w-6" /> Tender — Submitted Bids
          </h1>
          <p className="page-subtitle">
            Read-only view of all submitted tender bids. Filter by work category, client, and status.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="rounded-full">{filtered.length} bid(s)</Badge>
          <Badge variant="outline" className="rounded-full">{allottedCount} allotted</Badge>
          <Button size="sm" variant="outline" className="gap-1" disabled={isFetching} onClick={() => refetch()}>
            {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
        </div>
      </div>

      <div className="glass-panel p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
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
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Status</label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TenderBidStatus | "ALL")}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="ALLOTTED">Allotted</SelectItem>
                <SelectItem value="NOT_ALLOTTED">Not Allotted</SelectItem>
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
          <Loader2 className="h-4 w-4 animate-spin" /> Loading bids...
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel p-10 text-center text-muted-foreground">No bids match the selected filters.</div>
      ) : (
        <div className="glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1100px]">
              <thead>
                <tr className="text-muted-foreground border-b border-border/30">
                  <th className="text-left font-medium p-3 w-12">Sr</th>
                  <th className="text-left font-medium p-3">Name of Work</th>
                  <th className="text-left font-medium p-3 w-16">W.C.</th>
                  <th className="text-left font-medium p-3">Client</th>
                  <th className="text-left font-medium p-3">State</th>
                  <th className="text-right font-medium p-3">EMD</th>
                  <th className="text-right font-medium p-3">Tender Fees</th>
                  <th className="text-right font-medium p-3">Infracon Fees</th>
                  <th className="text-center font-medium p-3">Status</th>
                  <th className="text-center font-medium p-3">Letter</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((bid: TenderBidItem) => (
                  <tr key={bid.id} className="border-b border-border/20 hover:bg-secondary/20">
                    <td className="p-3 font-medium tabular-nums">{bid.srNo}</td>
                    <td className="p-3 max-w-[260px]"><span className="line-clamp-2">{bid.nameOfWork}</span></td>
                    <td className="p-3 font-mono text-xs">{bid.workCategory}</td>
                    <td className="p-3">{bid.client}</td>
                    <td className="p-3">{bid.state || "—"}</td>
                    <td className="p-3 text-right tabular-nums">{formatCurrency(bid.emd)}</td>
                    <td className="p-3 text-right tabular-nums">{formatCurrency(bid.tenderFees)}</td>
                    <td className="p-3 text-right tabular-nums">{formatCurrency(bid.infraconFees)}</td>
                    <td className="p-3 text-center">
                      <Badge variant={bid.status === "ALLOTTED" ? "secondary" : "outline"}>
                        {bid.status === "ALLOTTED" ? "Allotted" : "Not Allotted"}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      {bid.status === "ALLOTTED" ? (
                        <span className="text-xs text-emerald-600">LOA Letter</span>
                      ) : (
                        <span className="text-xs text-amber-600">EMD Return</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
