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
import { WORK_CATEGORY_OPTIONS, CLIENT_OPTIONS, SECURITY_DEPOSIT_TYPE_OPTIONS, EMD_TYPE_OPTIONS } from "@/lib/domain";
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
  const [bidderFilter, setBidderFilter] = useState("ALL");
  const [authorityFilter, setAuthorityFilter] = useState("ALL");
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedBid, setSelectedBid] = useState<TenderBidItem | null>(null);

  const emptyBid = {
    nameOfWork: "",
    nameOfBidder: "",
    bidInvitingAuthority: "",
    tenderId: "",
    projectLengthKm: 0,
    workCategory: "",
    client: "",
    state: "",
    emd: 0,
    emdType: "",
    emdBank: "",
    emdIssuedDate: "" as string,
    emdNumber: "",
    emdValidUpto: "" as string,
    tenderFees: 0,
    infraconFees: 0,
    status: "NOT_ALLOTTED" as TenderBidStatus,
    remarks: "",
  };
  const [newBid, setNewBid] = useState(emptyBid);

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
      setNewBid(emptyBid);
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

  const uniqueBidders = useMemo(() => [...new Set(items.map((b) => b.nameOfBidder).filter(Boolean))].sort(), [items]);
  const uniqueAuthorities = useMemo(() => [...new Set(items.map((b) => b.bidInvitingAuthority).filter(Boolean))].sort(), [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((bid) => {
      if (tab === "precontract" && bid.status !== "ALLOTTED") return false;
      if (tab === "bids") {
        if (workCategoryFilter !== "ALL" && bid.workCategory !== workCategoryFilter) return false;
        if (clientFilter !== "ALL" && bid.client !== clientFilter) return false;
        if (statusFilter !== "ALL" && bid.status !== statusFilter) return false;
        if (stateFilter !== "ALL" && bid.state !== stateFilter) return false;
        if (bidderFilter !== "ALL" && bid.nameOfBidder !== bidderFilter) return false;
        if (authorityFilter !== "ALL" && bid.bidInvitingAuthority !== authorityFilter) return false;
      }
      if (!q) return true;
      return [bid.nameOfWork, bid.workCategory, bid.client, bid.state, bid.nameOfBidder, bid.bidInvitingAuthority].join(" ").toLowerCase().includes(q);
    });
  }, [items, search, workCategoryFilter, clientFilter, statusFilter, stateFilter, bidderFilter, authorityFilter, tab]);

  const clearFilters = () => {
    setSearch("");
    setWorkCategoryFilter("ALL");
    setClientFilter("ALL");
    setStatusFilter("ALL");
    setStateFilter("ALL");
    setBidderFilter("ALL");
    setAuthorityFilter("ALL");
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="text-xs text-muted-foreground mb-1.5 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Name of work, client, state, bidder..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Bid Inviting Authority</label>
                <Select value={authorityFilter} onValueChange={setAuthorityFilter}>
                  <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    {uniqueAuthorities.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
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
                <label className="text-xs text-muted-foreground mb-1.5 block">Bidder</label>
                <Select value={bidderFilter} onValueChange={setBidderFilter}>
                  <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    {uniqueBidders.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
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

          {/* Add Bid Modal */}
          {showAddForm && (
            <AddBidModal
              newBid={newBid}
              setNewBid={setNewBid}
              isPending={createMutation.isPending}
              onSave={() => createMutation.mutate(newBid)}
              onClose={() => setShowAddForm(false)}
            />
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
                <table className="w-full text-sm min-w-[1600px]">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border/30">
                      <th className="text-left font-medium p-3 w-12">Sr</th>
                      <th className="text-left font-medium p-3">Name of Work</th>
                      <th className="text-left font-medium p-3">Bidder</th>
                      <th className="text-left font-medium p-3">Bid Inviting Authority</th>
                      <th className="text-left font-medium p-3">Tender ID</th>
                      <th className="text-right font-medium p-3">Length (Km)</th>
                      <th className="text-left font-medium p-3 w-16">W.C.</th>
                      <th className="text-left font-medium p-3">Client</th>
                      <th className="text-left font-medium p-3">State / Region</th>
                      <th className="text-left font-medium p-3">Type of EMD</th>
                      <th className="text-right font-medium p-3">EMD Amt</th>
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
                        <td className="p-3">{bid.nameOfWork}</td>
                        <td className="p-3">{bid.nameOfBidder || "—"}</td>
                        <td className="p-3">{bid.bidInvitingAuthority || "—"}</td>
                        <td className="p-3 text-xs font-mono whitespace-nowrap">{bid.tenderId || "—"}</td>
                        <td className="p-3 text-right tabular-nums whitespace-nowrap">{bid.projectLengthKm || "—"}</td>
                        <td className="p-3 font-mono text-xs whitespace-nowrap">{bid.workCategory}</td>
                        <td className="p-3 whitespace-nowrap">{bid.client}</td>
                        <td className="p-3 whitespace-nowrap">{bid.state || "Not Selected"}</td>
                        <td className="p-3 text-xs whitespace-nowrap">{bid.emdType || "—"}</td>
                        <td className="p-3 text-right tabular-nums whitespace-nowrap">{formatCurrency(bid.emd)}</td>
                        <td className="p-3 text-right tabular-nums whitespace-nowrap">{formatCurrency(bid.tenderFees)}</td>
                        <td className="p-3 text-right tabular-nums whitespace-nowrap">{formatCurrency(bid.infraconFees)}</td>
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
        <PreContractSection allottedBids={items.filter((b) => b.status === "ALLOTTED")} />
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
                ["Name of Bidder", selectedBid.nameOfBidder],
                ["Bid Inviting Authority", selectedBid.bidInvitingAuthority],
                ["Tender ID", selectedBid.tenderId],
                ["Project Length (Km)", selectedBid.projectLengthKm ? String(selectedBid.projectLengthKm) : ""],
                ["Work Category", `${selectedBid.workCategory} — ${WORK_CATEGORY_OPTIONS.find((o) => o.code === selectedBid.workCategory)?.label ?? ""}`],
                ["Client", selectedBid.client],
                ["State / Region", selectedBid.state || "Not Selected"],
                ["Type of EMD", selectedBid.emdType],
                ["EMD Amount", formatCurrency(selectedBid.emd)],
                ["EMD Bank", selectedBid.emdBank],
                ["EMD Issued Date", formatDate(selectedBid.emdIssuedDate)],
                ["EMD No.", selectedBid.emdNumber],
                ["EMD Valid Upto", formatDate(selectedBid.emdValidUpto)],
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
              {selectedBid.emdLetterUrl && (
                <div className="rounded-xl border border-border/40 bg-secondary/20 px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">EMD Attachment</p>
                  <a href={`${API_BASE.replace("/api", "")}${selectedBid.emdLetterUrl}`} target="_blank" rel="noreferrer" className="mt-0.5 text-primary underline inline-flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" /> View
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}

/* ─── Pre-Contract Section (table view like bids) ─── */

function PreContractSection({ allottedBids }: { allottedBids: TenderBidItem[] }) {
  const queryClient = useQueryClient();
  const [pcSearch, setPcSearch] = useState("");
  const [pcWcFilter, setPcWcFilter] = useState("ALL");
  const [pcClientFilter, setPcClientFilter] = useState("ALL");
  const [pcStateFilter, setPcStateFilter] = useState("ALL");
  const [pcBidderFilter, setPcBidderFilter] = useState("ALL");
  const [pcAuthorityFilter, setPcAuthorityFilter] = useState("ALL");
  const [selectedPcBid, setSelectedPcBid] = useState<TenderBidItem | null>(null);

  const { data: preContractData } = useQuery({
    queryKey: ["pre-contract-activities"],
    queryFn: () => api.getPreContractActivities({ page: 1, limit: 500 }),
    staleTime: 2 * 60 * 1000,
  });

  const preContractMap = useMemo(() => {
    const map = new Map<string, PreContractActivityItem>();
    for (const pc of preContractData?.items ?? []) {
      if (pc.tenderBidId) map.set(pc.tenderBidId, pc);
    }
    return map;
  }, [preContractData]);

  const pcBidders = useMemo(() => [...new Set(allottedBids.map((b) => b.nameOfBidder).filter(Boolean))].sort(), [allottedBids]);
  const pcAuthorities = useMemo(() => [...new Set(allottedBids.map((b) => b.bidInvitingAuthority).filter(Boolean))].sort(), [allottedBids]);

  const filtered = useMemo(() => {
    const q = pcSearch.trim().toLowerCase();
    return allottedBids.filter((bid) => {
      if (pcWcFilter !== "ALL" && bid.workCategory !== pcWcFilter) return false;
      if (pcClientFilter !== "ALL" && bid.client !== pcClientFilter) return false;
      if (pcStateFilter !== "ALL" && bid.state !== pcStateFilter) return false;
      if (pcBidderFilter !== "ALL" && bid.nameOfBidder !== pcBidderFilter) return false;
      if (pcAuthorityFilter !== "ALL" && bid.bidInvitingAuthority !== pcAuthorityFilter) return false;
      if (!q) return true;
      return [bid.nameOfWork, bid.workCategory, bid.client, bid.state, bid.nameOfBidder, bid.bidInvitingAuthority].join(" ").toLowerCase().includes(q);
    });
  }, [allottedBids, pcSearch, pcWcFilter, pcClientFilter, pcStateFilter, pcBidderFilter, pcAuthorityFilter]);

  const clearPcFilters = () => { setPcSearch(""); setPcWcFilter("ALL"); setPcClientFilter("ALL"); setPcStateFilter("ALL"); setPcBidderFilter("ALL"); setPcAuthorityFilter("ALL"); };

  if (allottedBids.length === 0) {
    return <div className="glass-panel p-10 text-center text-muted-foreground">No allotted tenders yet. Change a bid&apos;s status to &quot;Allotted&quot; to see it here.</div>;
  }

  return (
    <>
      {/* Filters */}
      <div className="glass-panel p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="text-xs text-muted-foreground mb-1.5 block">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Name of work, client, state, bidder..." value={pcSearch} onChange={(e) => setPcSearch(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Bid Inviting Authority</label>
            <Select value={pcAuthorityFilter} onValueChange={setPcAuthorityFilter}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {pcAuthorities.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Work Category</label>
            <Select value={pcWcFilter} onValueChange={setPcWcFilter}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {WORK_CATEGORY_OPTIONS.map((o) => <SelectItem key={o.code} value={o.code}>{o.code} — {o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Client</label>
            <Select value={pcClientFilter} onValueChange={setPcClientFilter}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {CLIENT_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Bidder</label>
            <Select value={pcBidderFilter} onValueChange={setPcBidderFilter}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {pcBidders.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">State / Region</label>
            <Select value={pcStateFilter} onValueChange={setPcStateFilter}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {ALL_LOCATIONS.map((loc) => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" className="gap-1" onClick={clearPcFilters}>
            <X className="h-3.5 w-3.5" /> Clear filters
          </Button>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="glass-panel p-10 text-center text-muted-foreground">No allotted bids match the filters.</div>
      ) : (
        <div className="glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1600px]">
              <thead>
                <tr className="text-muted-foreground border-b border-border/30">
                  <th className="text-left font-medium p-3 w-12">Sr</th>
                  <th className="text-left font-medium p-3">Name of Work</th>
                  <th className="text-left font-medium p-3">Bidder</th>
                  <th className="text-left font-medium p-3">Bid Inviting Authority</th>
                  <th className="text-left font-medium p-3">Tender ID</th>
                  <th className="text-right font-medium p-3">Length (Km)</th>
                  <th className="text-left font-medium p-3 w-16">W.C.</th>
                  <th className="text-left font-medium p-3">Client</th>
                  <th className="text-left font-medium p-3">State / Region</th>
                  <th className="text-left font-medium p-3">Type of EMD</th>
                  <th className="text-right font-medium p-3">EMD Amt</th>
                  <th className="text-right font-medium p-3">Tender Fees</th>
                  <th className="text-right font-medium p-3">Infracon Fees</th>
                  <th className="text-center font-medium p-3">Pre-Contract</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((bid) => {
                  const hasPC = preContractMap.has(bid.id);
                  return (
                    <tr
                      key={bid.id}
                      className="border-b border-border/20 hover:bg-secondary/20 cursor-pointer"
                      onClick={() => setSelectedPcBid(bid)}
                    >
                      <td className="p-3 font-medium tabular-nums">{bid.srNo}</td>
                      <td className="p-3">{bid.nameOfWork}</td>
                      <td className="p-3">{bid.nameOfBidder || "—"}</td>
                      <td className="p-3">{bid.bidInvitingAuthority || "—"}</td>
                      <td className="p-3 text-xs font-mono whitespace-nowrap">{bid.tenderId || "—"}</td>
                      <td className="p-3 text-right tabular-nums whitespace-nowrap">{bid.projectLengthKm || "—"}</td>
                      <td className="p-3 font-mono text-xs whitespace-nowrap">{bid.workCategory}</td>
                      <td className="p-3 whitespace-nowrap">{bid.client}</td>
                      <td className="p-3 whitespace-nowrap">{bid.state || "Not Selected"}</td>
                      <td className="p-3 text-xs whitespace-nowrap">{bid.emdType || "—"}</td>
                      <td className="p-3 text-right tabular-nums whitespace-nowrap">{formatCurrency(bid.emd)}</td>
                      <td className="p-3 text-right tabular-nums whitespace-nowrap">{formatCurrency(bid.tenderFees)}</td>
                      <td className="p-3 text-right tabular-nums whitespace-nowrap">{formatCurrency(bid.infraconFees)}</td>
                      <td className="p-3 text-center">
                        <Badge variant={hasPC ? "secondary" : "outline"} className="text-[10px]">
                          {hasPC ? "Active" : "Not Created"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pre-Contract Detail Modal */}
      {selectedPcBid && (
        <PreContractDetailModal
          bid={selectedPcBid}
          preContract={preContractMap.get(selectedPcBid.id) ?? null}
          onClose={() => setSelectedPcBid(null)}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ["pre-contract-activities"] })}
        />
      )}
    </>
  );
}

/* ─── Pre-Contract Detail Modal ─── */

function PreContractDetailModal({
  bid,
  preContract,
  onClose,
  onRefresh,
}: {
  bid: TenderBidItem;
  preContract: PreContractActivityItem | null;
  onClose: () => void;
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

  const updateBidMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.updateTenderBid(bid.id, payload as Partial<TenderBidItem>),
    onSuccess: () => {
      toast.success("Tender bid updated");
      queryClient.invalidateQueries({ queryKey: ["tender-bids"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const onBidUpdate = (field: string, value: unknown) => updateBidMutation.mutate({ [field]: value });
  const wcLabel = WORK_CATEGORY_OPTIONS.find((o) => o.code === bid.workCategory)?.label ?? bid.workCategory;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-5xl rounded-2xl border border-border bg-card shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border/40 px-5 py-4 flex items-center justify-between gap-3 z-10">
          <div>
            <p className="font-semibold">Pre-Contract Details</p>
            <p className="text-xs text-muted-foreground">Sr #{bid.srNo} · {wcLabel} ({bid.workCategory}) · {bid.client} · {bid.state || "No State"}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="p-5 space-y-4">
          {/* Tender Bid Details — Editable */}
          <div className="rounded-xl border border-border/40 bg-secondary/10 p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">Tender Bid Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="sm:col-span-2 lg:col-span-4">
                <label className="text-xs text-muted-foreground mb-1 block">Name of Work</label>
                <Input defaultValue={bid.nameOfWork} onBlur={(e) => { if (e.target.value !== bid.nameOfWork) onBidUpdate("nameOfWork", e.target.value); }} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Name of Bidder</label>
                <Input defaultValue={bid.nameOfBidder} onBlur={(e) => { if (e.target.value !== bid.nameOfBidder) onBidUpdate("nameOfBidder", e.target.value); }} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Bid Inviting Authority</label>
                <Input defaultValue={bid.bidInvitingAuthority} onBlur={(e) => { if (e.target.value !== bid.bidInvitingAuthority) onBidUpdate("bidInvitingAuthority", e.target.value); }} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Tender ID</label>
                <Input defaultValue={bid.tenderId} onBlur={(e) => { if (e.target.value !== bid.tenderId) onBidUpdate("tenderId", e.target.value); }} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Project Length (Km)</label>
                <Input type="number" defaultValue={bid.projectLengthKm || ""} onBlur={(e) => { const v = Number(e.target.value); if (v !== bid.projectLengthKm) onBidUpdate("projectLengthKm", v); }} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Work Category</label>
                <Select value={bid.workCategory} onValueChange={(v) => onBidUpdate("workCategory", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{WORK_CATEGORY_OPTIONS.map((o) => <SelectItem key={o.code} value={o.code}>{o.code} — {o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Client</label>
                <Select value={bid.client} onValueChange={(v) => onBidUpdate("client", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CLIENT_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">State / Region</label>
                <LocationCombobox value={bid.state} onValueChange={(v) => onBidUpdate("state", v)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">EMD Amount</label>
                <Input type="number" defaultValue={bid.emd || ""} onBlur={(e) => { const v = Number(e.target.value); if (v !== bid.emd) onBidUpdate("emd", v); }} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Type of EMD</label>
                <Select value={bid.emdType || "NONE"} onValueChange={(v) => onBidUpdate("emdType", v === "NONE" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent><SelectItem value="NONE">None</SelectItem>{EMD_TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">EMD Bank</label>
                <Input defaultValue={bid.emdBank} onBlur={(e) => { if (e.target.value !== bid.emdBank) onBidUpdate("emdBank", e.target.value); }} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">EMD Issued Date</label>
                <Input type="date" defaultValue={bid.emdIssuedDate ? new Date(bid.emdIssuedDate).toISOString().split("T")[0] : ""} onChange={(e) => onBidUpdate("emdIssuedDate", e.target.value || null)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">EMD No.</label>
                <Input defaultValue={bid.emdNumber} onBlur={(e) => { if (e.target.value !== bid.emdNumber) onBidUpdate("emdNumber", e.target.value); }} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">EMD Valid Upto</label>
                <Input type="date" defaultValue={bid.emdValidUpto ? new Date(bid.emdValidUpto).toISOString().split("T")[0] : ""} onChange={(e) => onBidUpdate("emdValidUpto", e.target.value || null)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Tender Fees</label>
                <Input type="number" defaultValue={bid.tenderFees || ""} onBlur={(e) => { const v = Number(e.target.value); if (v !== bid.tenderFees) onBidUpdate("tenderFees", v); }} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Infracon Fees</label>
                <Input type="number" defaultValue={bid.infraconFees || ""} onBlur={(e) => { const v = Number(e.target.value); if (v !== bid.infraconFees) onBidUpdate("infraconFees", v); }} />
              </div>
            </div>
          </div>

          {/* Pre-Contract Activity Form */}
          {!preContract ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground text-sm mb-3">No pre-contract activity linked to this tender yet.</p>
              <Button size="sm" className="gap-1.5" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
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
      </div>
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

/* ─── Add Bid Modal ─── */

function AddBidModal({
  newBid,
  setNewBid,
  isPending,
  onSave,
  onClose,
}: {
  newBid: Record<string, unknown>;
  setNewBid: (bid: Record<string, unknown>) => void;
  isPending: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const emdFileRef = useRef<HTMLInputElement>(null);
  const [emdUploading, setEmdUploading] = useState(false);

  const handleEmdUpload = useCallback(async (file: File) => {
    setEmdUploading(true);
    try {
      const result = await api.uploadFile(file);
      setNewBid({ ...newBid, emdLetterUrl: result.url });
      toast.success("EMD attachment uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      setEmdUploading(false);
    }
  }, [newBid, setNewBid]);

  const set = (field: string, value: unknown) => setNewBid({ ...newBid, [field]: value });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-3xl rounded-2xl border border-border bg-card shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border/40 px-5 py-4 flex items-center justify-between gap-3 z-10">
          <p className="font-semibold">New Tender Bid</p>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="text-xs text-muted-foreground mb-1 block">Name of Work *</label>
              <Input value={newBid.nameOfWork as string} onChange={(e) => set("nameOfWork", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Name of Bidder</label>
              <Input value={newBid.nameOfBidder as string} onChange={(e) => set("nameOfBidder", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Name & Address of Bid Inviting Authority</label>
              <Input value={newBid.bidInvitingAuthority as string} onChange={(e) => set("bidInvitingAuthority", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tender ID</label>
              <Input value={newBid.tenderId as string} onChange={(e) => set("tenderId", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Project Length (Km)</label>
              <Input type="number" value={(newBid.projectLengthKm as number) || ""} onChange={(e) => set("projectLengthKm", Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Work Category *</label>
              <Select value={newBid.workCategory as string} onValueChange={(v) => set("workCategory", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {WORK_CATEGORY_OPTIONS.map((o) => <SelectItem key={o.code} value={o.code}>{o.code} — {o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Client *</label>
              <Select value={newBid.client as string} onValueChange={(v) => set("client", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {CLIENT_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">State / Region *</label>
              <LocationCombobox value={newBid.state as string} onValueChange={(v) => set("state", v)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">EMD Amount</label>
              <Input type="number" value={(newBid.emd as number) || ""} onChange={(e) => set("emd", Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Type of EMD</label>
              <div className="flex items-center gap-1.5">
                <Select value={(newBid.emdType as string) || "NONE"} onValueChange={(v) => set("emdType", v === "NONE" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    {EMD_TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                <input
                  ref={emdFileRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleEmdUpload(f); e.target.value = ""; }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant={(newBid.emdLetterUrl as string) ? "default" : "outline"}
                  className="h-9 w-9 p-0 shrink-0"
                  title={(newBid.emdLetterUrl as string) ? "EMD uploaded — click to replace" : "Upload EMD attachment"}
                  disabled={emdUploading}
                  onClick={() => emdFileRef.current?.click()}
                >
                  {emdUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                </Button>
              </div>
              {(newBid.emdLetterUrl as string) && (
                <p className="text-[10px] text-emerald-600 mt-0.5 flex items-center gap-1">
                  <Paperclip className="h-3 w-3" /> EMD attachment uploaded
                </p>
              )}
            </div>
            {(newBid.emdType as string) && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">EMD Bank</label>
                  <Input value={newBid.emdBank as string} onChange={(e) => set("emdBank", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">EMD Issued Date</label>
                  <Input type="date" value={newBid.emdIssuedDate as string} onChange={(e) => set("emdIssuedDate", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">EMD No.</label>
                  <Input value={newBid.emdNumber as string} onChange={(e) => set("emdNumber", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">EMD Valid Upto</label>
                  <Input type="date" value={newBid.emdValidUpto as string} onChange={(e) => set("emdValidUpto", e.target.value)} />
                </div>
              </>
            )}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tender Fees</label>
              <Input type="number" value={(newBid.tenderFees as number) || ""} onChange={(e) => set("tenderFees", Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Infracon Fees</label>
              <Input type="number" value={(newBid.infraconFees as number) || ""} onChange={(e) => set("infraconFees", Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
              <Select value={newBid.status as string} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALLOTTED">Allotted</SelectItem>
                  <SelectItem value="NOT_ALLOTTED">Not Allotted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 bg-card border-t border-border/40 px-5 py-3 flex gap-2 justify-end">
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            disabled={!(newBid.nameOfWork as string) || !(newBid.workCategory as string) || !(newBid.client as string) || !(newBid.state as string) || isPending}
            onClick={onSave}
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Attachment-only upload (no date field) ─── */

function AttachmentUpload({
  label,
  urlValue,
  onUrlChange,
}: {
  label: string;
  urlValue?: string | null;
  onUrlChange: (url: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const result = await api.uploadFile(file);
      onUrlChange(result.url);
      toast.success(`${label} uploaded`);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }, [label, onUrlChange]);

  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
      />
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant={urlValue ? "default" : "outline"}
          className="h-9 gap-1.5"
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
            <><ExternalLink className="h-4 w-4" /> View</>
          ) : (
            <><Paperclip className="h-4 w-4" /> Upload</>
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
          <Paperclip className="h-3 w-3" /> Uploaded
        </p>
      )}
    </div>
  );
}

/* ─── Pre-Contract Form ─── */

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

      {preContract.securityDepositType && (
        <div className="col-span-1 sm:col-span-2 lg:col-span-3 rounded-xl border border-border/40 bg-secondary/10 p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">
            Details of Security Deposit — {SECURITY_DEPOSIT_TYPE_OPTIONS.find((o) => o.value === preContract.securityDepositType)?.label}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Bank</label>
              <Input
                defaultValue={preContract.sdBank}
                onBlur={(e) => { if (e.target.value !== preContract.sdBank) onUpdate("sdBank", e.target.value); }}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Issued Date</label>
              <Input
                type="date"
                defaultValue={preContract.sdIssuedDate ? new Date(preContract.sdIssuedDate).toISOString().split("T")[0] : ""}
                onChange={(e) => onUpdate("sdIssuedDate", e.target.value || null)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">No.</label>
              <Input
                defaultValue={preContract.sdNumber}
                onBlur={(e) => { if (e.target.value !== preContract.sdNumber) onUpdate("sdNumber", e.target.value); }}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Amount</label>
              <Input
                type="number"
                defaultValue={preContract.sdAmount || ""}
                onBlur={(e) => { const v = Number(e.target.value); if (v !== preContract.sdAmount) onUpdate("sdAmount", v); }}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Date of Exp.</label>
              <Input
                type="date"
                defaultValue={preContract.sdExpiryDate ? new Date(preContract.sdExpiryDate).toISOString().split("T")[0] : ""}
                onChange={(e) => onUpdate("sdExpiryDate", e.target.value || null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Additional Security Deposit */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Type of Additional Performance Security Deposit</label>
        <Select
          value={preContract.additionalSdType ?? "NONE"}
          onValueChange={(v) => onUpdate("additionalSdType", v === "NONE" ? null : v)}
        >
          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="NONE">None</SelectItem>
            {SECURITY_DEPOSIT_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {preContract.additionalSdType && (
        <div className="col-span-1 sm:col-span-2 lg:col-span-3 rounded-xl border border-border/40 bg-secondary/10 p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">
            Details of Additional Security Deposit — {SECURITY_DEPOSIT_TYPE_OPTIONS.find((o) => o.value === preContract.additionalSdType)?.label}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Bank</label>
              <Input defaultValue={preContract.additionalSdBank} onBlur={(e) => { if (e.target.value !== preContract.additionalSdBank) onUpdate("additionalSdBank", e.target.value); }} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Issued Date</label>
              <Input type="date" defaultValue={preContract.additionalSdIssuedDate ? new Date(preContract.additionalSdIssuedDate).toISOString().split("T")[0] : ""} onChange={(e) => onUpdate("additionalSdIssuedDate", e.target.value || null)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">No.</label>
              <Input defaultValue={preContract.additionalSdNumber} onBlur={(e) => { if (e.target.value !== preContract.additionalSdNumber) onUpdate("additionalSdNumber", e.target.value); }} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Amount</label>
              <Input type="number" defaultValue={preContract.additionalSdAmount || ""} onBlur={(e) => { const v = Number(e.target.value); if (v !== preContract.additionalSdAmount) onUpdate("additionalSdAmount", v); }} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Date of Exp.</label>
              <Input type="date" defaultValue={preContract.additionalSdExpiryDate ? new Date(preContract.additionalSdExpiryDate).toISOString().split("T")[0] : ""} onChange={(e) => onUpdate("additionalSdExpiryDate", e.target.value || null)} />
            </div>
          </div>
        </div>
      )}

      {/* Signing Agreement */}
      <DateWithAttachment
        label="Signing the Tender Agreement"
        dateValue={preContract.signingAgreementDate}
        urlValue={preContract.signingAgreementLetterUrl}
        onDateChange={(val) => onUpdate("signingAgreementDate", val)}
        onUrlChange={(url) => onUpdate("signingAgreementLetterUrl", url)}
      />

      {/* Proceeding / Work Order */}
      <DateWithAttachment
        label="Letter for Proceeding / Work Order"
        dateValue={preContract.proceedingOrderDate}
        urlValue={preContract.proceedingOrderLetterUrl}
        onDateChange={(val) => onUpdate("proceedingOrderDate", val)}
        onUrlChange={(url) => onUpdate("proceedingOrderLetterUrl", url)}
      />

      {/* PI/PL Insurance Policy Details */}
      <div className="col-span-1 sm:col-span-2 lg:col-span-3 rounded-xl border border-border/40 bg-secondary/10 p-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">PI/PL Insurance Policy Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Policy No.</label>
            <Input defaultValue={preContract.piPlPolicyNo} onBlur={(e) => { if (e.target.value !== preContract.piPlPolicyNo) onUpdate("piPlPolicyNo", e.target.value); }} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Date</label>
            <Input type="date" defaultValue={preContract.piPlPolicyDate ? new Date(preContract.piPlPolicyDate).toISOString().split("T")[0] : ""} onChange={(e) => onUpdate("piPlPolicyDate", e.target.value || null)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Amount</label>
            <Input type="number" defaultValue={preContract.piPlPolicyAmount || ""} onBlur={(e) => { const v = Number(e.target.value); if (v !== preContract.piPlPolicyAmount) onUpdate("piPlPolicyAmount", v); }} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Date of Issue</label>
            <Input type="date" defaultValue={preContract.piPlPolicyIssueDate ? new Date(preContract.piPlPolicyIssueDate).toISOString().split("T")[0] : ""} onChange={(e) => onUpdate("piPlPolicyIssueDate", e.target.value || null)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Date of Expiry</label>
            <Input type="date" defaultValue={preContract.piPlPolicyExpiryDate ? new Date(preContract.piPlPolicyExpiryDate).toISOString().split("T")[0] : ""} onChange={(e) => onUpdate("piPlPolicyExpiryDate", e.target.value || null)} />
          </div>
          <AttachmentUpload
            label="Policy Attachment"
            urlValue={preContract.piPlPolicyLetterUrl}
            onUrlChange={(url) => onUpdate("piPlPolicyLetterUrl", url)}
          />
        </div>
      </div>

      {/* WC Insurance Policy Details */}
      <div className="col-span-1 sm:col-span-2 lg:col-span-3 rounded-xl border border-border/40 bg-secondary/10 p-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">WC Insurance Policy Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Policy No.</label>
            <Input defaultValue={preContract.wcPolicyNo} onBlur={(e) => { if (e.target.value !== preContract.wcPolicyNo) onUpdate("wcPolicyNo", e.target.value); }} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Date</label>
            <Input type="date" defaultValue={preContract.wcPolicyDate ? new Date(preContract.wcPolicyDate).toISOString().split("T")[0] : ""} onChange={(e) => onUpdate("wcPolicyDate", e.target.value || null)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Amount</label>
            <Input type="number" defaultValue={preContract.wcPolicyAmount || ""} onBlur={(e) => { const v = Number(e.target.value); if (v !== preContract.wcPolicyAmount) onUpdate("wcPolicyAmount", v); }} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Date of Issue</label>
            <Input type="date" defaultValue={preContract.wcPolicyIssueDate ? new Date(preContract.wcPolicyIssueDate).toISOString().split("T")[0] : ""} onChange={(e) => onUpdate("wcPolicyIssueDate", e.target.value || null)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Date of Expiry</label>
            <Input type="date" defaultValue={preContract.wcPolicyExpiryDate ? new Date(preContract.wcPolicyExpiryDate).toISOString().split("T")[0] : ""} onChange={(e) => onUpdate("wcPolicyExpiryDate", e.target.value || null)} />
          </div>
          <AttachmentUpload
            label="Policy Attachment"
            urlValue={preContract.wcPolicyLetterUrl}
            onUrlChange={(url) => onUpdate("wcPolicyLetterUrl", url)}
          />
        </div>
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
