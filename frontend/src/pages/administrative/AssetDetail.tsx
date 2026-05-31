import { useEffect, useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AssetItem, AssetStatus } from "@/lib/domain";
import { ASSET_CLASS_OPTIONS_BY_GROUP } from "@/lib/asset-catalog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, SelectLabel } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CalendarPlus, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate, useParams } from "react-router-dom";

const STATUS_COLORS: Record<AssetStatus, string> = {
  IN_USE: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  IN_STORE: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  UNDER_REPAIR: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  DISPOSED: "bg-slate-500/10 text-slate-600 border-slate-500/20"
};

type AssetFormState = {
  assetClass: string;
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
  return value.slice(0, 10);
}

function toFormState(asset?: AssetItem | null): AssetFormState {
  if (!asset) return EMPTY_FORM;
  return {
    assetClass: asset.assetClass,
    markModel: asset.markModel ?? "",
    dateOfPurchase: toDateInputValue(asset.dateOfPurchase),
    warrantyPeriod: asset.warrantyPeriod ?? "",
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
  const [dateOfMoving, setDateOfMoving] = useState("");
  const [movedToUser, setMovedToUser] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.addAssetMovement(assetId, {
        movedToProjectNumber: movedToProjectNumber.trim() || null,
        dateOfMoving: new Date(dateOfMoving).toISOString(),
        movedToUser: movedToUser.trim() || null
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
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>Save Movement</Button>
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
        sellAmount: toNumber(sellAmount)
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
    }
  }, [open]);

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
          </div>
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

      return api.updateAsset(id, {
        assetClass: form.assetClass,
        markModel: form.markModel.trim() || null,
        dateOfPurchase: form.dateOfPurchase ? new Date(form.dateOfPurchase).toISOString() : null,
        warrantyPeriod: form.warrantyPeriod.trim() || null,
        purchaseAmount: toNumber(form.purchaseAmount),
        gst: toNumber(form.gst),
        projectNumber: form.projectNumber.trim() || null,
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
  const editingDepreciation = useMemo(() => {
    if (!form.assetClass) {
      return null;
    }

    const usefulLifeYears = form.assetClass === "Bike - Owned" ? 5 : form.assetClass === "Car - Owned" ? 8 : 10;
    const purchaseAmount = toNumber(form.purchaseAmount);
    const scrapValue = Number((purchaseAmount * 0.05).toFixed(2));
    const depreciationPerYear = usefulLifeYears > 0 ? Number(((purchaseAmount - scrapValue) / usefulLifeYears).toFixed(2)) : 0;
    const purchaseYear = form.dateOfPurchase ? new Date(form.dateOfPurchase).getFullYear() : new Date().getFullYear();
    const yearsElapsed = Math.max(new Date().getFullYear() - purchaseYear, 0);
    const currentValue = Number((purchaseAmount - depreciationPerYear * yearsElapsed).toFixed(2));

    return { usefulLifeYears, scrapValue, depreciationPerYear, yearsElapsed, currentValue };
  }, [form.assetClass, form.dateOfPurchase, form.purchaseAmount]);

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

  return (
    <PageWrapper>
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/administrative/assets")} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <span className={`status-badge border ${STATUS_COLORS[asset.status]}`}>{asset.status.replace(/_/g, " ")}</span>
          </div>
          <h1 className="page-title">{asset.assetId}</h1>
          <p className="page-subtitle">{asset.assetClass}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setMovementOpen(true)} className="gap-2"><CalendarPlus className="h-4 w-4" /> Log Movement</Button>
          <Button variant="outline" onClick={() => setMaintenanceOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Log Maintenance</Button>
          <Button onClick={() => setIsEditing((current) => !current)} className="gap-2"><Pencil className="h-4 w-4" /> {isEditing ? "Cancel Edit" : "Edit Asset"}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1fr] gap-6">
        <div className="glass-panel-strong p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Asset Information</h3>
            {!isEditing && <span className={`status-badge border ${STATUS_COLORS[asset.status]}`}>{asset.status.replace(/_/g, " ")}</span>}
          </div>

          {isEditing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Asset Class</Label>
                <Select value={form.assetClass} onValueChange={(value) => setForm((prev) => ({ ...prev, assetClass: value }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select asset class" /></SelectTrigger>
                  <SelectContent>
                    {ASSET_CLASS_OPTIONS_BY_GROUP.map((group) => (
                      <SelectGroup key={group.group}>
                        <SelectLabel>{group.group}</SelectLabel>
                        {group.options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Mark / Model</Label><Input value={form.markModel} onChange={(event) => setForm((prev) => ({ ...prev, markModel: event.target.value }))} className="mt-1" /></div>
              <div><Label>IT Asset ID</Label><Input value={form.itAssetId} onChange={(event) => setForm((prev) => ({ ...prev, itAssetId: event.target.value }))} className="mt-1" /></div>
              <div><Label>Date of Purchase</Label><Input type="date" value={form.dateOfPurchase} onChange={(event) => setForm((prev) => ({ ...prev, dateOfPurchase: event.target.value }))} className="mt-1" /></div>
              <div><Label>Warranty Period</Label><Input value={form.warrantyPeriod} onChange={(event) => setForm((prev) => ({ ...prev, warrantyPeriod: event.target.value }))} className="mt-1" /></div>
              <div><Label>Purchase Amount</Label><Input type="number" min="0" value={form.purchaseAmount} onChange={(event) => setForm((prev) => ({ ...prev, purchaseAmount: event.target.value }))} className="mt-1" /></div>
              <div><Label>GST</Label><Input type="number" min="0" value={form.gst} onChange={(event) => setForm((prev) => ({ ...prev, gst: event.target.value }))} className="mt-1" /></div>
              <div><Label>Total Amount with GST</Label><Input readOnly value={totalAmount} className="mt-1 bg-secondary/40" /></div>
              <div><Label>Useful Life (years)</Label><Input readOnly value={editingDepreciation ? String(editingDepreciation.usefulLifeYears) : "-"} className="mt-1 bg-secondary/40" /></div>
              <div><Label>Depreciation / Year</Label><Input readOnly value={editingDepreciation ? formatCurrency(editingDepreciation.depreciationPerYear) : "-"} className="mt-1 bg-secondary/40" /></div>
              <div><Label>Current Value</Label><Input readOnly value={editingDepreciation ? formatCurrency(editingDepreciation.currentValue) : "-"} className="mt-1 bg-secondary/40" /></div>
              <div><Label>Project Number</Label><Input value={form.projectNumber} onChange={(event) => setForm((prev) => ({ ...prev, projectNumber: event.target.value }))} className="mt-1" /></div>
              <div><Label>Assigned User</Label><Input value={form.assignedUser} onChange={(event) => setForm((prev) => ({ ...prev, assignedUser: event.target.value }))} className="mt-1" /></div>
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as AssetStatus }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["IN_USE", "IN_STORE", "UNDER_REPAIR", "DISPOSED"] as AssetStatus[]).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>For Month</Label><Input value={form.forMonth} onChange={(event) => setForm((prev) => ({ ...prev, forMonth: event.target.value }))} className="mt-1" /></div>
              <div className="md:col-span-2"><Label>Remarks</Label><Textarea value={form.remarks} onChange={(event) => setForm((prev) => ({ ...prev, remarks: event.target.value }))} className="mt-1 min-h-24" /></div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setIsEditing(false); setForm(toFormState(asset)); }}>Cancel</Button>
                <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>Save Changes</Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Asset ID" value={asset.assetId} />
              <Field label="IT Asset ID" value={asset.itAssetId ?? "-"} />
              <Field label="Asset Class" value={asset.assetClass} />
              <Field label="Mark / Model" value={asset.markModel ?? "-"} />
              <Field label="Date of Purchase" value={asset.dateOfPurchase ? new Date(asset.dateOfPurchase).toLocaleDateString("en-IN") : "-"} />
              <Field label="Warranty Period" value={asset.warrantyPeriod ?? "-"} />
              <Field label="Purchase Amount" value={`₹${asset.purchaseAmount.toLocaleString("en-IN")}`} />
              <Field label="GST" value={`₹${asset.gst.toLocaleString("en-IN")}`} />
              <Field label="Total Amount with GST" value={`₹${asset.totalAmountWithGst.toLocaleString("en-IN")}`} />
              <Field label="Useful Life (years)" value={String(asset.usefulLifeYears)} />
              <Field label="Scrap Value (5%)" value={formatCurrency(asset.scrapValue)} />
              <Field label="Depreciation / Year" value={formatCurrency(asset.depreciationPerYear)} />
              <Field label="Current Value" value={formatCurrency(asset.currentValue)} />
              <Field label="Project Number" value={asset.projectNumber ?? "-"} />
              <Field label="Assigned User" value={asset.assignedUser ?? "-"} />
              <Field label="For Month" value={asset.forMonth ?? "-"} />
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
                <Button onClick={() => setMovementOpen(true)} className="gap-2"><CalendarPlus className="h-4 w-4" /> Log Movement</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date of Moving</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Moved To Project</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Moved To User</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(asset.movements ?? []).length === 0 ? (
                      <tr><td colSpan={3} className="py-8 text-center text-muted-foreground">No movement history.</td></tr>
                    ) : asset.movements!.map((movement) => (
                      <tr key={movement.id} className="border-b border-border/20">
                        <td className="py-3 px-4">{new Date(movement.dateOfMoving).toLocaleDateString("en-IN")}</td>
                        <td className="py-3 px-4">{movement.movedToProjectNumber ?? "-"}</td>
                        <td className="py-3 px-4">{movement.movedToUser ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
            <TabsContent value="maintenance">
              <div className="flex justify-end mb-3">
                <Button onClick={() => setMaintenanceOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Log Maintenance</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Repair Cost (incl. GST)</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Depreciation Till Date</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Sell Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(asset.maintenances ?? []).length === 0 ? (
                      <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No maintenance records.</td></tr>
                    ) : asset.maintenances!.map((maintenance) => (
                      <tr key={maintenance.id} className="border-b border-border/20">
                        <td className="py-3 px-4">{new Date(maintenance.dateOfMaintenance).toLocaleDateString("en-IN")}</td>
                        <td className="py-3 px-4">₹{maintenance.repairCostInclGst.toLocaleString("en-IN")}</td>
                        <td className="py-3 px-4">₹{maintenance.depreciationTillDate.toLocaleString("en-IN")}</td>
                        <td className="py-3 px-4">₹{maintenance.sellAmount.toLocaleString("en-IN")}</td>
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
