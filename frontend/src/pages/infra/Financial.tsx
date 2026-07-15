import { useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import {
  calcInfraAmount,
  downloadInfraProjectBillExcel,
  downloadInfraProjectBillPdf,
  downloadInfraProjectsSummaryExcel,
  downloadInfraProjectsSummaryPdf
} from "@/lib/infra-financial-export";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, FileText, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

function formatInr(value: number) {
  return `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function InfraFinancial() {
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState<string>("");
  const [daysByAssignment, setDaysByAssignment] = useState<Record<string, string>>({});
  const [costByMember, setCostByMember] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

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
      const amount = calcInfraAmount(
        Number.isFinite(monthlyCost as number) ? monthlyCost : assignment.teamMember.monthlyCost,
        Number.isFinite(daysWorked as number) ? daysWorked : assignment.daysWorked
      );
      return {
        assignment,
        sr: index + 1,
        monthlyCost: Number.isFinite(monthlyCost as number) || monthlyCost === null ? monthlyCost : assignment.teamMember.monthlyCost ?? null,
        daysWorked: Number.isFinite(daysWorked as number) || daysWorked === null ? daysWorked : assignment.daysWorked ?? null,
        amount
      };
    });
  }, [selectedProject, daysByAssignment, costByMember]);

  const totalAmount = useMemo(
    () => Number(rows.reduce((sum, row) => sum + row.amount, 0).toFixed(2)),
    [rows]
  );

  const saveRowMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      if (!selectedProject) throw new Error("Select a project first");
      const assignment = selectedProject.assignments.find((item) => item.id === assignmentId);
      if (!assignment) throw new Error("Assignment not found");

      const costRaw = costByMember[assignment.teamMemberId];
      const daysRaw = daysByAssignment[assignmentId];

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
      if (daysWorked !== undefined) {
        await api.updateInfraProjectAssignment(selectedProject.id, assignmentId, { daysWorked });
      }
    },
    onSuccess: async () => {
      toast.success("Saved staff cost details");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["infra-projects"] }),
        queryClient.invalidateQueries({ queryKey: ["infra-team"] }),
        queryClient.invalidateQueries({ queryKey: ["infra-overview"] })
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to save"),
    onSettled: () => setSavingId(null)
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
        amount: row.amount
      })),
      totalAmount
    };
  };

  const handleProjectPdf = async () => {
    try {
      await downloadInfraProjectBillPdf(buildBillData());
      toast.success("Project bill PDF downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate PDF");
    }
  };

  const handleProjectExcel = () => {
    try {
      downloadInfraProjectBillExcel(buildBillData());
      toast.success("Project bill Excel downloaded");
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
          totalAmount: project.totalCost ?? 0
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
          totalAmount: project.totalCost ?? 0
        }))
      );
      toast.success("All-projects summary Excel downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate summary Excel");
    }
  };

  return (
    <PageWrapper>
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title">Infra Financial</h1>
          <p className="page-subtitle">Staff cost by project — amount = (monthly cost ÷ 30) × days worked.</p>
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
          <Select value={projectId} onValueChange={(value) => {
            setProjectId(value);
            setDaysByAssignment({});
            setCostByMember({});
          }}>
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
          Select a project to view assigned employees and calculate staff costs.
        </div>
      ) : (
        <div className="glass-panel p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-semibold text-lg">{selectedProject.name}</h3>
              <p className="text-sm text-muted-foreground">
                {selectedProject.projectNumber || "No project number"} · {selectedProject.subTechnicalUnitCode || "-"}
              </p>
            </div>
            <Badge variant="secondary" className="rounded-full text-sm px-3 py-1">
              Total: {formatInr(totalAmount)}
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[980px]">
              <thead>
                <tr className="border-b border-border/40 text-muted-foreground">
                  <th className="py-3 pr-3 text-left font-medium">Sr.</th>
                  <th className="py-3 px-3 text-left font-medium">Employee</th>
                  <th className="py-3 px-3 text-left font-medium">Email</th>
                  <th className="py-3 px-3 text-right font-medium">Per Month Cost</th>
                  <th className="py-3 px-3 text-right font-medium">No. of Days</th>
                  <th className="py-3 px-3 text-right font-medium">Amount</th>
                  <th className="py-3 pl-3 text-right font-medium">Save</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-muted-foreground">
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
                        className="ml-auto w-[130px] text-right"
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
                        className="ml-auto w-[110px] text-right"
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
                    <td className="py-3 px-3 text-right font-medium tabular-nums">{formatInr(row.amount)}</td>
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
                    <td colSpan={5} className="py-3 pr-3 text-right font-semibold">
                      Total
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-primary tabular-nums">{formatInr(totalAmount)}</td>
                    <td />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
