import { useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LocationCombobox } from "@/components/LocationCombobox";
import { api } from "@/lib/api";
import type { ContractActivityItem, SecurityDepositType } from "@/lib/domain";
import { WORK_CATEGORY_OPTIONS, CLIENT_OPTIONS, SECURITY_DEPOSIT_TYPE_OPTIONS } from "@/lib/domain";
import { ALL_LOCATIONS } from "@/constants/locationOptions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Eye, FolderPlus, Loader2, Plus, RefreshCcw, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN");
}

function formatCurrency(value: number) {
  if (!value) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export default function OperationsContract() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [workCategoryFilter, setWorkCategoryFilter] = useState("ALL");
  const [clientFilter, setClientFilter] = useState("ALL");
  const [stateFilter, setStateFilter] = useState("ALL");
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ContractActivityItem | null>(null);

  const [newItem, setNewItem] = useState({
    nameOfWork: "",
    nameOfBidder: "",
    bidInvitingAuthority: "",
    workCategory: "",
    client: "",
    state: "",
    securityDepositType: "" as string,
    sdBank: "",
    sdIssuedDate: "" as string,
    sdNumber: "",
    sdAmount: 0,
    sdExpiryDate: "" as string,
    proceedingOrderDate: "" as string,
    woAmount: 0,
    piPlPolicyNo: "",
    piPlPolicyAmount: 0,
    wcPolicyNo: "",
    wcPolicyAmount: 0,
    remarks: ""
  });

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["contract-activities"],
    queryFn: () => api.getContractActivities({ page: 1, limit: 500 }),
    staleTime: 2 * 60 * 1000
  });

  const items = data?.items ?? [];

  const createMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        nameOfWork: newItem.nameOfWork,
        nameOfBidder: newItem.nameOfBidder || undefined,
        bidInvitingAuthority: newItem.bidInvitingAuthority || undefined,
        workCategory: newItem.workCategory,
        client: newItem.client,
        state: newItem.state || undefined,
        securityDepositType: (newItem.securityDepositType || null) as SecurityDepositType | null,
        sdBank: newItem.sdBank || undefined,
        sdIssuedDate: newItem.sdIssuedDate || null,
        sdNumber: newItem.sdNumber || undefined,
        sdAmount: newItem.sdAmount || undefined,
        sdExpiryDate: newItem.sdExpiryDate || null,
        proceedingOrderDate: newItem.proceedingOrderDate || null,
        woAmount: newItem.woAmount || undefined,
        piPlPolicyNo: newItem.piPlPolicyNo || undefined,
        piPlPolicyAmount: newItem.piPlPolicyAmount || undefined,
        wcPolicyNo: newItem.wcPolicyNo || undefined,
        wcPolicyAmount: newItem.wcPolicyAmount || undefined,
        remarks: newItem.remarks || undefined
      };
      return api.createContractActivity(payload);
    },
    onSuccess: () => {
      toast.success("Contract added");
      queryClient.invalidateQueries({ queryKey: ["contract-activities"] });
      setShowAddForm(false);
      setNewItem({
        nameOfWork: "", nameOfBidder: "", bidInvitingAuthority: "", workCategory: "", client: "", state: "",
        securityDepositType: "", sdBank: "", sdIssuedDate: "", sdNumber: "", sdAmount: 0, sdExpiryDate: "",
        proceedingOrderDate: "", woAmount: 0, piPlPolicyNo: "", piPlPolicyAmount: 0, wcPolicyNo: "", wcPolicyAmount: 0,
        remarks: ""
      });
    },
    onError: (e) => toast.error(e.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteContractActivity(id),
    onSuccess: () => {
      toast.success("Deleted");
      queryClient.invalidateQueries({ queryKey: ["contract-activities"] });
    },
    onError: (e) => toast.error(e.message)
  });

  const createProjectMutation = useMutation({
    mutationFn: (id: string) => api.createProjectFromContract(id),
    onSuccess: () => {
      toast.success("Project created — Admin can now assign the project number and remaining details");
      queryClient.invalidateQueries({ queryKey: ["contract-activities"] });
    },
    onError: (e) => toast.error(e.message)
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (workCategoryFilter !== "ALL" && item.workCategory !== workCategoryFilter) return false;
      if (clientFilter !== "ALL" && item.client !== clientFilter) return false;
      if (stateFilter !== "ALL" && item.state !== stateFilter) return false;
      if (!q) return true;
      return [item.nameOfWork, item.nameOfBidder, item.workCategory, item.client, item.state].join(" ").toLowerCase().includes(q);
    });
  }, [items, search, workCategoryFilter, clientFilter, stateFilter]);

  const clearFilters = () => {
    setSearch("");
    setWorkCategoryFilter("ALL");
    setClientFilter("ALL");
    setStateFilter("ALL");
  };

  return (
    <PageWrapper>
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title inline-flex items-center gap-2">
            <Briefcase className="h-6 w-6" /> Contract Activities
          </h1>
          <p className="page-subtitle">
            Final contract details after a tender is allotted — security deposits, policies, work order amount.
            Once complete, use "Create Project" to hand the details off to Admin.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="rounded-full">{filtered.length} contract(s)</Badge>
          <Button size="sm" variant="outline" className="gap-1" disabled={isFetching} onClick={() => refetch()}>
            {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
          <Button size="sm" className="gap-1" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="h-3.5 w-3.5" /> Add Contract
          </Button>
        </div>
      </div>

      <div className="glass-panel p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="text-xs text-muted-foreground mb-1.5 block">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Name of work, bidder, client..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
          <h3 className="font-semibold text-sm">New Contract</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Name of Work *</label>
              <Input value={newItem.nameOfWork} onChange={(e) => setNewItem({ ...newItem, nameOfWork: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Name of Bidder</label>
              <Input value={newItem.nameOfBidder} onChange={(e) => setNewItem({ ...newItem, nameOfBidder: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Bid Inviting Authority</label>
              <Input value={newItem.bidInvitingAuthority} onChange={(e) => setNewItem({ ...newItem, bidInvitingAuthority: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Work Category *</label>
              <Select value={newItem.workCategory} onValueChange={(v) => setNewItem({ ...newItem, workCategory: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {WORK_CATEGORY_OPTIONS.map((o) => <SelectItem key={o.code} value={o.code}>{o.code} — {o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Client *</label>
              <Select value={newItem.client} onValueChange={(v) => setNewItem({ ...newItem, client: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {CLIENT_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">State / Region *</label>
              <LocationCombobox value={newItem.state} onValueChange={(v) => setNewItem({ ...newItem, state: v })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Work Order Amount</label>
              <Input type="number" value={newItem.woAmount || ""} onChange={(e) => setNewItem({ ...newItem, woAmount: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Security Deposit Type</label>
              <Select value={newItem.securityDepositType || "NONE"} onValueChange={(v) => setNewItem({ ...newItem, securityDepositType: v === "NONE" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None</SelectItem>
                  {SECURITY_DEPOSIT_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {newItem.securityDepositType && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Bank</label>
                  <Input value={newItem.sdBank} onChange={(e) => setNewItem({ ...newItem, sdBank: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Issued Date</label>
                  <Input type="date" value={newItem.sdIssuedDate} onChange={(e) => setNewItem({ ...newItem, sdIssuedDate: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">No.</label>
                  <Input value={newItem.sdNumber} onChange={(e) => setNewItem({ ...newItem, sdNumber: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Amount</label>
                  <Input type="number" value={newItem.sdAmount || ""} onChange={(e) => setNewItem({ ...newItem, sdAmount: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Date of Exp.</label>
                  <Input type="date" value={newItem.sdExpiryDate} onChange={(e) => setNewItem({ ...newItem, sdExpiryDate: e.target.value })} />
                </div>
              </>
            )}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Proceeding / Work Order Date</label>
              <Input type="date" value={newItem.proceedingOrderDate} onChange={(e) => setNewItem({ ...newItem, proceedingOrderDate: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">PI/PL Policy No.</label>
              <Input value={newItem.piPlPolicyNo} onChange={(e) => setNewItem({ ...newItem, piPlPolicyNo: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">PI/PL Policy Amount</label>
              <Input type="number" value={newItem.piPlPolicyAmount || ""} onChange={(e) => setNewItem({ ...newItem, piPlPolicyAmount: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">WC Policy No.</label>
              <Input value={newItem.wcPolicyNo} onChange={(e) => setNewItem({ ...newItem, wcPolicyNo: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">WC Policy Amount</label>
              <Input type="number" value={newItem.wcPolicyAmount || ""} onChange={(e) => setNewItem({ ...newItem, wcPolicyAmount: Number(e.target.value) })} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="text-xs text-muted-foreground mb-1 block">Remarks</label>
              <Input value={newItem.remarks} onChange={(e) => setNewItem({ ...newItem, remarks: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
            <Button
              size="sm"
              disabled={!newItem.nameOfWork || !newItem.workCategory || !newItem.client || !newItem.state || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Save
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="glass-panel p-10 text-center text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading contracts...
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel p-10 text-center text-muted-foreground">No contracts match the selected filters.</div>
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
                  <th className="text-right font-medium p-3">Work Order Amt</th>
                  <th className="text-left font-medium p-3">Security Deposit</th>
                  <th className="text-left font-medium p-3">Work Order Date</th>
                  <th className="text-left font-medium p-3">Project</th>
                  <th className="text-right font-medium p-3 w-32"></th>
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
                    <td className="p-3 text-right tabular-nums">{formatCurrency(item.woAmount)}</td>
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
                    <td className="p-3 text-xs">{formatDate(item.proceedingOrderDate)}</td>
                    <td className="p-3 text-xs">
                      {item.linkedProjectId ? (
                        <Badge variant="secondary" className="text-[10px]">Created</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 px-2 text-[10px]"
                          disabled={createProjectMutation.isPending}
                          onClick={() => createProjectMutation.mutate(item.id)}
                        >
                          <FolderPlus className="h-3.5 w-3.5" /> Create Project
                        </Button>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setSelectedItem(item)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive"
                          onClick={() => { if (window.confirm("Delete?")) deleteMutation.mutate(item.id); }}
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

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-card border-b border-border/40 px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Contract Details</p>
                <p className="text-xs text-muted-foreground">Sr #{selectedItem.srNo}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelectedItem(null)}>Close</Button>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {([
                ["Name of Work", selectedItem.nameOfWork],
                ["Name of Bidder", selectedItem.nameOfBidder],
                ["Bid Inviting Authority", selectedItem.bidInvitingAuthority],
                ["Work Category", selectedItem.workCategory],
                ["Client", selectedItem.client],
                ["State / Region", selectedItem.state || "Not Selected"],
                ["Work Order Amount", formatCurrency(selectedItem.woAmount)],
                ["Security Deposit Type", SECURITY_DEPOSIT_TYPE_OPTIONS.find((o) => o.value === selectedItem.securityDepositType)?.label ?? "—"],
                ["SD Bank", selectedItem.sdBank],
                ["SD Issued Date", formatDate(selectedItem.sdIssuedDate)],
                ["SD Number", selectedItem.sdNumber],
                ["SD Amount", formatCurrency(selectedItem.sdAmount)],
                ["SD Expiry Date", formatDate(selectedItem.sdExpiryDate)],
                ["Additional SD Type", SECURITY_DEPOSIT_TYPE_OPTIONS.find((o) => o.value === selectedItem.additionalSdType)?.label ?? "—"],
                ["Additional SD Amount", formatCurrency(selectedItem.additionalSdAmount)],
                ["Proceeding / Work Order Date", formatDate(selectedItem.proceedingOrderDate)],
                ["PI/PL Policy No.", selectedItem.piPlPolicyNo],
                ["PI/PL Policy Amount", formatCurrency(selectedItem.piPlPolicyAmount)],
                ["WC Policy No.", selectedItem.wcPolicyNo],
                ["WC Policy Amount", formatCurrency(selectedItem.wcPolicyAmount)],
                ["Project Created", selectedItem.linkedProjectId ? "Yes" : "Not yet"],
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
