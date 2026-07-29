import { useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import type { TenderBidItem, TenderBidStatus } from "@/lib/domain";
import { WORK_CATEGORY_OPTIONS, CLIENT_OPTIONS } from "@/lib/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gavel, Loader2, Plus, RefreshCcw, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

function formatCurrency(value: number) {
  if (!value) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export default function TenderDashboard() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [workCategoryFilter, setWorkCategoryFilter] = useState("ALL");
  const [clientFilter, setClientFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<TenderBidStatus | "ALL">("ALL");
  const [showAddForm, setShowAddForm] = useState(false);

  const [newBid, setNewBid] = useState({
    nameOfWork: "",
    workCategory: "",
    client: "",
    state: "",
    emd: 0,
    tenderFees: 0,
    infraconFees: 0,
    status: "NOT_ALLOTTED" as TenderBidStatus,
    remarks: ""
  });

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["tender-bids"],
    queryFn: () => api.getTenderBids({ page: 1, limit: 500 }),
    staleTime: 2 * 60 * 1000
  });

  const items = data?.items ?? [];

  const createMutation = useMutation({
    mutationFn: (payload: typeof newBid) => api.createTenderBid(payload),
    onSuccess: () => {
      toast.success("Tender bid added");
      queryClient.invalidateQueries({ queryKey: ["tender-bids"] });
      setShowAddForm(false);
      setNewBid({ nameOfWork: "", workCategory: "", client: "", state: "", emd: 0, tenderFees: 0, infraconFees: 0, status: "NOT_ALLOTTED", remarks: "" });
    },
    onError: (e) => toast.error(e.message)
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<TenderBidItem> }) => api.updateTenderBid(id, payload),
    onSuccess: () => {
      toast.success("Updated");
      queryClient.invalidateQueries({ queryKey: ["tender-bids"] });
    },
    onError: (e) => toast.error(e.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTenderBid(id),
    onSuccess: () => {
      toast.success("Deleted");
      queryClient.invalidateQueries({ queryKey: ["tender-bids"] });
    },
    onError: (e) => toast.error(e.message)
  });

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
            <Gavel className="h-6 w-6" /> Submitted Bids
          </h1>
          <p className="page-subtitle">Manage tender bids — track status, EMD, fees, and generate letters.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="rounded-full">{filtered.length} bid(s)</Badge>
          <Button size="sm" variant="outline" className="gap-1" disabled={isFetching} onClick={() => refetch()}>
            {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
          <Button size="sm" className="gap-1" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="h-3.5 w-3.5" /> Add Bid
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

      {showAddForm && (
        <div className="glass-panel p-4 space-y-3">
          <h3 className="font-semibold text-sm">New Tender Bid</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Name of Work *</label>
              <Input value={newBid.nameOfWork} onChange={(e) => setNewBid({ ...newBid, nameOfWork: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Work Category *</label>
              <Select value={newBid.workCategory} onValueChange={(v) => setNewBid({ ...newBid, workCategory: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {WORK_CATEGORY_OPTIONS.map((o) => <SelectItem key={o.code} value={o.code}>{o.code} — {o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Client *</label>
              <Select value={newBid.client} onValueChange={(v) => setNewBid({ ...newBid, client: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {CLIENT_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">State</label>
              <Input value={newBid.state} onChange={(e) => setNewBid({ ...newBid, state: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">EMD</label>
              <Input type="number" value={newBid.emd || ""} onChange={(e) => setNewBid({ ...newBid, emd: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tender Fees</label>
              <Input type="number" value={newBid.tenderFees || ""} onChange={(e) => setNewBid({ ...newBid, tenderFees: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Infracon Fees</label>
              <Input type="number" value={newBid.infraconFees || ""} onChange={(e) => setNewBid({ ...newBid, infraconFees: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
              <Select value={newBid.status} onValueChange={(v) => setNewBid({ ...newBid, status: v as TenderBidStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALLOTTED">Allotted</SelectItem>
                  <SelectItem value="NOT_ALLOTTED">Not Allotted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
            <Button
              size="sm"
              disabled={!newBid.nameOfWork || !newBid.workCategory || !newBid.client || createMutation.isPending}
              onClick={() => createMutation.mutate(newBid)}
            >
              {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Save
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="glass-panel p-10 text-center text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading bids...
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel p-10 text-center text-muted-foreground">No bids match the selected filters.</div>
      ) : (
        <div className="glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1200px]">
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
                  <th className="text-right font-medium p-3 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((bid) => (
                  <TenderRow key={bid.id} bid={bid} onUpdate={updateMutation.mutate} onDelete={deleteMutation.mutate} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}

function TenderRow({
  bid,
  onUpdate,
  onDelete
}: {
  bid: TenderBidItem;
  onUpdate: (args: { id: string; payload: Partial<TenderBidItem> }) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <tr className="border-b border-border/20 hover:bg-secondary/20">
      <td className="p-3 font-medium tabular-nums">{bid.srNo}</td>
      <td className="p-3 max-w-[260px]">
        <span className="line-clamp-2">{bid.nameOfWork}</span>
      </td>
      <td className="p-3 font-mono text-xs">{bid.workCategory}</td>
      <td className="p-3">{bid.client}</td>
      <td className="p-3">{bid.state || "—"}</td>
      <td className="p-3 text-right tabular-nums">{formatCurrency(bid.emd)}</td>
      <td className="p-3 text-right tabular-nums">{formatCurrency(bid.tenderFees)}</td>
      <td className="p-3 text-right tabular-nums">{formatCurrency(bid.infraconFees)}</td>
      <td className="p-3 text-center">
        <Select
          value={bid.status}
          onValueChange={(v) => onUpdate({ id: bid.id, payload: { status: v as TenderBidStatus } })}
        >
          <SelectTrigger className="h-7 w-[130px] mx-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALLOTTED">Allotted</SelectItem>
            <SelectItem value="NOT_ALLOTTED">Not Allotted</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className="p-3 text-center">
        {bid.status === "ALLOTTED" ? (
          <Badge variant="secondary" className="text-[10px]">LOA Letter</Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">EMD Return</Badge>
        )}
      </td>
      <td className="p-3 text-right">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-destructive"
          onClick={() => {
            if (window.confirm("Delete this bid?")) onDelete(bid.id);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}
