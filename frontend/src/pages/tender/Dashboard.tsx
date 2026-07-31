import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageWrapper } from "@/components/PageWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LocationCombobox } from "@/components/LocationCombobox";
import { api } from "@/lib/api";
import type { TenderBidItem, TenderBidStatus, PreContractActivityItem, SecurityDepositType } from "@/lib/domain";
import { WORK_CATEGORY_OPTIONS, CLIENT_OPTIONS, SECURITY_DEPOSIT_TYPE_OPTIONS } from "@/lib/domain";
import { ALL_LOCATIONS } from "@/constants/locationOptions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye, FileText, Gavel, Loader2, Plus, RefreshCcw, Search, Trash2, X,
  Paperclip, ExternalLink, Upload, Cog,
} from "lucide-react";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

function formatCurrency(value: number) {
  if (!value) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN");
}

type Tab = "bids" | "precontract";

export default function TenderDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("bids");
  const [search, setSearch] = useState("");
  const [workCategoryFilter, setWorkCategoryFilter] = useState("ALL");
  const [clientFilter, setClientFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<TenderBidStatus | "ALL">("ALL");
  const [stateFilter, setStateFilter] = useState("ALL");
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedBid, setSelectedBid] = useState<TenderBidItem | null>(null);

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
      if (tab === "precontract" && bid.status !== "ALLOTTED") return false;
      if (tab === "bids") {
        if (workCategoryFilter !== "ALL" && bid.workCategory !== workCategoryFilter) return false;
        if (clientFilter !== "ALL" && bid.client !== clientFilter) return false;
        if (statusFilter !== "ALL" && bid.status !== statusFilter) return false;
        if (stateFilter !== "ALL" && bid.state !== stateFilter) return false;
      }
      if (!q) return true;
      return [bid.nameOfWork, bid.workCategory, bid.client, bid.state].join(" ").toLowerCase().includes(q);
    });
  }, [items, search, workCategoryFilter, clientFilter, statusFilter, stateFilter, tab]);

  const clearFilters = () => {
    setSearch("");
    setWorkCategoryFilter("ALL");
    setClientFilter("ALL");
    setStatusFilter("ALL");
    setStateFilter("ALL");
  };

  const allottedCount = useMemo(() => items.filter((b) => b.status === "ALLOTTED").length, [items]);

  return (
    <PageWrapper>
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title inline-flex items-center gap-2">
            <Gavel className="h-6 w-6" /> Tender Management
          </h1>
          <p className="page-subtitle">Manage tender bids, track status, and handle pre-contract activities.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="rounded-full">{filtered.length} item(s)</Badge>
          <Button size="sm" variant="outline" className="gap-1" disabled={isFetching} onClick={() => refetch()}>
            {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
          {tab === "bids" && (
            <Button size="sm" className="gap-1" onClick={() => setShowAddForm(!showAddForm)}>
              <Plus className="h-3.5 w-3.5" /> Add Bid
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-secondary/40 rounded-lg w-fit">
        <button
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "bids" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setTab("bids")}
        >
          <span className="inline-flex items-center gap-1.5">
            <Gavel className="h-4 w-4" /> Submitted Bids
          </span>
        </button>
        <button
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "precontract" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setTab("precontract")}
        >
          <span className="inline-flex items-center gap-1.5">
            <Cog className="h-4 w-4" /> Pre-Contract
            {allottedCount > 0 && <Badge variant="secondary" className="rounded-full text-[10px] px-1.5 py-0">{allottedCount}</Badge>}
          </span>
        </button>
      </div>

      {/* Bids Tab */}
      {tab === "bids" && (
        <>
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
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">State / Region</label>
                <Select value={stateFilter} onValueChange={setStateFilter}>
                  <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    {ALL_LOCATIONS.map((loc) => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
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
                  <label className="text-xs text-muted-foreground mb-1 block">State / Region *</label>
                  <LocationCombobox value={newBid.state} onValueChange={(v) => setNewBid({ ...newBid, state: v })} />
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
                  disabled={!newBid.nameOfWork || !newBid.workCategory || !newBid.client || !newBid.state || createMutation.isPending}
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
                      <th className="text-left font-medium p-3">State / Region</th>
                      <th className="text-right font-medium p-3">EMD</th>
                      <th className="text-right font-medium p-3">Tender Fees</th>
                      <th className="text-right font-medium p-3">Infracon Fees</th>
                      <th className="text-center font-medium p-3">Status</th>
                      <th className="text-center font-medium p-3">Letter</th>
                      <th className="text-right font-medium p-3 w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((bid) => (
                      <tr
                        key={bid.id}
                        className="border-b border-border/20 hover:bg-secondary/20 cursor-pointer"
                        onClick={() => setSelectedBid(bid)}
                      >
                        <td className="p-3 font-medium tabular-nums">{bid.srNo}</td>
                        <td className="p-3 max-w-[260px]">
                          <span className="line-clamp-2">{bid.nameOfWork}</span>
                        </td>
                        <td className="p-3 font-mono text-xs">{bid.workCategory}</td>
                        <td className="p-3">{bid.client}</td>
                        <td className="p-3">{bid.state || "Not Selected"}</td>
                        <td className="p-3 text-right tabular-nums">{formatCurrency(bid.emd)}</td>
                        <td className="p-3 text-right tabular-nums">{formatCurrency(bid.tenderFees)}</td>
                        <td className="p-3 text-right tabular-nums">{formatCurrency(bid.infraconFees)}</td>
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={bid.status}
                            onValueChange={(v) => updateMutation.mutate({ id: bid.id, payload: { status: v as TenderBidStatus } })}
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
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 text-xs"
                            onClick={() => navigate(`/tender/letter?id=${bid.id}`)}
                          >
                            <FileText className="h-3 w-3" />
                            Preview
                          </Button>
                        </td>
                        <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 w-7 p-0"
                              onClick={() => setSelectedBid(bid)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive"
                              onClick={() => {
                                if (window.confirm("Delete this bid?")) deleteMutation.mutate(bid.id);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Pre-Contract Tab */}
      {tab === "precontract" && (
        <PreContractSection allottedBids={filtered} />
      )}

      {/* Tender Detail Modal */}
      {selectedBid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-card border-b border-border/40 px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Tender Bid Details</p>
                <p className="text-xs text-muted-foreground">Sr #{selectedBid.srNo}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => {
                    setSelectedBid(null);
                    navigate(`/tender/letter?id=${selectedBid.id}`);
                  }}
                >
                  <FileText className="h-3.5 w-3.5" />
                  {selectedBid.status === "ALLOTTED" ? "LOA Letter" : "EMD Return Letter"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedBid(null)}>
                  Close
                </Button>
              </div>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {([
                ["Sr No", String(selectedBid.srNo)],
                ["Name of Work", selectedBid.nameOfWork],
                ["Work Category", `${selectedBid.workCategory} — ${WORK_CATEGORY_OPTIONS.find((o) => o.code === selectedBid.workCategory)?.label ?? ""}`],
                ["Client", selectedBid.client],
                ["State / Region", selectedBid.state || "Not Selected"],
                ["EMD", formatCurrency(selectedBid.emd)],
                ["Tender Fees", formatCurrency(selectedBid.tenderFees)],
                ["Infracon Fees", formatCurrency(selectedBid.infraconFees)],
                ["Status", selectedBid.status === "ALLOTTED" ? "Allotted" : "Not Allotted"],
                ["Letter Type", selectedBid.status === "ALLOTTED" ? "LOA Request Letter" : "EMD Refund Letter"],
                ["Remarks", selectedBid.remarks],
                ["Created", formatDate(selectedBid.createdAt)],
                ["Updated", formatDate(selectedBid.updatedAt)],
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

/* ─── Pre-Contract Section ─── */

function PreContractSection({ allottedBids }: { allottedBids: TenderBidItem[] }) {
  const queryClient = useQueryClient();
  const [expandedBidId, setExpandedBidId] = useState<string | null>(null);

  const { data: preContractData } = useQuery({
    queryKey: ["pre-contract-activities"],
    queryFn: () => api.getPreContractActivities({ page: 1, limit: 500 }),
    staleTime: 2 * 60 * 1000
  });

  const preContractMap = useMemo(() => {
    const map = new Map<string, PreContractActivityItem>();
    for (const pc of preContractData?.items ?? []) {
      if (pc.tenderBidId) map.set(pc.tenderBidId, pc);
    }
    return map;
  }, [preContractData]);

  if (allottedBids.length === 0) {
    return (
      <div className="glass-panel p-10 text-center text-muted-foreground">
        No allotted tenders yet. Change a bid's status to "Allotted" to see it here.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {allottedBids.map((bid) => (
        <PreContractCard
          key={bid.id}
          bid={bid}
          preContract={preContractMap.get(bid.id) ?? null}
          expanded={expandedBidId === bid.id}
          onToggle={() => setExpandedBidId(expandedBidId === bid.id ? null : bid.id)}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ["pre-contract-activities"] })}
        />
      ))}
    </div>
  );
}

/* ─── Pre-Contract Card per allotted bid ─── */

function PreContractCard({
  bid,
  preContract,
  expanded,
  onToggle,
  onRefresh,
}: {
  bid: TenderBidItem;
  preContract: PreContractActivityItem | null;
  expanded: boolean;
  onToggle: () => void;
  onRefresh: () => void;
}) {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: () =>
      api.createPreContractActivity({
        tenderBidId: bid.id,
        nameOfWork: bid.nameOfWork,
        workCategory: bid.workCategory,
        client: bid.client,
        state: bid.state,
      }),
    onSuccess: () => {
      toast.success("Pre-contract activity created");
      onRefresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      api.updatePreContractActivity(id, payload as Parameters<typeof api.updatePreContractActivity>[1]),
    onSuccess: () => {
      toast.success("Updated");
      queryClient.invalidateQueries({ queryKey: ["pre-contract-activities"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const wcLabel = WORK_CATEGORY_OPTIONS.find((o) => o.code === bid.workCategory)?.label ?? bid.workCategory;

  return (
    <div className="glass-panel overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-secondary/20 transition-colors"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="rounded-full text-[10px]">Sr {bid.srNo}</Badge>
            <Badge className="rounded-full text-[10px] bg-emerald-500/15 text-emerald-600">Allotted</Badge>
            {preContract && <Badge variant="outline" className="rounded-full text-[10px]">Pre-Contract Active</Badge>}
          </div>
          <p className="mt-1 font-medium line-clamp-1">{bid.nameOfWork}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{wcLabel} ({bid.workCategory}) · {bid.client} · {bid.state || "No State"}</p>
        </div>
        <div className="text-muted-foreground">
          <svg className={`h-5 w-5 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-border/30 p-4 space-y-4">
          {!preContract ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground text-sm mb-3">No pre-contract activity linked to this tender yet.</p>
              <Button
                size="sm"
                className="gap-1.5"
                disabled={createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Create Pre-Contract Activity
              </Button>
            </div>
          ) : (
            <PreContractForm
              preContract={preContract}
              onUpdate={(field, value) => updateMutation.mutate({ id: preContract.id, payload: { [field]: value } })}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Pre-Contract Form ─── */

function DateWithAttachment({
  label,
  dateValue,
  urlValue,
  onDateChange,
  onUrlChange,
}: {
  label: string;
  dateValue?: string | null;
  urlValue?: string | null;
  onDateChange: (val: string | null) => void;
  onUrlChange: (url: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const result = await api.uploadFile(file);
      onUrlChange(result.url);
      toast.success(`${label} attachment uploaded`);
    } catch (e) {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }, [label, onUrlChange]);

  const displayDate = dateValue ? new Date(dateValue).toISOString().split("T")[0] : "";

  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          className="flex-1"
          value={displayDate}
          onChange={(e) => onDateChange(e.target.value || null)}
        />
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          size="sm"
          variant={urlValue ? "default" : "outline"}
          className="h-9 w-9 p-0 shrink-0"
          title={urlValue ? "View / Replace attachment" : "Upload attachment"}
          disabled={uploading}
          onClick={() => {
            if (urlValue) {
              window.open(`${API_BASE.replace("/api", "")}${urlValue}`, "_blank");
            } else {
              fileRef.current?.click();
            }
          }}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : urlValue ? (
            <ExternalLink className="h-4 w-4" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
        </Button>
        {urlValue && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 w-9 p-0 shrink-0"
            title="Replace attachment"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
          </Button>
        )}
      </div>
      {urlValue && (
        <p className="text-[10px] text-emerald-600 mt-0.5 flex items-center gap-1">
          <Paperclip className="h-3 w-3" /> Attachment uploaded
        </p>
      )}
    </div>
  );
}

function PreContractForm({
  preContract,
  onUpdate,
}: {
  preContract: PreContractActivityItem;
  onUpdate: (field: string, value: unknown) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Row 1: Award of Project */}
      <DateWithAttachment
        label="Award of Project / LOA Date"
        dateValue={preContract.awardOfProjectDate}
        urlValue={preContract.awardOfProjectLetterUrl}
        onDateChange={(val) => onUpdate("awardOfProjectDate", val)}
        onUrlChange={(url) => onUpdate("awardOfProjectLetterUrl", url)}
      />

      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Security Deposit Type</label>
        <Select
          value={preContract.securityDepositType ?? "NONE"}
          onValueChange={(v) => onUpdate("securityDepositType", v === "NONE" ? null : v)}
        >
          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="NONE">None</SelectItem>
            {SECURITY_DEPOSIT_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1 block">SD Bank</label>
        <Input
          defaultValue={preContract.sdBank}
          onBlur={(e) => { if (e.target.value !== preContract.sdBank) onUpdate("sdBank", e.target.value); }}
        />
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1 block">SD Issued Date</label>
        <Input
          type="date"
          defaultValue={preContract.sdIssuedDate ? new Date(preContract.sdIssuedDate).toISOString().split("T")[0] : ""}
          onChange={(e) => onUpdate("sdIssuedDate", e.target.value || null)}
        />
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1 block">SD Number</label>
        <Input
          defaultValue={preContract.sdNumber}
          onBlur={(e) => { if (e.target.value !== preContract.sdNumber) onUpdate("sdNumber", e.target.value); }}
        />
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1 block">SD Amount</label>
        <Input
          type="number"
          defaultValue={preContract.sdAmount || ""}
          onBlur={(e) => { const v = Number(e.target.value); if (v !== preContract.sdAmount) onUpdate("sdAmount", v); }}
        />
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1 block">SD Expiry Date</label>
        <Input
          type="date"
          defaultValue={preContract.sdExpiryDate ? new Date(preContract.sdExpiryDate).toISOString().split("T")[0] : ""}
          onChange={(e) => onUpdate("sdExpiryDate", e.target.value || null)}
        />
      </div>

      {/* Signing Agreement */}
      <DateWithAttachment
        label="Signing Agreement Date"
        dateValue={preContract.signingAgreementDate}
        urlValue={preContract.signingAgreementLetterUrl}
        onDateChange={(val) => onUpdate("signingAgreementDate", val)}
        onUrlChange={(url) => onUpdate("signingAgreementLetterUrl", url)}
      />

      {/* Proceeding / Work Order */}
      <DateWithAttachment
        label="Proceeding / Work Order Date"
        dateValue={preContract.proceedingOrderDate}
        urlValue={preContract.proceedingOrderLetterUrl}
        onDateChange={(val) => onUpdate("proceedingOrderDate", val)}
        onUrlChange={(url) => onUpdate("proceedingOrderLetterUrl", url)}
      />

      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Insurance Policy</label>
        <Input
          defaultValue={preContract.insurancePolicy}
          placeholder="PL, PI & WC Policy etc."
          onBlur={(e) => { if (e.target.value !== preContract.insurancePolicy) onUpdate("insurancePolicy", e.target.value); }}
        />
      </div>

      <div className="sm:col-span-2">
        <label className="text-xs text-muted-foreground mb-1 block">Remarks</label>
        <Input
          defaultValue={preContract.remarks}
          onBlur={(e) => { if (e.target.value !== preContract.remarks) onUpdate("remarks", e.target.value); }}
        />
      </div>
    </div>
  );
}
