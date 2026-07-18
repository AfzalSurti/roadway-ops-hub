import { useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import type { InfraOtherCostItem } from "@/lib/domain";
import {
  calcInfraAmount,
  downloadInfraProjectBillExcel,
  downloadInfraProjectBillPdf,
  downloadInfraProjectsSummaryExcel,
  downloadInfraProjectsSummaryPdf
} from "@/lib/infra-financial-export";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, FileText, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

function formatInr(value: number) {
  return `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseOptionalMoney(raw: string | undefined, fallback: number | null | undefined) {
  if (raw === undefined) return { touched: false as const, value: fallback ?? null };
  if (raw.trim() === "") return { touched: true as const, value: null };
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("Enter a valid non-negative amount");
  return { touched: true as const, value: Number(parsed.toFixed(2)) };
}

function plTone(value: number) {
  if (value > 0) return "text-emerald-600";
  if (value < 0) return "text-red-500";
  return "text-muted-foreground";
}

function MonitorStat({
  label,
  value,
  emphasize
}: {
  label: string;
  value: number;
  emphasize?: "profit" | "loss" | "neutral";
}) {
  const tone =
    emphasize === "profit" ? "text-emerald-600" : emphasize === "loss" ? "text-red-500" : "text-foreground";
  return (
    <div className="rounded-xl border border-border/40 bg-secondary/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-base font-semibold tabular-nums ${tone}`}>{formatInr(value)}</p>
    </div>
  );
}

export default function InfraFinancial() {
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState<string>("");
  const [daysByAssignment, setDaysByAssignment] = useState<Record<string, string>>({});
  const [costByMember, setCostByMember] = useState<Record<string, string>>({});
  const [actualByAssignment, setActualByAssignment] = useState<Record<string, string>>({});
  const [drawnByAssignment, setDrawnByAssignment] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [otherDraft, setOtherDraft] = useState({ description: "", actualAmount: "", drawnAmount: "" });
  const [otherEdits, setOtherEdits] = useState<Record<string, { description?: string; actualAmount?: string; drawnAmount?: string }>>({});

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["infra-projects"],
    queryFn: () => api.getInfraProjects()
  });

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === projectId) ?? null,
    [projects, projectId]
  );

  const rows = useMemo(() => {
    if (!selectedProject) return [];
    return selectedProject.assignments.map((assignment, index) => {
      const monthlyCostRaw = costByMember[assignment.teamMemberId];
      const monthlyCost =
        monthlyCostRaw !== undefined
          ? monthlyCostRaw.trim() === ""
            ? null
            : Number(monthlyCostRaw)
          : assignment.teamMember.monthlyCost ?? null;
      const daysRaw = daysByAssignment[assignment.id];
      const daysWorked =
        daysRaw !== undefined
          ? daysRaw.trim() === ""
            ? null
            : Number(daysRaw)
          : assignment.daysWorked ?? null;
      const estimatedAmount = calcInfraAmount(
        Number.isFinite(monthlyCost as number) ? monthlyCost : assignment.teamMember.monthlyCost,
        Number.isFinite(daysWorked as number) ? daysWorked : assignment.daysWorked
      );

      const actualRaw = actualByAssignment[assignment.id];
      const actualAmount =
        actualRaw !== undefined
          ? actualRaw.trim() === ""
            ? null
            : Number(actualRaw)
          : assignment.actualAmount ?? null;
      const drawnRaw = drawnByAssignment[assignment.id];
      const drawnAmount =
        drawnRaw !== undefined
          ? drawnRaw.trim() === ""
            ? null
            : Number(drawnRaw)
          : assignment.drawnAmount ?? null;
      const profitLoss = Number(((Number(drawnAmount) || 0) - (Number(actualAmount) || 0)).toFixed(2));

      return {
        assignment,
        sr: index + 1,
        monthlyCost: Number.isFinite(monthlyCost as number) || monthlyCost === null ? monthlyCost : assignment.teamMember.monthlyCost ?? null,
        daysWorked: Number.isFinite(daysWorked as number) || daysWorked === null ? daysWorked : assignment.daysWorked ?? null,
        estimatedAmount,
        actualAmount: Number.isFinite(actualAmount as number) || actualAmount === null ? actualAmount : assignment.actualAmount ?? null,
        drawnAmount: Number.isFinite(drawnAmount as number) || drawnAmount === null ? drawnAmount : assignment.drawnAmount ?? null,
        profitLoss
      };
    });
  }, [selectedProject, daysByAssignment, costByMember, actualByAssignment, drawnByAssignment]);

  const otherCosts = selectedProject?.infraOtherCosts ?? [];

  const totals = useMemo(() => {
    const staffEstimated = Number(rows.reduce((sum, row) => sum + row.estimatedAmount, 0).toFixed(2));
    const staffActual = Number(rows.reduce((sum, row) => sum + (Number(row.actualAmount) || 0), 0).toFixed(2));
    const staffDrawn = Number(rows.reduce((sum, row) => sum + (Number(row.drawnAmount) || 0), 0).toFixed(2));
    const otherActual = Number(
      otherCosts.reduce((sum, cost) => {
        const edit = otherEdits[cost.id]?.actualAmount;
        const value = edit !== undefined ? (edit.trim() === "" ? 0 : Number(edit) || 0) : Number(cost.actualAmount) || 0;
        return sum + value;
      }, 0).toFixed(2)
    );
    const otherDrawn = Number(
      otherCosts.reduce((sum, cost) => {
        const edit = otherEdits[cost.id]?.drawnAmount;
        const value = edit !== undefined ? (edit.trim() === "" ? 0 : Number(edit) || 0) : Number(cost.drawnAmount) || 0;
        return sum + value;
      }, 0).toFixed(2)
    );
    const totalActual = Number((staffActual + otherActual).toFixed(2));
    const totalDrawn = Number((staffDrawn + otherDrawn).toFixed(2));
    const profitLoss = Number((totalDrawn - totalActual).toFixed(2));
    return { staffEstimated, staffActual, staffDrawn, otherActual, otherDrawn, totalActual, totalDrawn, profitLoss };
  }, [rows, otherCosts, otherEdits]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["infra-projects"] }),
      queryClient.invalidateQueries({ queryKey: ["infra-project"] }),
      queryClient.invalidateQueries({ queryKey: ["infra-team"] }),
      queryClient.invalidateQueries({ queryKey: ["infra-overview"] })
    ]);
  };

  const saveRowMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      if (!selectedProject) throw new Error("Select a project first");
      const assignment = selectedProject.assignments.find((item) => item.id === assignmentId);
      if (!assignment) throw new Error("Assignment not found");

      const costRaw = costByMember[assignment.teamMemberId];
      const daysRaw = daysByAssignment[assignmentId];
      const actualParsed = parseOptionalMoney(actualByAssignment[assignmentId], assignment.actualAmount);
      const drawnParsed = parseOptionalMoney(drawnByAssignment[assignmentId], assignment.drawnAmount);

      let monthlyCost: number | null | undefined = undefined;
      if (costRaw !== undefined) {
        if (costRaw.trim() === "") monthlyCost = null;
        else {
          const parsed = Number(costRaw);
          if (!Number.isFinite(parsed) || parsed < 0) throw new Error("Enter a valid monthly cost");
          monthlyCost = Number(parsed.toFixed(2));
        }
      }

      let daysWorked: number | null | undefined = undefined;
      if (daysRaw !== undefined) {
        if (daysRaw.trim() === "") daysWorked = null;
        else {
          const parsed = Number(daysRaw);
          if (!Number.isFinite(parsed) || parsed < 0 || parsed > 366) {
            throw new Error("Days worked must be between 0 and 366");
          }
          daysWorked = Number(parsed.toFixed(2));
        }
      }

      setSavingId(assignmentId);
      if (monthlyCost !== undefined) {
        await api.updateInfraTeamMember(assignment.teamMemberId, { monthlyCost });
      }
      await api.updateInfraProjectAssignment(selectedProject.id, assignmentId, {
        ...(daysWorked !== undefined ? { daysWorked } : {}),
        ...(actualParsed.touched || actualByAssignment[assignmentId] !== undefined
          ? { actualAmount: actualParsed.value }
          : {}),
        ...(drawnParsed.touched || drawnByAssignment[assignmentId] !== undefined
          ? { drawnAmount: drawnParsed.value }
          : {})
      });
    },
    onSuccess: async () => {
      toast.success("Saved staff monitoring amounts");
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to save"),
    onSettled: () => setSavingId(null)
  });

  const addOtherMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProject) throw new Error("Select a project first");
      if (!otherDraft.description.trim()) throw new Error("Description is required");
      const actual = otherDraft.actualAmount.trim() === "" ? null : Number(otherDraft.actualAmount);
      const drawn = otherDraft.drawnAmount.trim() === "" ? null : Number(otherDraft.drawnAmount);
      if (actual !== null && (!Number.isFinite(actual) || actual < 0)) throw new Error("Invalid actual amount");
      if (drawn !== null && (!Number.isFinite(drawn) || drawn < 0)) throw new Error("Invalid drawn amount");
      return api.createInfraOtherCost(selectedProject.id, {
        description: otherDraft.description.trim(),
        actualAmount: actual === null ? null : Number(actual.toFixed(2)),
        drawnAmount: drawn === null ? null : Number(drawn.toFixed(2))
      });
    },
    onSuccess: async () => {
      toast.success("Other cost added");
      setOtherDraft({ description: "", actualAmount: "", drawnAmount: "" });
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to add cost")
  });

  const saveOtherMutation = useMutation({
    mutationFn: async (cost: InfraOtherCostItem) => {
      if (!selectedProject) throw new Error("Select a project first");
      const edit = otherEdits[cost.id] ?? {};
      const description = edit.description ?? cost.description;
      const actualParsed = parseOptionalMoney(edit.actualAmount, cost.actualAmount);
      const drawnParsed = parseOptionalMoney(edit.drawnAmount, cost.drawnAmount);
      if (!description.trim()) throw new Error("Description is required");
      return api.updateInfraOtherCost(selectedProject.id, cost.id, {
        description: description.trim(),
        actualAmount: actualParsed.value,
        drawnAmount: drawnParsed.value
      });
    },
    onSuccess: async (_data, cost) => {
      toast.success("Other cost saved");
      setOtherEdits((prev) => {
        const next = { ...prev };
        delete next[cost.id];
        return next;
      });
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to save cost")
  });

  const deleteOtherMutation = useMutation({
    mutationFn: (costId: string) => {
      if (!selectedProject) throw new Error("Select a project first");
      return api.deleteInfraOtherCost(selectedProject.id, costId);
    },
    onSuccess: async () => {
      toast.success("Other cost removed");
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to delete")
  });

  const buildBillData = () => {
    if (!selectedProject) throw new Error("Select a project first");
    return {
      projectName: selectedProject.name,
      projectNumber: selectedProject.projectNumber || "",
      unitCode: selectedProject.subTechnicalUnitCode,
      lines: rows.map((row) => ({
        sr: row.sr,
        name: row.assignment.teamMember.name,
        email: row.assignment.teamMember.email || "",
        role: row.assignment.teamMember.manpowerRole,
        monthlyCost: row.monthlyCost,
        daysWorked: row.daysWorked,
        amount: row.estimatedAmount,
        actualAmount: row.actualAmount,
        drawnAmount: row.drawnAmount,
        profitLoss: row.profitLoss
      })),
      otherCosts: otherCosts.map((cost, index) => ({
        sr: index + 1,
        description: cost.description,
        actualAmount: cost.actualAmount ?? null,
        drawnAmount: cost.drawnAmount ?? null,
        profitLoss: Number(((Number(cost.drawnAmount) || 0) - (Number(cost.actualAmount) || 0)).toFixed(2))
      })),
      totalAmount: totals.staffEstimated,
      totalActualAmount: totals.totalActual,
      totalDrawnAmount: totals.totalDrawn,
      totalProfitLoss: totals.profitLoss
    };
  };

  const handleProjectPdf = async () => {
    try {
      await downloadInfraProjectBillPdf(buildBillData());
      toast.success("Project monitoring PDF downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate PDF");
    }
  };

  const handleProjectExcel = () => {
    try {
      downloadInfraProjectBillExcel(buildBillData());
      toast.success("Project monitoring Excel downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate Excel");
    }
  };

  const handleSummaryPdf = async () => {
    try {
      await downloadInfraProjectsSummaryPdf(
        projects.map((project, index) => ({
          sr: index + 1,
          projectName: project.name,
          projectNumber: project.projectNumber || "",
          unitCode: project.subTechnicalUnitCode,
          totalAmount: project.totalActualAmount ?? 0,
          totalDrawnAmount: project.totalDrawnAmount ?? 0,
          totalProfitLoss: project.totalProfitLoss ?? 0
        }))
      );
      toast.success("All-projects summary PDF downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate summary PDF");
    }
  };

  const handleSummaryExcel = () => {
    try {
      downloadInfraProjectsSummaryExcel(
        projects.map((project, index) => ({
          sr: index + 1,
          projectName: project.name,
          projectNumber: project.projectNumber || "",
          unitCode: project.subTechnicalUnitCode,
          totalAmount: project.totalActualAmount ?? 0,
          totalDrawnAmount: project.totalDrawnAmount ?? 0,
          totalProfitLoss: project.totalProfitLoss ?? 0
        }))
      );
      toast.success("All-projects summary Excel downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate summary Excel");
    }
  };

  const resetLocal = () => {
    setDaysByAssignment({});
    setCostByMember({});
    setActualByAssignment({});
    setDrawnByAssignment({});
    setOtherEdits({});
    setOtherDraft({ description: "", actualAmount: "", drawnAmount: "" });
  };

  return (
    <PageWrapper>
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title">Infra Financial Monitoring</h1>
          <p className="page-subtitle">
            Actual (paid to staff/vendors) vs Drawn (received from government). Profit when Drawn &gt; Actual.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => void handleSummaryPdf()}>
            <FileText className="h-4 w-4" />
            All Projects PDF
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleSummaryExcel}>
            <FileSpreadsheet className="h-4 w-4" />
            All Projects Excel
          </Button>
        </div>
      </div>

      <div className="glass-panel p-4 mb-6 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="w-full md:max-w-md">
          <p className="text-xs text-muted-foreground mb-1.5">Select Project</p>
          <Select
            value={projectId}
            onValueChange={(value) => {
              setProjectId(value);
              resetLocal();
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={loadingProjects ? "Loading projects..." : "Choose infra project"} />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {(project.projectNumber || "No number") + " — " + project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="gap-2" disabled={!selectedProject} onClick={() => void handleProjectPdf()}>
            <Download className="h-4 w-4" />
            Generate PDF
          </Button>
          <Button variant="secondary" className="gap-2" disabled={!selectedProject} onClick={handleProjectExcel}>
            <FileSpreadsheet className="h-4 w-4" />
            Generate Excel
          </Button>
        </div>
      </div>

      {!selectedProject ? (
        <div className="glass-panel p-10 text-center text-muted-foreground">
          Select a project to monitor actual vs drawn amounts and profit / loss.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="glass-panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="font-semibold text-lg">{selectedProject.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedProject.projectNumber || "No project number"} · {selectedProject.subTechnicalUnitCode || "-"}
                </p>
              </div>
              <Badge
                variant="secondary"
                className={`rounded-full text-sm px-3 py-1 ${plTone(totals.profitLoss)}`}
              >
                {totals.profitLoss > 0 ? "Profit" : totals.profitLoss < 0 ? "Loss" : "Break-even"}:{" "}
                {formatInr(Math.abs(totals.profitLoss))}
              </Badge>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MonitorStat label="Estimated Staff (ref.)" value={totals.staffEstimated} />
              <MonitorStat label="Total Actual Given" value={totals.totalActual} />
              <MonitorStat label="Total Drawn (Govt.)" value={totals.totalDrawn} />
              <MonitorStat
                label="Project Profit / Loss"
                value={totals.profitLoss}
                emphasize={totals.profitLoss > 0 ? "profit" : totals.profitLoss < 0 ? "loss" : "neutral"}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Estimated = (monthly ÷ 30) × days. Actual = paid out. Drawn = received. P/L = Drawn − Actual.
              Other costs (vehicle, etc.) are included in project totals.
            </p>
          </div>

          <div className="glass-panel p-6">
            <h4 className="font-semibold mb-3">Staff Cost Monitoring</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1280px]">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground">
                    <th className="py-3 pr-3 text-left font-medium">Sr.</th>
                    <th className="py-3 px-3 text-left font-medium">Employee</th>
                    <th className="py-3 px-3 text-left font-medium">Email</th>
                    <th className="py-3 px-3 text-right font-medium">Per Month</th>
                    <th className="py-3 px-3 text-right font-medium">Days</th>
                    <th className="py-3 px-3 text-right font-medium">Estimated</th>
                    <th className="py-3 px-3 text-right font-medium">Actual Given</th>
                    <th className="py-3 px-3 text-right font-medium">Drawn (Govt.)</th>
                    <th className="py-3 px-3 text-right font-medium">P/L</th>
                    <th className="py-3 pl-3 text-right font-medium">Save</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-muted-foreground">
                        No employees assigned to this project yet.
                      </td>
                    </tr>
                  ) : null}
                  {rows.map((row) => (
                    <tr key={row.assignment.id} className="border-b border-border/20">
                      <td className="py-3 pr-3">{row.sr}</td>
                      <td className="py-3 px-3">
                        <p className="font-medium">{row.assignment.teamMember.name}</p>
                        <p className="text-xs text-muted-foreground">{row.assignment.teamMember.manpowerRole}</p>
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">{row.assignment.teamMember.email || "-"}</td>
                      <td className="py-3 px-3 text-right">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          className="ml-auto w-[120px] text-right"
                          placeholder="Optional"
                          value={
                            costByMember[row.assignment.teamMemberId] ??
                            (row.assignment.teamMember.monthlyCost != null
                              ? String(row.assignment.teamMember.monthlyCost)
                              : "")
                          }
                          onChange={(e) =>
                            setCostByMember((prev) => ({ ...prev, [row.assignment.teamMemberId]: e.target.value }))
                          }
                        />
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Input
                          type="number"
                          min={0}
                          max={366}
                          step="0.5"
                          className="ml-auto w-[90px] text-right"
                          placeholder="0"
                          value={
                            daysByAssignment[row.assignment.id] ??
                            (row.assignment.daysWorked != null ? String(row.assignment.daysWorked) : "")
                          }
                          onChange={(e) =>
                            setDaysByAssignment((prev) => ({ ...prev, [row.assignment.id]: e.target.value }))
                          }
                        />
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-muted-foreground">
                        {formatInr(row.estimatedAmount)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          className="ml-auto w-[120px] text-right"
                          placeholder="Optional"
                          value={
                            actualByAssignment[row.assignment.id] ??
                            (row.assignment.actualAmount != null ? String(row.assignment.actualAmount) : "")
                          }
                          onChange={(e) =>
                            setActualByAssignment((prev) => ({ ...prev, [row.assignment.id]: e.target.value }))
                          }
                        />
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          className="ml-auto w-[120px] text-right"
                          placeholder="Optional"
                          value={
                            drawnByAssignment[row.assignment.id] ??
                            (row.assignment.drawnAmount != null ? String(row.assignment.drawnAmount) : "")
                          }
                          onChange={(e) =>
                            setDrawnByAssignment((prev) => ({ ...prev, [row.assignment.id]: e.target.value }))
                          }
                        />
                      </td>
                      <td className={`py-3 px-3 text-right font-medium tabular-nums ${plTone(row.profitLoss)}`}>
                        {formatInr(row.profitLoss)}
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          disabled={saveRowMutation.isPending && savingId === row.assignment.id}
                          onClick={() => saveRowMutation.mutate(row.assignment.id)}
                        >
                          {savingId === row.assignment.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                          Save
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {rows.length > 0 ? (
                  <tfoot>
                    <tr className="border-t border-border/40">
                      <td colSpan={5} className="py-3 text-right font-semibold">
                        Staff totals
                      </td>
                      <td className="py-3 px-3 text-right font-semibold tabular-nums">{formatInr(totals.staffEstimated)}</td>
                      <td className="py-3 px-3 text-right font-semibold tabular-nums">{formatInr(totals.staffActual)}</td>
                      <td className="py-3 px-3 text-right font-semibold tabular-nums">{formatInr(totals.staffDrawn)}</td>
                      <td className={`py-3 px-3 text-right font-bold tabular-nums ${plTone(totals.staffDrawn - totals.staffActual)}`}>
                        {formatInr(totals.staffDrawn - totals.staffActual)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          </div>

          <div className="glass-panel p-6 space-y-4">
            <div>
              <h4 className="font-semibold">Other Project Costs</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Vehicle, equipment, misc. — description + optional actual / drawn. Nothing compulsory except description when adding.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <Input
                className="md:col-span-2"
                placeholder="Description (e.g. Vehicle hire)"
                value={otherDraft.description}
                onChange={(e) => setOtherDraft((prev) => ({ ...prev, description: e.target.value }))}
              />
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="Actual (optional)"
                value={otherDraft.actualAmount}
                onChange={(e) => setOtherDraft((prev) => ({ ...prev, actualAmount: e.target.value }))}
              />
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Drawn (optional)"
                  value={otherDraft.drawnAmount}
                  onChange={(e) => setOtherDraft((prev) => ({ ...prev, drawnAmount: e.target.value }))}
                />
                <Button
                  className="gap-1 shrink-0"
                  disabled={addOtherMutation.isPending || !otherDraft.description.trim()}
                  onClick={() => addOtherMutation.mutate()}
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground">
                    <th className="py-2 pr-3 text-left font-medium">Description</th>
                    <th className="py-2 px-3 text-right font-medium">Actual</th>
                    <th className="py-2 px-3 text-right font-medium">Drawn</th>
                    <th className="py-2 px-3 text-right font-medium">P/L</th>
                    <th className="py-2 pl-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {otherCosts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        No other costs yet.
                      </td>
                    </tr>
                  ) : null}
                  {otherCosts.map((cost) => {
                    const edit = otherEdits[cost.id] ?? {};
                    const actual =
                      edit.actualAmount !== undefined
                        ? edit.actualAmount.trim() === ""
                          ? 0
                          : Number(edit.actualAmount) || 0
                        : Number(cost.actualAmount) || 0;
                    const drawn =
                      edit.drawnAmount !== undefined
                        ? edit.drawnAmount.trim() === ""
                          ? 0
                          : Number(edit.drawnAmount) || 0
                        : Number(cost.drawnAmount) || 0;
                    const pl = Number((drawn - actual).toFixed(2));
                    return (
                      <tr key={cost.id} className="border-b border-border/20">
                        <td className="py-2 pr-3">
                          <Input
                            value={edit.description ?? cost.description}
                            onChange={(e) =>
                              setOtherEdits((prev) => ({
                                ...prev,
                                [cost.id]: { ...prev[cost.id], description: e.target.value }
                              }))
                            }
                          />
                        </td>
                        <td className="py-2 px-3 text-right">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            className="ml-auto w-[120px] text-right"
                            placeholder="Optional"
                            value={
                              edit.actualAmount ??
                              (cost.actualAmount != null ? String(cost.actualAmount) : "")
                            }
                            onChange={(e) =>
                              setOtherEdits((prev) => ({
                                ...prev,
                                [cost.id]: { ...prev[cost.id], actualAmount: e.target.value }
                              }))
                            }
                          />
                        </td>
                        <td className="py-2 px-3 text-right">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            className="ml-auto w-[120px] text-right"
                            placeholder="Optional"
                            value={
                              edit.drawnAmount ??
                              (cost.drawnAmount != null ? String(cost.drawnAmount) : "")
                            }
                            onChange={(e) =>
                              setOtherEdits((prev) => ({
                                ...prev,
                                [cost.id]: { ...prev[cost.id], drawnAmount: e.target.value }
                              }))
                            }
                          />
                        </td>
                        <td className={`py-2 px-3 text-right font-medium tabular-nums ${plTone(pl)}`}>
                          {formatInr(pl)}
                        </td>
                        <td className="py-2 pl-3 text-right">
                          <div className="inline-flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={saveOtherMutation.isPending}
                              onClick={() => saveOtherMutation.mutate(cost)}
                            >
                              <Save className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={deleteOtherMutation.isPending}
                              onClick={() => {
                                if (window.confirm("Remove this other cost?")) {
                                  deleteOtherMutation.mutate(cost.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {otherCosts.length > 0 ? (
                  <tfoot>
                    <tr className="border-t border-border/40">
                      <td className="py-3 font-semibold">Other costs total</td>
                      <td className="py-3 px-3 text-right font-semibold tabular-nums">{formatInr(totals.otherActual)}</td>
                      <td className="py-3 px-3 text-right font-semibold tabular-nums">{formatInr(totals.otherDrawn)}</td>
                      <td className={`py-3 px-3 text-right font-bold tabular-nums ${plTone(totals.otherDrawn - totals.otherActual)}`}>
                        {formatInr(totals.otherDrawn - totals.otherActual)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Project Actual Total</p>
                <p className="font-semibold tabular-nums mt-1">{formatInr(totals.totalActual)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Project Drawn Total</p>
                <p className="font-semibold tabular-nums mt-1">{formatInr(totals.totalDrawn)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Project Profit / Loss</p>
                <p className={`font-bold tabular-nums mt-1 ${plTone(totals.profitLoss)}`}>
                  {totals.profitLoss >= 0 ? "+" : ""}
                  {formatInr(totals.profitLoss)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
