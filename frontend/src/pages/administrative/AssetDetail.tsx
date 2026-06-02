import { useEffect, useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AssetItem, AssetStatus, ProjectItem } from "@/lib/domain";
import { ASSET_CLASS_OPTIONS, getAssetTypesForClass } from "@/lib/asset-catalog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CalendarPlus, FileText, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate, useParams } from "react-router-dom";
import { downloadAssetPdf } from "@/lib/asset-pdf";

const STATUS_COLORS: Record<AssetStatus, string> = {
  IN_USE: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  IN_STORE: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  UNDER_REPAIR: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  DISPOSED: "bg-slate-500/10 text-slate-600 border-slate-500/20"
};

function getStatusLabel(status: AssetStatus) {
  return status === "DISPOSED" ? "SOLD" : status.replace(/_/g, " ");
}

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

function formatCurrency(value: number) {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function calculateBookValue(asset: Pick<AssetItem, "purchaseAmount" | "dateOfPurchase" | "depreciationPerYear">, asOfDate: Date) {
  const purchaseYear = asset.dateOfPurchase ? new Date(asset.dateOfPurchase).getFullYear() : asOfDate.getFullYear();
  const yearsElapsed = Math.max(asOfDate.getFullYear() - purchaseYear, 0);
  const currentValue = Number((asset.purchaseAmount - asset.depreciationPerYear * yearsElapsed).toFixed(2));

  return { yearsElapsed, currentValue };
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
  return Math.max(Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)), 0);
}

function getProjectNameByNumber(projects: ProjectItem[], projectNumber?: string | null) {
  if (!projectNumber) return "";
  return projects.find((project) => project.projectNumber === projectNumber)?.name ?? "";
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary/30 border border-border/40 p-3">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-medium break-words">{value || "-"}</p>
    </div>
  );
}

function MovementDialog({ assetId, open, onOpenChange }: { assetId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [movedToProjectNumber, setMovedToProjectNumber] = useState("");
  const [movedToProjectName, setMovedToProjectName] = useState("");
  const [dateOfMoving, setDateOfMoving] = useState("");
  const [movedToUser, setMovedToUser] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.addAssetMovement(assetId, {
        movedToProjectNumber: movedToProjectNumber.trim(),
        movedToProjectName: movedToProjectName.trim(),
        dateOfMoving: new Date(dateOfMoving).toISOString(),
        movedToUser: movedToUser.trim()
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["assets", assetId] });
      await queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast.success("Movement logged");
      onOpenChange(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to log movement")
  });

  useEffect(() => {
    if (open) {
      setMovedToProjectNumber("");
      setMovedToProjectName("");
      setDateOfMoving(new Date().toISOString().slice(0, 10));
      setMovedToUser("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log Movement</DialogTitle>
          <DialogDescription>Record where the asset has been moved.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Moved To Project Number</Label>
            <Input value={movedToProjectNumber} onChange={(event) => setMovedToProjectNumber(event.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Moved To Project Name</Label>
            <Input value={movedToProjectName} onChange={(event) => setMovedToProjectName(event.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Date of Moving</Label>
            <Input type="date" value={dateOfMoving} onChange={(event) => setDateOfMoving(event.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Moved To User</Label>
            <Input value={movedToUser} onChange={(event) => setMovedToUser(event.target.value)} className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !movedToProjectNumber.trim() || !movedToProjectName.trim() || !dateOfMoving || !movedToUser.trim()}>Save Movement</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MaintenanceDialog({ asset, open, onOpenChange }: { asset: AssetItem; open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [dateOfMaintenance, setDateOfMaintenance] = useState("");
  const [repairCostInclGst, setRepairCostInclGst] = useState("0");
  const [sellAmount, setSellAmount] = useState("0");
  const [soldTo, setSoldTo] = useState("");
  const [saleRemark, setSaleRemark] = useState("");

  const depreciationSnapshot = useMemo(() => {
    if (!dateOfMaintenance) {
      return null;
    }

    return calculateBookValue(asset, new Date(dateOfMaintenance));
  }, [asset, dateOfMaintenance]);

  const mutation = useMutation({
    mutationFn: () =>
      api.addAssetMaintenance(asset.id, {
        dateOfMaintenance: new Date(dateOfMaintenance).toISOString(),
        repairCostInclGst: toNumber(repairCostInclGst),
        sellAmount: toNumber(sellAmount),
        soldTo: toNumber(sellAmount) > 0 ? soldTo.trim() || null : null,
        remark: saleRemark.trim() || null
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["assets", asset.id] });
      await queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast.success("Maintenance logged");
      onOpenChange(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to log maintenance")
  });

  useEffect(() => {
    if (open) {
      setDateOfMaintenance(new Date().toISOString().slice(0, 10));
      setRepairCostInclGst("0");
      setSellAmount("0");
      setSoldTo("");
      setSaleRemark("");
    }
  }, [open]);

  const isSoldEntry = toNumber(sellAmount) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log Maintenance</DialogTitle>
          <DialogDescription>Capture repair and depreciation details.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Date of Maintenance</Label>
            <Input type="date" value={dateOfMaintenance} onChange={(event) => setDateOfMaintenance(event.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Repair Cost (incl. GST)</Label>
            <Input type="number" min="0" value={repairCostInclGst} onChange={(event) => setRepairCostInclGst(event.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Depreciation / Current Value</Label>
            <Input
              value={depreciationSnapshot ? formatCurrency(depreciationSnapshot.currentValue) : "Select a maintenance date"}
              readOnly
              className="mt-1 bg-secondary/40"
            />
            <p className="mt-1 text-xs text-muted-foreground">Auto-calculated from the purchase year, 5% scrap value and useful life.</p>
          </div>
          <div>
            <Label>Sell Amount</Label>
            <Input type="number" min="0" value={sellAmount} onChange={(event) => setSellAmount(event.target.value)} className="mt-1" />
            <p className="mt-1 text-xs text-muted-foreground">Entering a sell amount will automatically mark the asset as SOLD.</p>
          </div>
          {isSoldEntry && (
            <>
              <div>
                <Label>Sold To</Label>
                <Input value={soldTo} onChange={(event) => setSoldTo(event.target.value)} className="mt-1" placeholder="Person or party name" />
              </div>
              <div>
                <Label>Remark</Label>
                <Textarea value={saleRemark} onChange={(event) => setSaleRemark(event.target.value)} className="mt-1 min-h-24" placeholder="Optional sale note" />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>Save Maintenance</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AssetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [form, setForm] = useState<AssetFormState>(EMPTY_FORM);

  const { data: asset, isLoading } = useQuery({
    queryKey: ["assets", id],
    queryFn: () => api.getAsset(id as string),
    enabled: Boolean(id)
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.getProjects()
  });

  const { data: assetsResponse } = useQuery({
    queryKey: ["assets", "for-options"],
    queryFn: () => api.getAssets({ limit: 500 })
  });

  useEffect(() => {
    if (asset) {
      setForm(toFormState(asset));
    }
  }, [asset]);

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!id) {
        throw new Error("Asset id is missing");
      }

      if (form.warrantyPeriod && form.dateOfPurchase && isDateBefore(form.warrantyPeriod, form.dateOfPurchase)) {
        throw new Error("Warranty end date cannot be before the date of purchase");
      }

      return api.updateAsset(id, {
        assetClass: form.assetClass === "Other" ? form.customAssetClass.trim() : form.assetClass,
        assetType: form.assetType === "Other" ? form.customAssetType.trim() : form.assetType,
        markModel: form.markModel.trim() || null,
        dateOfPurchase: form.dateOfPurchase ? new Date(form.dateOfPurchase).toISOString() : null,
        warrantyPeriod: form.warrantyPeriod.trim() || null,
        purchaseAmount: toNumber(form.purchaseAmount),
        gst: toNumber(form.gst),
        projectNumber: form.projectNumber.trim() || null,
        projectName: selectedProjectName || null,
        assignedUser: form.assignedUser.trim() || null,
        status: form.status,
        remarks: form.remarks.trim() || null,
        forMonth: form.forMonth.trim() || null,
        itAssetId: form.itAssetId.trim() || null
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["assets", id] });
      await queryClient.invalidateQueries({ queryKey: ["assets"] });
      await queryClient.invalidateQueries({ queryKey: ["assets", "stats"] });
      toast.success("Asset updated");
      setIsEditing(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to update asset")
  });

  const totalAmount = useMemo(() => (toNumber(form.purchaseAmount) + toNumber(form.gst)).toFixed(2), [form.purchaseAmount, form.gst]);
  const classOptions = useMemo(() => {
    const dynamic = (assetsResponse?.items ?? []).map((item) => item.assetClass).filter(Boolean);
    return Array.from(new Set([...ASSET_CLASS_OPTIONS, ...dynamic]));
  }, [assetsResponse?.items]);
  const typeOptions = useMemo(() => {
    const builtIn = getAssetTypesForClass(form.assetClass);
    const dynamic = (assetsResponse?.items ?? [])
      .filter((item) => item.assetClass === (form.assetClass === "Other" ? form.customAssetClass.trim() : form.assetClass))
      .map((item) => item.assetType)
      .filter(Boolean);
    return Array.from(new Set([...builtIn, ...dynamic]));
  }, [assetsResponse?.items, form.assetClass, form.customAssetClass]);
  const selectedProjectName = useMemo(
    () => getProjectNameByNumber(projects, form.projectNumber.trim() || null),
    [form.projectNumber, projects]
  );
  const editingDepreciation = useMemo(() => {
    if (!form.assetClass) {
      return null;
    }

    const usefulLifeYears = form.assetClass === "Bike - Owned" ? 5 : form.assetClass === "Car - Owned" ? 8 : 10;
    const purchaseAmount = toNumber(form.purchaseAmount);
    const scrapValue = Number((purchaseAmount * 0.1).toFixed(2));
    const depreciationPerYear = usefulLifeYears > 0 ? Number(((purchaseAmount - scrapValue) / usefulLifeYears).toFixed(2)) : 0;
    const purchaseYear = form.dateOfPurchase ? new Date(form.dateOfPurchase).getFullYear() : new Date().getFullYear();
    const yearsElapsed = Math.max(new Date().getFullYear() - purchaseYear, 0);
    const currentValue = Number((purchaseAmount - depreciationPerYear * yearsElapsed).toFixed(2));

    return { usefulLifeYears, scrapValue, depreciationPerYear, yearsElapsed, currentValue };
  }, [form.assetClass, form.dateOfPurchase, form.purchaseAmount]);
  const daysSincePurchase = useMemo(() => getDaysSincePurchase(form.dateOfPurchase), [form.dateOfPurchase]);

  if (isLoading || !id) {
    return <PageWrapper><div className="page-header"><h1 className="page-title">Asset Detail</h1><p className="page-subtitle">Loading asset...</p></div></PageWrapper>;
  }

  if (!asset) {
    return (
      <PageWrapper>
        <div className="page-header">
          <h1 className="page-title">Asset Detail</h1>
          <p className="page-subtitle">Asset not found.</p>
        </div>
        <Button asChild variant="outline"><Link to="/administrative/assets"><ArrowLeft className="h-4 w-4 mr-2" />Back to assets</Link></Button>
      </PageWrapper>
    );
  }

  const isSold = asset.status === "DISPOSED";

  return (
    <PageWrapper>
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/administrative/assets")} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <span className={`status-badge border ${STATUS_COLORS[asset.status]}`}>{getStatusLabel(asset.status)}</span>
          </div>
          <h1 className="page-title">{asset.assetId}</h1>
          <p className="page-subtitle">{asset.assetClass} / {asset.assetType}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => downloadAssetPdf(asset, { projectName: getProjectNameByNumber(projects, asset.projectNumber) })}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-500/30 text-amber-400 text-sm font-medium hover:bg-amber-500/10 transition-colors"
          >
            <FileText className="h-4 w-4" />
            Download PDF
          </button>
          <Button variant="outline" onClick={() => setMovementOpen(true)} className="gap-2" disabled={isSold}><CalendarPlus className="h-4 w-4" /> Log Movement</Button>
          <Button variant="outline" onClick={() => setMaintenanceOpen(true)} className="gap-2" disabled={isSold}><Plus className="h-4 w-4" /> Log Maintenance</Button>
          <Button onClick={() => setIsEditing((current) => !current)} className="gap-2"><Pencil className="h-4 w-4" /> {isEditing ? "Cancel Edit" : "Edit Asset"}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1fr] gap-6">
        <div className="glass-panel-strong p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Asset Information</h3>
            {!isEditing && <span className={`status-badge border ${STATUS_COLORS[asset.status]}`}>{getStatusLabel(asset.status)}</span>}
          </div>

          {isEditing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Asset Class</Label>
                <Select value={form.assetClass} onValueChange={(value) => setForm((prev) => ({ ...prev, assetClass: value, assetType: "", customAssetClass: value === "Other" ? prev.customAssetClass : "", customAssetType: "" }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select asset class" /></SelectTrigger>
                  <SelectContent>
                    {classOptions.map((assetClass) => <SelectItem key={assetClass} value={assetClass}>{assetClass}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Asset Type</Label>
                <Select value={form.assetType} onValueChange={(value) => setForm((prev) => ({ ...prev, assetType: value }))} disabled={!form.assetClass}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select asset type" /></SelectTrigger>
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
              <div><Label>Mark / Model</Label><Input value={form.markModel} onChange={(event) => setForm((prev) => ({ ...prev, markModel: event.target.value }))} className="mt-1" /></div>
              <div><Label>IT Asset ID</Label><Input value={form.itAssetId} onChange={(event) => setForm((prev) => ({ ...prev, itAssetId: event.target.value }))} className="mt-1" /></div>
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
              <div><Label>Purchase Amount</Label><Input type="number" min="0" value={form.purchaseAmount} onChange={(event) => setForm((prev) => ({ ...prev, purchaseAmount: event.target.value }))} className="mt-1" /></div>
              <div><Label>GST</Label><Input type="number" min="0" value={form.gst} onChange={(event) => setForm((prev) => ({ ...prev, gst: event.target.value }))} className="mt-1" /></div>
              <div><Label>Total Amount with GST</Label><Input readOnly value={totalAmount} className="mt-1 bg-secondary/40" /></div>
              <div><Label>Current Value</Label><Input readOnly value={editingDepreciation ? formatCurrency(editingDepreciation.currentValue) : "-"} className="mt-1 bg-secondary/40" /></div>
              <div><Label>Project Number</Label><Input value={form.projectNumber} onChange={(event) => setForm((prev) => ({ ...prev, projectNumber: event.target.value }))} className="mt-1" /></div>
              <div><Label>Project Name</Label><Input value={selectedProjectName || "-"} readOnly className="mt-1 bg-secondary/40" /></div>
              <div><Label>Assigned User</Label><Input value={form.assignedUser} onChange={(event) => setForm((prev) => ({ ...prev, assignedUser: event.target.value }))} className="mt-1" /></div>
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as AssetStatus }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["IN_USE", "DISPOSED"] as AssetStatus[]).map((value) => <SelectItem key={value} value={value}>{getStatusLabel(value)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>For Month</Label><Input value={form.forMonth} onChange={(event) => setForm((prev) => ({ ...prev, forMonth: event.target.value }))} className="mt-1" /></div>
              <div className="md:col-span-2"><Label>Remarks</Label><Textarea value={form.remarks} onChange={(event) => setForm((prev) => ({ ...prev, remarks: event.target.value }))} className="mt-1 min-h-24" /></div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setIsEditing(false); setForm(toFormState(asset)); }}>Cancel</Button>
                <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending || !form.assetType || (form.assetClass === "Other" && !form.customAssetClass.trim()) || (form.assetType === "Other" && !form.customAssetType.trim())}>Save Changes</Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Asset ID" value={asset.assetId} />
              <Field label="IT Asset ID" value={asset.itAssetId ?? "-"} />
              <Field label="Asset Class" value={asset.assetClass} />
              <Field label="Asset Type" value={asset.assetType} />
              <Field label="Mark / Model" value={asset.markModel ?? "-"} />
              <Field label="Date of Purchase" value={asset.dateOfPurchase ? new Date(asset.dateOfPurchase).toLocaleDateString("en-IN") : "-"} />
              <Field label="Warranty End Date" value={formatWarrantyEndDate(asset.warrantyPeriod)} />
              <Field label="Purchase Amount" value={`₹${asset.purchaseAmount.toLocaleString("en-IN")}`} />
              <Field label="GST" value={`₹${asset.gst.toLocaleString("en-IN")}`} />
              <Field label="Total Amount with GST" value={`₹${asset.totalAmountWithGst.toLocaleString("en-IN")}`} />
              <Field label="Scrap Value (10%)" value={formatCurrency(asset.scrapValue)} />
              <Field label="Current Value" value={formatCurrency(asset.currentValue)} />
              <Field label="Days Since Purchase" value={daysSincePurchase === null ? "-" : String(daysSincePurchase)} />
              <Field label="Project Number" value={asset.projectNumber ?? "-"} />
              <Field label="Project Name" value={asset.projectName ?? getProjectNameByNumber(projects, asset.projectNumber) ?? "-"} />
              <Field label="Assigned User" value={asset.assignedUser ?? "-"} />
              <div className="md:col-span-2"><Field label="Remarks" value={asset.remarks ?? "-"} /></div>
            </div>
          )}
        </div>

        <div className="glass-panel p-6">
          <Tabs defaultValue="movements" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="movements">Movement History</TabsTrigger>
              <TabsTrigger value="maintenance">Maintenance Records</TabsTrigger>
            </TabsList>
            <TabsContent value="movements">
              <div className="flex justify-end mb-3">
                <Button onClick={() => setMovementOpen(true)} className="gap-2" disabled={isSold}><CalendarPlus className="h-4 w-4" /> Log Movement</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Previous Project</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Moved To Project</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Assigned Date</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Return Date</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Moved To User</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(asset.movements ?? []).length === 0 ? (
                      <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No movement history.</td></tr>
                    ) : asset.movements!.map((movement) => (
                      <tr key={movement.id} className="border-b border-border/20">
                        <td className="py-3 px-4">{[movement.previousProjectNumber, movement.previousProjectName].filter(Boolean).join(" - ") || "-"}</td>
                        <td className="py-3 px-4">{[movement.movedToProjectNumber, movement.movedToProjectName].filter(Boolean).join(" - ") || "-"}</td>
                        <td className="py-3 px-4">{new Date(movement.assignedDate ?? movement.dateOfMoving).toLocaleDateString("en-IN")}</td>
                        <td className="py-3 px-4">{movement.returnDate ? new Date(movement.returnDate).toLocaleDateString("en-IN") : "-"}</td>
                        <td className="py-3 px-4">{movement.movedToUser ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
            <TabsContent value="maintenance">
              <div className="flex justify-end mb-3">
                <Button onClick={() => setMaintenanceOpen(true)} className="gap-2" disabled={isSold}><Plus className="h-4 w-4" /> Log Maintenance</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Repair Cost (incl. GST)</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Sell Amount</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Sold To</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(asset.maintenances ?? []).length === 0 ? (
                      <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No maintenance records.</td></tr>
                    ) : asset.maintenances!.map((maintenance) => (
                      <tr key={maintenance.id} className="border-b border-border/20">
                        <td className="py-3 px-4">{new Date(maintenance.dateOfMaintenance).toLocaleDateString("en-IN")}</td>
                        <td className="py-3 px-4">₹{maintenance.repairCostInclGst.toLocaleString("en-IN")}</td>
                        <td className="py-3 px-4">₹{maintenance.sellAmount.toLocaleString("en-IN")}</td>
                        <td className="py-3 px-4">{maintenance.soldTo ?? "-"}</td>
                        <td className="py-3 px-4">{maintenance.remark ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <MovementDialog assetId={asset.id} open={movementOpen} onOpenChange={setMovementOpen} />
      <MaintenanceDialog asset={asset} open={maintenanceOpen} onOpenChange={setMaintenanceOpen} />
    </PageWrapper>
  );
}
