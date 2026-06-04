import { useEffect, useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AssetItem, AssetStatus, ProjectItem } from "@/lib/domain";
import { ASSET_CLASS_GROUP_OPTIONS, ASSET_CLASS_OPTIONS, getAssetClassGroup } from "@/lib/asset-catalog";
import { AssetCatalogManager } from "@/components/AssetCatalogManager";
import { AssetImportDialog } from "@/components/AssetImportDialog";
import { IN_STORE_PROJECT_LABEL, SURVEY_EQUIPMENT_CLASS, useAssetCatalog } from "@/hooks/useAssetCatalog";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Download, Eye, FileUp, Pencil, Plus, RefreshCcw, Search, Settings2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
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
  { label: "IN USE", value: "IN_USE" },
  { label: "IN STORE", value: "IN_STORE" },
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
  projectName: string;
  customProjectNumber: string;
  customProjectName: string;
  assignedUser: string;
  assignedDate: string;
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
  projectName: "",
  customProjectNumber: "",
  customProjectName: "",
  assignedUser: "",
  assignedDate: "",
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

function resolveAssetClass(form: AssetFormState) {
  return form.assetClass === "Other" ? form.customAssetClass.trim() : form.assetClass;
}

function isSurveyEquipmentClass(form: AssetFormState) {
  return resolveAssetClass(form) === SURVEY_EQUIPMENT_CLASS;
}

function formatWarrantyEndDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN");
}

function toFormState(asset: AssetItem | null | undefined, classOptions: string[], getTypesForClass: (assetClass: string) => string[]): AssetFormState {
  if (!asset) return EMPTY_FORM;
  const normalizedClass = classOptions.includes(asset.assetClass) ? asset.assetClass : "Other";
  const typeOptions = getTypesForClass(normalizedClass);
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
    projectName: asset.projectName ?? "",
    customProjectNumber: "",
    customProjectName: "",
    assignedUser: asset.assignedUser ?? "",
    assignedDate: toDateInputValue(asset.assignedDate),
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
  return status === "DISPOSED" ? "SOLD" : status.replace(/_/g, " ");
}

function isInStoreProjectValue(value?: string | null) {
  return value?.trim().toUpperCase() === IN_STORE_PROJECT_LABEL;
}

function formatAssetProjectNumber(asset: AssetItem) {
  if (asset.status === "IN_STORE" || isInStoreProjectValue(asset.projectNumber)) {
    return "-";
  }
  return asset.projectNumber ?? "-";
}

function formatAssetProjectName(asset: AssetItem, projects: ProjectItem[]) {
  if (asset.status === "IN_STORE" || isInStoreProjectValue(asset.projectName) || isInStoreProjectValue(asset.projectNumber)) {
    return "-";
  }
  return asset.projectName ?? getProjectNameByNumber(projects, asset.projectNumber) ?? "-";
}

function formatCurrency(value: number) {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatSoldAmount(asset: AssetItem) {
  if (asset.status !== "DISPOSED") {
    return "-";
  }
  const amount = asset.soldAmount ?? 0;
  return amount > 0 ? formatCurrency(amount) : "-";
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
  classOptions,
  getTypesForClass,
  onSaved
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: AssetItem | null;
  projects: ProjectItem[];
  assets: AssetItem[];
  classOptions: string[];
  getTypesForClass: (assetClass: string) => string[];
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AssetFormState>(EMPTY_FORM);
  const [projectInputMode, setProjectInputMode] = useState<"select" | "other">("select");
  const [userInputMode, setUserInputMode] = useState<"select" | "other">("select");

  const typeOptions = useMemo(() => {
    const builtIn = getTypesForClass(form.assetClass);
    const dynamic = assets
      .filter((item) => item.assetClass === (form.assetClass === "Other" ? form.customAssetClass.trim() : form.assetClass))
      .map((item) => item.assetType)
      .filter(Boolean);

    return Array.from(new Set([...builtIn, ...dynamic]));
  }, [assets, form.assetClass, form.customAssetClass, getTypesForClass]);

  const selectedProjectName = useMemo(
    () => form.projectName || getProjectNameByNumber(projects, form.projectNumber.trim() || null),
    [form.projectNumber, form.projectName, projects]
  );

  const projectOptions = useMemo(() => {
    const fromProjects = projects
      .filter((project) => project.projectNumber || project.name)
      .map((project) => ({
        number: project.projectNumber ?? "",
        name: project.name ?? "",
        value: `${project.projectNumber ?? ""}|||${project.name ?? ""}`
      }));
    const fromAssets = assets
      .filter((item) => item.projectNumber || item.projectName)
      .map((item) => ({
        number: item.projectNumber ?? "",
        name: item.projectName ?? getProjectNameByNumber(projects, item.projectNumber) ?? "",
        value: `${item.projectNumber ?? ""}|||${item.projectName ?? getProjectNameByNumber(projects, item.projectNumber) ?? ""}`
      }));
    const deduped = new Map<string, { number: string; name: string; value: string }>();
    [...fromProjects, ...fromAssets].forEach((item) => {
      if (item.number || item.name) deduped.set(item.value, item);
    });
    return Array.from(deduped.values()).sort((a, b) => `${a.number} ${a.name}`.localeCompare(`${b.number} ${b.name}`));
  }, [projects, assets]);

  const userOptions = useMemo(
    () => Array.from(new Set(assets.map((item) => item.assignedUser).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)),
    [assets]
  );

  useEffect(() => {
    if (open) {
      setForm(toFormState(asset, classOptions, getTypesForClass));
      if (asset && ((!asset.projectNumber && asset.projectName) || (asset.projectNumber && asset.projectName && !projectOptions.some((item) => item.number === asset.projectNumber && item.name === asset.projectName)))) {
        setProjectInputMode("other");
        setForm((prev) => ({ ...prev, customProjectNumber: asset.projectNumber ?? "", customProjectName: asset.projectName ?? "" }));
      } else {
        setProjectInputMode("select");
      }
      setUserInputMode(asset?.assignedUser && !userOptions.includes(asset.assignedUser) ? "other" : "select");
    }
  }, [asset, open, projectOptions, userOptions, classOptions, getTypesForClass]);

  const surveyEquipment = isSurveyEquipmentClass(form);
  const effectiveStatus: AssetStatus = surveyEquipment ? form.status : "IN_USE";

  useEffect(() => {
    if (!surveyEquipment && form.status !== "IN_USE") {
      setForm((prev) => ({
        ...prev,
        status: "IN_USE",
        projectNumber: prev.projectNumber,
        projectName: prev.projectName
      }));
    }
  }, [surveyEquipment, form.status]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (form.warrantyPeriod && form.dateOfPurchase && isDateBefore(form.warrantyPeriod, form.dateOfPurchase)) {
        throw new Error("Warranty end date cannot be before the date of purchase");
      }

      const payload = {
        assetClass: resolveAssetClass(form),
        assetType: form.assetType === "Other" ? form.customAssetType.trim() : form.assetType,
        markModel: form.markModel.trim() || null,
        dateOfPurchase: form.dateOfPurchase ? new Date(form.dateOfPurchase).toISOString() : null,
        warrantyPeriod: form.warrantyPeriod.trim() || null,
        purchaseAmount: toNumber(form.purchaseAmount),
        gst: toNumber(form.gst),
        assignedDate: form.assignedDate ? new Date(form.assignedDate).toISOString() : null,
        status: effectiveStatus,
        projectNumber: effectiveStatus === "IN_USE" ? ((projectInputMode === "other" ? form.customProjectNumber : form.projectNumber).trim() || null) : null,
        projectName: effectiveStatus === "IN_USE" ? ((projectInputMode === "other" ? form.customProjectName : selectedProjectName).trim() || null) : null,
        assignedUser: effectiveStatus === "IN_USE" ? form.assignedUser.trim() || null : null,
        remarks: form.remarks.trim() || null,
        itAssetId: form.itAssetId.trim() || null
      };

      return asset
        ? api.updateAsset(asset.id, { ...payload, status: effectiveStatus })
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
            <Select
              value={form.assetClass}
              onValueChange={(value) => {
                const nextClass = value === "Other" ? "" : value;
                const isSurvey = nextClass === SURVEY_EQUIPMENT_CLASS;
                setForm((prev) => ({
                  ...prev,
                  assetClass: value,
                  assetType: "",
                  customAssetClass: value === "Other" ? prev.customAssetClass : "",
                  customAssetType: "",
                  status: isSurvey ? prev.status : "IN_USE",
                  ...(isSurvey
                    ? {}
                    : {
                        projectNumber: prev.projectNumber,
                        projectName: prev.projectName
                      })
                }));
              }}
            >
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

          {!asset ? (
            <div>
              <Label>Status</Label>
              {surveyEquipment ? (
                <Select
                  value={form.status}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      status: value as AssetStatus,
                      projectNumber: value === "IN_STORE" ? "" : prev.projectNumber,
                      projectName: value === "IN_STORE" ? "" : prev.projectName,
                      customProjectNumber: value === "IN_STORE" ? "" : prev.customProjectNumber,
                      customProjectName: value === "IN_STORE" ? "" : prev.customProjectName,
                      assignedUser: value === "IN_STORE" ? "" : prev.assignedUser,
                      assignedDate: value === "IN_STORE" ? "" : prev.assignedDate
                    }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN_USE">IN USE</SelectItem>
                    <SelectItem value="IN_STORE">IN STORE</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input value="IN USE" readOnly className="mt-1 bg-secondary/40" />
              )}
            </div>
          ) : null}

          {effectiveStatus === "IN_USE" ? (
            <>
          <div>
            <Label>Project Number</Label>
              <Select
                value={projectInputMode === "other" ? "__OTHER__" : (projectOptions.find((item) => item.number === form.projectNumber && item.name === form.projectName)?.value ?? "__NONE__")}
                onValueChange={(value) => {
                  if (value === "__NONE__") {
                    setProjectInputMode("select");
                    setForm((prev) => ({ ...prev, projectNumber: "", projectName: "", customProjectNumber: "", customProjectName: "" }));
                    return;
                  }
                  if (value === "__OTHER__") {
                    setProjectInputMode("other");
                    setForm((prev) => ({ ...prev, projectNumber: "", projectName: "", customProjectNumber: prev.customProjectNumber, customProjectName: prev.customProjectName }));
                    return;
                  }
                  setProjectInputMode("select");
                  const [projectNumber, projectName] = value.split("|||");
                  setForm((prev) => ({ ...prev, projectNumber, projectName: projectName ?? "", customProjectNumber: "", customProjectName: "" }));
                }}
              >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="__NONE__">None</SelectItem>
                  {projectOptions.map((project) => (
                    <SelectItem key={project.value} value={project.value}>
                      {project.number || "-"} - {project.name || "-"}
                    </SelectItem>
                  ))}
                  <SelectItem value="__OTHER__">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Project Name</Label>
            <Input value={projectInputMode === "other" ? form.customProjectName : selectedProjectName || "-"} readOnly={projectInputMode !== "other"} onChange={(event) => setForm((prev) => ({ ...prev, customProjectName: event.target.value }))} className={`mt-1 ${projectInputMode !== "other" ? "bg-secondary/40" : ""}`} />
          </div>
          {projectInputMode === "other" ? (
            <div>
              <Label>Other Project Number</Label>
              <Input value={form.customProjectNumber} onChange={(event) => setForm((prev) => ({ ...prev, customProjectNumber: event.target.value }))} className="mt-1" />
            </div>
          ) : null}
          <div>
            <Label>Assigned User</Label>
            <Select
              value={userInputMode === "other" ? "__OTHER__" : (form.assignedUser || "__NONE__")}
              onValueChange={(value) => {
                if (value === "__NONE__") {
                  setUserInputMode("select");
                  setForm((prev) => ({ ...prev, assignedUser: "" }));
                  return;
                }
                if (value === "__OTHER__") {
                  setUserInputMode("other");
                  setForm((prev) => ({ ...prev, assignedUser: "" }));
                  return;
                }
                setUserInputMode("select");
                setForm((prev) => ({ ...prev, assignedUser: value }));
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__NONE__">None</SelectItem>
                {userOptions.map((user) => (
                  <SelectItem key={user} value={user}>{user}</SelectItem>
                ))}
                <SelectItem value="__OTHER__">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Assigned Date</Label>
            <Input
              type="date"
              value={form.assignedDate}
              onChange={(event) => setForm((prev) => ({ ...prev, assignedDate: event.target.value }))}
              className="mt-1"
            />
          </div>
          {userInputMode === "other" ? (
            <div>
              <Label>Other User</Label>
              <Input value={form.assignedUser} onChange={(event) => setForm((prev) => ({ ...prev, assignedUser: event.target.value }))} className="mt-1" />
            </div>
          ) : null}
            </>
          ) : null}
          {asset ? (
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as AssetStatus }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.filter((item) => {
                    if (item.value === "ALL") return false;
                    if (item.value === "IN_STORE" && !surveyEquipment) return false;
                    return true;
                  }).map((option) => (
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
              (effectiveStatus === "IN_USE" && projectInputMode !== "other" && !form.projectNumber.trim()) ||
              (effectiveStatus === "IN_USE" &&
                projectInputMode === "other" &&
                (!form.customProjectNumber.trim() || !form.customProjectName.trim())) ||
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
  const [assetTypeFilter, setAssetTypeFilter] = useState("ALL");
  const [userFilter, setUserFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<AssetStatus | "ALL">("ALL");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetItem | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<AssetItem | null>(null);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [catalogManagerOpen, setCatalogManagerOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { catalog, classOptions, getTypesForClass } = useAssetCatalog();

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.getProjects()
  });

  const deleteMutation = useMutation({
    mutationFn: (assetId: string) => api.deleteAsset(assetId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["assets"] }),
        queryClient.invalidateQueries({ queryKey: ["assets", "stats"] })
      ]);
      toast.success("Asset deleted");
      setAssetToDelete(null);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to delete asset")
  });

  const { data: assetsResponse, refetch } = useQuery({
    queryKey: ["assets", search, groupFilter, statusFilter],
    queryFn: () =>
      api.getAssets({
        limit: 500,
        search: search.trim() || undefined,
        assetClass: groupFilter === "All" ? undefined : groupFilter,
        status: statusFilter === "ALL" ? undefined : statusFilter
      })
  });

  const assets = assetsResponse?.items ?? [];

  const projectOptions = useMemo(() => {
    const fromProjects = projects
      .filter((project) => project.projectNumber || project.name)
      .map((project) => ({
        number: project.projectNumber ?? "",
        name: project.name ?? "",
        value: `${project.projectNumber ?? ""}|||${project.name ?? ""}`
      }));

    const fromAssets = assets
      .filter(
        (asset) =>
          asset.status !== "IN_STORE" &&
          !isInStoreProjectValue(asset.projectNumber) &&
          !isInStoreProjectValue(asset.projectName) &&
          (asset.projectNumber || asset.projectName)
      )
      .map((asset) => ({
        number: asset.projectNumber ?? "",
        name: asset.projectName ?? getProjectNameByNumber(projects, asset.projectNumber) ?? "",
        value: `${asset.projectNumber ?? ""}|||${asset.projectName ?? getProjectNameByNumber(projects, asset.projectNumber) ?? ""}`
      }));

    const deduped = new Map<string, { number: string; name: string; value: string }>();
    [...fromProjects, ...fromAssets].forEach((item) => {
      if (item.number || item.name) {
        deduped.set(item.value, item);
      }
    });

    return Array.from(deduped.values()).sort((a, b) =>
      `${a.number} ${a.name}`.localeCompare(`${b.number} ${b.name}`, undefined, { sensitivity: "base" })
    );
  }, [assets, projects]);

  const assetTypeOptions = useMemo(
    () => Array.from(new Set(assets.map((asset) => asset.assetType).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [assets]
  );

  const userOptions = useMemo(
    () => Array.from(new Set(assets.map((asset) => asset.assignedUser).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)),
    [assets]
  );

  const filteredAssets = useMemo(() => {
    const filtered = assets.filter((asset) => {
      const groupOk = groupFilter === "All" || getAssetClassGroup(asset.assetClass) === groupFilter;
      const projectValue = `${asset.projectNumber ?? ""}|||${asset.projectName ?? getProjectNameByNumber(projects, asset.projectNumber) ?? ""}`;
      const projectOk = projectFilter === "ALL" || projectValue === projectFilter;
      const typeOk = assetTypeFilter === "ALL" || asset.assetType === assetTypeFilter;
      const userOk = userFilter === "ALL" || (asset.assignedUser ?? "") === userFilter;
      return groupOk && projectOk && typeOk && userOk;
    });

    return filtered.sort((a, b) => {
      const projectA = `${a.projectNumber ?? ""} ${a.projectName ?? ""}`;
      const projectB = `${b.projectNumber ?? ""} ${b.projectName ?? ""}`;
      const projectCompare = projectA.localeCompare(projectB, undefined, { sensitivity: "base" });
      if (projectCompare !== 0) return projectCompare;
      return a.assetId.localeCompare(b.assetId, undefined, { sensitivity: "base" });
    });
  }, [assets, groupFilter, projectFilter, assetTypeFilter, userFilter, projects]);

  const amountTotals = useMemo(() => {
    return filteredAssets.reduce(
      (totals, asset) => ({
        purchaseAmount: totals.purchaseAmount + (asset.purchaseAmount ?? 0),
        totalAmountWithGst: totals.totalAmountWithGst + (asset.totalAmountWithGst ?? 0),
        soldAmount: totals.soldAmount + (asset.status === "DISPOSED" ? asset.soldAmount ?? 0 : 0),
        currentValue: totals.currentValue + (asset.currentValue ?? 0)
      }),
      { purchaseAmount: 0, totalAmountWithGst: 0, soldAmount: 0, currentValue: 0 }
    );
  }, [filteredAssets]);

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
      "Project Name": asset.projectName ?? getProjectNameByNumber(projects, asset.projectNumber) ?? "",
      User: asset.assignedUser ?? "",
      Status: asset.status === "DISPOSED" ? "SOLD" : asset.status,
      Remarks: asset.remarks ?? ""
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: ["#", "Asset Class", "Asset Type", "Date of Purchase", "Mark/Model", "Warranty End Date", "Purchase Amount", "GST", "Total Amount with GST", "Asset ID", "IT Asset ID", "Project Number", "Project Name", "User", "Status", "Remarks"]
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Assets");
    XLSX.writeFile(workbook, "asset-management.xlsx");
  };

  const resetFilters = () => {
    setSearch("");
    setGroupFilter("All");
    setProjectFilter("ALL");
    setAssetTypeFilter("ALL");
    setUserFilter("ALL");
    setStatusFilter("ALL");
  };

  return (
    <PageWrapper>
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title">Asset Management</h1>
          <p className="page-subtitle">Track stock, movement history, maintenance and allocation.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setCatalogManagerOpen(true)} className="gap-2">
            <Settings2 className="h-4 w-4" /> Asset Class & Type Setup
          </Button>
          <Button variant="outline" onClick={() => setImportDialogOpen(true)} className="gap-2">
            <FileUp className="h-4 w-4" /> Import Excel
          </Button>
          <Button variant="outline" onClick={createExport} className="gap-2">
            <Download className="h-4 w-4" /> Export Excel
          </Button>
          <Button onClick={() => { setEditingAsset(null); setIsEditorOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Add Asset
          </Button>
        </div>
      </div>

      <div className="glass-panel p-4 mb-6 grid grid-cols-1 lg:grid-cols-6 gap-3">
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
            <SelectValue placeholder="Project Number / Name" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Projects</SelectItem>
            {projectOptions.map((project) => (
              <SelectItem key={project.value} value={project.value}>
                {project.number || "-"} - {project.name || "-"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={assetTypeFilter} onValueChange={setAssetTypeFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Asset Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Asset Types</SelectItem>
            {assetTypeOptions.map((assetType) => (
              <SelectItem key={assetType} value={assetType}>{assetType}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={userFilter} onValueChange={setUserFilter}>
          <SelectTrigger>
            <SelectValue placeholder="User" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Users</SelectItem>
            {userOptions.map((user) => (
              <SelectItem key={user} value={user}>{user}</SelectItem>
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

        <Button variant="outline" onClick={resetFilters} className="gap-2">
          <RefreshCcw className="h-4 w-4" /> Refresh
        </Button>
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
              <th className="text-right py-3 px-4 font-medium text-muted-foreground">Asset Purchase Amount</th>
              <th className="text-right py-3 px-4 font-medium text-muted-foreground">Total Amount</th>
              <th className="text-right py-3 px-4 font-medium text-muted-foreground">Asset Sold Amount</th>
              <th className="text-right py-3 px-4 font-medium text-muted-foreground">Current Asset Value</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Project</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Project Name</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">User</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAssets.length === 0 ? (
              <tr>
                <td colSpan={14} className="py-10 text-center text-muted-foreground">No assets found.</td>
              </tr>
            ) : (
              filteredAssets.map((asset) => (
                <tr key={asset.id} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                  <td className="py-3 px-4 font-medium">{asset.assetId}</td>
                  <td className="py-3 px-4">{asset.assetClass}</td>
                  <td className="py-3 px-4">{asset.assetType}</td>
                  <td className="py-3 px-4">{asset.markModel ?? "-"}</td>
                  <td className="py-3 px-4">{asset.dateOfPurchase ? new Date(asset.dateOfPurchase).toLocaleDateString("en-IN") : "-"}</td>
                  <td className="py-3 px-4 text-right tabular-nums">{formatCurrency(asset.purchaseAmount)}</td>
                  <td className="py-3 px-4 text-right tabular-nums">{formatCurrency(asset.totalAmountWithGst)}</td>
                  <td className="py-3 px-4 text-right tabular-nums">{formatSoldAmount(asset)}</td>
                  <td className="py-3 px-4 text-right tabular-nums">{formatCurrency(asset.currentValue)}</td>
                  <td className="py-3 px-4">{formatAssetProjectNumber(asset)}</td>
                  <td className="py-3 px-4">{formatAssetProjectName(asset, projects)}</td>
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
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 border-red-500/40 text-red-500 hover:bg-red-500/10 hover:text-red-600"
                        onClick={() => setAssetToDelete(asset)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
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
          {filteredAssets.length > 0 ? (
            <tfoot>
              <tr className="border-t border-border/50 bg-secondary/30 font-semibold">
                <td colSpan={5} className="py-3 px-4 text-right text-muted-foreground">
                  Total ({filteredAssets.length} assets)
                </td>
                <td className="py-3 px-4 text-right tabular-nums">{formatCurrency(amountTotals.purchaseAmount)}</td>
                <td className="py-3 px-4 text-right tabular-nums">{formatCurrency(amountTotals.totalAmountWithGst)}</td>
                <td className="py-3 px-4 text-right tabular-nums">{formatCurrency(amountTotals.soldAmount)}</td>
                <td className="py-3 px-4 text-right tabular-nums">{formatCurrency(amountTotals.currentValue)}</td>
                <td colSpan={5} />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <AssetEditorDialog
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        asset={editingAsset}
        projects={projects}
        assets={assets}
        classOptions={classOptions}
        getTypesForClass={getTypesForClass}
        onSaved={() => void refetch()}
      />

      <AssetCatalogManager open={catalogManagerOpen} onOpenChange={setCatalogManagerOpen} catalog={catalog} />
      <AssetImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />

      <AlertDialog open={Boolean(assetToDelete)} onOpenChange={(open) => !open && setAssetToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete asset</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this asset?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (assetToDelete) {
                  deleteMutation.mutate(assetToDelete.id);
                }
              }}
            >
              {deleteMutation.isPending ? "Deleting..." : "Yes, delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageWrapper>
  );
}
