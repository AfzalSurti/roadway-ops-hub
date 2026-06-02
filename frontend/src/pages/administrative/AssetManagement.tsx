import { useEffect, useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AssetItem, AssetStatus, ProjectItem } from "@/lib/domain";
import { ASSET_CLASS_GROUP_OPTIONS, ASSET_CLASS_OPTIONS, ASSET_TYPES_BY_CLASS, getAssetClassGroup, getAssetTypesForClass } from "@/lib/asset-catalog";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Download, Eye, Pencil, Plus, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { downloadAssetPdf } from "@/lib/asset-pdf";
import { FileText, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

const STATUS_OPTIONS: Array<{ label: string; value: AssetStatus | "ALL" }> = [
  { label: "All", value: "ALL" },
  { label: "IN_USE", value: "IN_USE" },
  { label: "SOLD", value: "DISPOSED" }
];

const STATUS_COLORS: Record<AssetStatus, string> = {
  IN_USE: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  IN_STORE: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  UNDER_REPAIR: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  DISPOSED: "bg-slate-500/10 text-slate-600 border-slate-500/20"
};

type AssetFormState = {
  assetClass: string;
  assetType: string;
  customAssetClass: string;
  customAssetType: string;
  markModel: string;
  dateOfPurchase: string;
  warrantyPeriod: string;
  purchaseAmount: string;
  gst: string;
  projectNumber: string;
  assignedUser: string;
  status: AssetStatus;
  remarks: string;
  forMonth: string;
  itAssetId: string;
};

const EMPTY_FORM: AssetFormState = {
  assetClass: "",
  assetType: "",
  customAssetClass: "",
  customAssetType: "",
  markModel: "",
  dateOfPurchase: "",
  warrantyPeriod: "",
  purchaseAmount: "0",
  gst: "0",
  projectNumber: "",
  assignedUser: "",
  status: "IN_USE",
  remarks: "",
  forMonth: "",
  itAssetId: ""
};

function toDateInputValue(value?: string | null) {
  if (!value) return "";
  const datePart = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : "";
}

function isDateBefore(value: string, minimum: string) {
  if (!value || !minimum) return false;
  return new Date(value).getTime() < new Date(minimum).getTime();
}

function formatWarrantyEndDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN");
}

function toFormState(asset?: AssetItem | null): AssetFormState {
  if (!asset) return EMPTY_FORM;
  const normalizedClass = ASSET_CLASS_OPTIONS.includes(asset.assetClass as (typeof ASSET_CLASS_OPTIONS)[number]) ? asset.assetClass : "Other";
  const typeOptions = getAssetTypesForClass(normalizedClass);
  const normalizedType = typeOptions.includes(asset.assetType) ? asset.assetType : "Other";

  return {
    assetClass: normalizedClass,
    assetType: normalizedType,
    customAssetClass: normalizedClass === "Other" ? asset.assetClass : "",
    customAssetType: normalizedType === "Other" ? asset.assetType : "",
    markModel: asset.markModel ?? "",
    dateOfPurchase: toDateInputValue(asset.dateOfPurchase),
    warrantyPeriod: toDateInputValue(asset.warrantyPeriod),
    purchaseAmount: String(asset.purchaseAmount ?? 0),
    gst: String(asset.gst ?? 0),
    projectNumber: asset.projectNumber ?? "",
    assignedUser: asset.assignedUser ?? "",
    status: asset.status,
    remarks: asset.remarks ?? "",
    forMonth: asset.forMonth ?? "",
    itAssetId: asset.itAssetId ?? ""
  };
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getProjectNameByNumber(projects: ProjectItem[], projectNumber?: string | null) {
  if (!projectNumber) return "";
  return projects.find((project) => project.projectNumber === projectNumber)?.name ?? "";
}

function getStatusLabel(status: AssetStatus) {
  return status === "DISPOSED" ? "SOLD" : "IN USE";
}

function getDaysSincePurchase(dateOfPurchase?: string | null) {
  if (!dateOfPurchase) {
    return null;
  }

  const purchaseDate = new Date(dateOfPurchase);
  if (Number.isNaN(purchaseDate.getTime())) {
    return null;
  }

  const today = new Date();
  const start = new Date(purchaseDate.getFullYear(), purchaseDate.getMonth(), purchaseDate.getDate());
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffMs = end.getTime() - start.getTime();
  return Math.max(Math.floor(diffMs / (1000 * 60 * 60 * 24)), 0);
}

function AssetEditorDialog({
  open,
  onOpenChange,
  asset,
  projects,
  assets,
  onSaved
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: AssetItem | null;
  projects: ProjectItem[];
  assets: AssetItem[];
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AssetFormState>(EMPTY_FORM);
  const classOptions = useMemo(() => {
    const dynamic = assets.map((item) => item.assetClass).filter(Boolean);
    return Array.from(new Set([...ASSET_CLASS_OPTIONS, ...dynamic]));
  }, [assets]);

  const typeOptions = useMemo(() => {
    const builtIn = getAssetTypesForClass(form.assetClass);
    const dynamic = assets
      .filter((item) => item.assetClass === (form.assetClass === "Other" ? form.customAssetClass.trim() : form.assetClass))
      .map((item) => item.assetType)
      .filter(Boolean);

    return Array.from(new Set([...builtIn, ...dynamic]));
  }, [assets, form.assetClass, form.customAssetClass]);

  const selectedProjectName = useMemo(
    () => getProjectNameByNumber(projects, form.projectNumber.trim() || null),
    [form.projectNumber, projects]
  );

  useEffect(() => {
    if (open) {
      setForm(toFormState(asset));
    }
  }, [asset, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (form.warrantyPeriod && form.dateOfPurchase && isDateBefore(form.warrantyPeriod, form.dateOfPurchase)) {
        throw new Error("Warranty end date cannot be before the date of purchase");
      }

      const payload = {
        assetClass: form.assetClass === "Other" ? form.customAssetClass.trim() : form.assetClass,
        assetType: form.assetType === "Other" ? form.customAssetType.trim() : form.assetType,
        markModel: form.markModel.trim() || null,
        dateOfPurchase: form.dateOfPurchase ? new Date(form.dateOfPurchase).toISOString() : null,
        warrantyPeriod: form.warrantyPeriod.trim() || null,
        purchaseAmount: toNumber(form.purchaseAmount),
        gst: toNumber(form.gst),
        projectNumber: form.projectNumber.trim() || null,
        assignedUser: form.assignedUser.trim() || null,
        remarks: form.remarks.trim() || null,
        itAssetId: form.itAssetId.trim() || null
      };

      return asset
        ? api.updateAsset(asset.id, { ...payload, status: form.status })
        : api.createAsset(payload);
    },
    onSuccess: async (result) => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["assets"] }), queryClient.invalidateQueries({ queryKey: ["assets", "stats"] })]);
      toast.success(asset ? "Asset updated" : `Asset created: ${result.assetId}`);
      onOpenChange(false);
      onSaved();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to save asset");
    }
  });

  const totalAmount = useMemo(() => (toNumber(form.purchaseAmount) + toNumber(form.gst)).toFixed(2), [form.purchaseAmount, form.gst]);
  const daysSincePurchase = useMemo(() => getDaysSincePurchase(form.dateOfPurchase), [form.dateOfPurchase]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{asset ? "Edit Asset" : "Add Asset"}</DialogTitle>
          <DialogDescription>Manage asset details, allocation and stock status.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Asset Class</Label>
            <Select value={form.assetClass} onValueChange={(value) => setForm((prev) => ({ ...prev, assetClass: value, assetType: "", customAssetClass: value === "Other" ? prev.customAssetClass : "", customAssetType: "" }))}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select asset class" />
              </SelectTrigger>
              <SelectContent>
                {classOptions.map((assetClass) => <SelectItem key={assetClass} value={assetClass}>{assetClass}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Asset Type</Label>
            <Select value={form.assetType} onValueChange={(value) => setForm((prev) => ({ ...prev, assetType: value }))} disabled={!form.assetClass}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select asset type" />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((assetType) => <SelectItem key={assetType} value={assetType}>{assetType}</SelectItem>)}
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.assetClass === "Other" ? (
            <div className="md:col-span-2">
              <Label>Other Asset Class</Label>
              <Input value={form.customAssetClass} onChange={(event) => setForm((prev) => ({ ...prev, customAssetClass: event.target.value }))} className="mt-1" placeholder="Enter custom asset class" />
            </div>
          ) : null}
          {form.assetType === "Other" ? (
            <div className="md:col-span-2">
              <Label>Other Asset Type</Label>
              <Input value={form.customAssetType} onChange={(event) => setForm((prev) => ({ ...prev, customAssetType: event.target.value }))} className="mt-1" placeholder="Enter custom asset type" />
            </div>
          ) : null}

          <div>
            <Label>Mark / Model</Label>
            <Input value={form.markModel} onChange={(event) => setForm((prev) => ({ ...prev, markModel: event.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>IT Asset ID</Label>
            <Input value={form.itAssetId} onChange={(event) => setForm((prev) => ({ ...prev, itAssetId: event.target.value }))} className="mt-1" />
          </div>

          <div>
            <Label>Date of Purchase</Label>
            <Input
              type="date"
              value={form.dateOfPurchase}
              onChange={(event) =>
                setForm((prev) => {
                  const nextDateOfPurchase = event.target.value;
                  return {
                    ...prev,
                    dateOfPurchase: nextDateOfPurchase,
                    warrantyPeriod:
                      prev.warrantyPeriod && isDateBefore(prev.warrantyPeriod, nextDateOfPurchase)
                        ? ""
                        : prev.warrantyPeriod
                  };
                })
              }
              className="mt-1"
            />
          </div>
          <div>
            <Label>Warranty End Date</Label>
            <Input
              type="date"
              min={form.dateOfPurchase || undefined}
              value={form.warrantyPeriod}
              onChange={(event) => setForm((prev) => ({ ...prev, warrantyPeriod: event.target.value }))}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Purchase Amount</Label>
            <Input type="number" min="0" value={form.purchaseAmount} onChange={(event) => setForm((prev) => ({ ...prev, purchaseAmount: event.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>GST</Label>
            <Input type="number" min="0" value={form.gst} onChange={(event) => setForm((prev) => ({ ...prev, gst: event.target.value }))} className="mt-1" />
          </div>

          <div>
            <Label>Total Amount with GST</Label>
            <Input value={totalAmount} readOnly className="mt-1 bg-secondary/40" />
          </div>
          <div>
            <Label>Project Number</Label>
              <Select value={form.projectNumber || "__NONE__"} onValueChange={(value) => setForm((prev) => ({ ...prev, projectNumber: value === "__NONE__" ? "" : value }))}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="__NONE__">None</SelectItem>
                  {projects
                    .filter((project) => project.projectNumber)
                    .map((project) => (
                      <SelectItem key={project.id} value={project.projectNumber!}>
                        {project.projectNumber} - {project.name}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Project Name</Label>
            <Input value={selectedProjectName || "-"} readOnly className="mt-1 bg-secondary/40" />
          </div>

          <div>
            <Label>Assigned User</Label>
            <Input value={form.assignedUser} onChange={(event) => setForm((prev) => ({ ...prev, assignedUser: event.target.value }))} className="mt-1" />
          </div>
          {asset ? (
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as AssetStatus }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.filter((item) => item.value !== "ALL").map((option) => (
                    <SelectItem key={option.value} value={option.value as AssetStatus}>
                      {option.label === "DISPOSED" ? "SOLD" : option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div>
            <Label>Days Since Purchase</Label>
            <Input value={daysSincePurchase === null ? "-" : String(daysSincePurchase)} readOnly className="mt-1 bg-secondary/40" />
          </div>
          <div />

          <div className="md:col-span-2">
            <Label>Remarks</Label>
            <Textarea value={form.remarks} onChange={(event) => setForm((prev) => ({ ...prev, remarks: event.target.value }))} className="mt-1 min-h-24" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} type="button">Cancel</Button>
          <Button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={
              mutation.isPending ||
              !form.assetClass ||
              !form.assetType ||
              (form.assetClass === "Other" && !form.customAssetClass.trim()) ||
              (form.assetType === "Other" && !form.customAssetType.trim())
            }
          >
            {mutation.isPending ? "Saving..." : asset ? "Update Asset" : "Create Asset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AssetManagement() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<(typeof ASSET_CLASS_GROUP_OPTIONS)[number]>("All");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<AssetStatus | "ALL">("ALL");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetItem | null>(null);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.getProjects()
  });

  const { data: assetsResponse, refetch } = useQuery({
    queryKey: ["assets", search, groupFilter, projectFilter, statusFilter],
    queryFn: () =>
      api.getAssets({
        limit: 500,
        search: search.trim() || undefined,
        assetClass: groupFilter === "All" ? undefined : groupFilter,
        projectNumber: projectFilter === "ALL" ? undefined : projectFilter,
        status: statusFilter === "ALL" ? undefined : statusFilter
      })
  });

  const assets = assetsResponse?.items ?? [];

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => groupFilter === "All" || getAssetClassGroup(asset.assetClass) === groupFilter);
  }, [assets, groupFilter]);

  const createExport = () => {
    const rows = filteredAssets.map((asset, index) => ({
      "#": index + 1,
      "Asset Class": asset.assetClass,
      "Asset Type": asset.assetType,
      "Date of Purchase": asset.dateOfPurchase ? new Date(asset.dateOfPurchase).toLocaleDateString("en-IN") : "",
      "Mark/Model": asset.markModel ?? "",
      "Warranty End Date": formatWarrantyEndDate(asset.warrantyPeriod),
      "Purchase Amount": asset.purchaseAmount,
      GST: asset.gst,
      "Total Amount with GST": asset.totalAmountWithGst,
      "Asset ID": asset.assetId,
      "IT Asset ID": asset.itAssetId ?? "",
      "Project Number": asset.projectNumber ?? "",
      User: asset.assignedUser ?? "",
      Status: asset.status === "DISPOSED" ? "SOLD" : asset.status,
      Remarks: asset.remarks ?? ""
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: ["#", "Asset Class", "Asset Type", "Date of Purchase", "Mark/Model", "Warranty End Date", "Purchase Amount", "GST", "Total Amount with GST", "Asset ID", "IT Asset ID", "Project Number", "User", "Status", "Remarks"]
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Assets");
    XLSX.writeFile(workbook, "asset-management.xlsx");
  };

  return (
    <PageWrapper>
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title">Asset Management</h1>
          <p className="page-subtitle">Track stock, movement history, maintenance and allocation.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={createExport} className="gap-2">
            <Download className="h-4 w-4" /> Export Excel
          </Button>
          <Button onClick={() => { setEditingAsset(null); setIsEditorOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Add Asset
          </Button>
        </div>
      </div>

      <div className="glass-panel p-4 mb-6 grid grid-cols-1 lg:grid-cols-4 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search asset ID, class, model" className="pl-9" />
        </div>

        <Select value={groupFilter} onValueChange={(value) => setGroupFilter(value as typeof groupFilter)}>
          <SelectTrigger>
            <SelectValue placeholder="Asset Class Group" />
          </SelectTrigger>
          <SelectContent>
            {ASSET_CLASS_GROUP_OPTIONS.map((group) => (
              <SelectItem key={group} value={group}>{group}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Project Number" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Projects</SelectItem>
            {projects
              .filter((project) => project.projectNumber)
              .map((project) => (
                <SelectItem key={project.id} value={project.projectNumber!}>
                  {project.projectNumber} - {project.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as AssetStatus | "ALL") }>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="glass-panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40">
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Asset ID</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Asset Class</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Asset Type</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Mark/Model</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Purchase Date</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Total Amount</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Project</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">User</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAssets.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-10 text-center text-muted-foreground">No assets found.</td>
              </tr>
            ) : (
              filteredAssets.map((asset) => (
                <tr key={asset.id} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                  <td className="py-3 px-4 font-medium">{asset.assetId}</td>
                  <td className="py-3 px-4">{asset.assetClass}</td>
                  <td className="py-3 px-4">{asset.assetType}</td>
                  <td className="py-3 px-4">{asset.markModel ?? "-"}</td>
                  <td className="py-3 px-4">{asset.dateOfPurchase ? new Date(asset.dateOfPurchase).toLocaleDateString("en-IN") : "-"}</td>
                  <td className="py-3 px-4">₹{asset.totalAmountWithGst.toLocaleString("en-IN")}</td>
                  <td className="py-3 px-4">{asset.projectNumber ?? "-"}</td>
                  <td className="py-3 px-4">{asset.assignedUser ?? "-"}</td>
                  <td className="py-3 px-4">
                    <span className={`status-badge border ${STATUS_COLORS[asset.status]}`}>{getStatusLabel(asset.status)}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => navigate(`/administrative/assets/${asset.id}`)}>
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => { setEditingAsset(asset); setIsEditorOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <button
                        type="button"
                        title="Download Asset PDF"
                        aria-label={`Download PDF for ${asset.assetId}`}
                        className="p-1.5 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors"
                        onClick={async (event) => {
                          event.stopPropagation();
                          setPdfLoading(asset.id);
                          try {
                            const fullAsset = await api.getAsset(asset.id);
                            downloadAssetPdf(fullAsset, { projectName: getProjectNameByNumber(projects, fullAsset.projectNumber) });
                          } catch {
                            toast.error("Failed to generate PDF");
                          } finally {
                            setPdfLoading(null);
                          }
                        }}
                      >
                        {pdfLoading === asset.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AssetEditorDialog
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        asset={editingAsset}
        projects={projects}
        assets={assets}
        onSaved={() => void refetch()}
      />
    </PageWrapper>
  );
}
