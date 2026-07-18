import { infraRepository } from "../repositories/infra.repository.js";
import { badRequest, notFound } from "../utils/errors.js";

const INFRA_SUB_UNITS = new Set(["IE", "AE", "PM", "TP"]);

function getProjectSubTechnicalUnitCode(projectNumber?: string | null) {
  const number = projectNumber?.trim().toUpperCase();
  if (!number || number.length < 4) return null;
  const candidate = number.slice(2, 4);
  return INFRA_SUB_UNITS.has(candidate) ? candidate : null;
}

function getProjectLifecycle(assignments: Array<{ demobilizedAt: Date | null }>) {
  if (assignments.length === 0) return "ONGOING" as const;
  return assignments.every((assignment) => assignment.demobilizedAt !== null) ? ("COMPLETED" as const) : ("ONGOING" as const);
}

function money(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function calcAssignmentAmount(monthlyCost?: number | null, daysWorked?: number | null) {
  const month = money(monthlyCost);
  const days = money(daysWorked);
  return Number(((month / 30) * days).toFixed(2));
}

function withFinancials<
  T extends {
    assignments: Array<{
      daysWorked: number | null;
      actualAmount?: number | null;
      drawnAmount?: number | null;
      teamMember: { monthlyCost: number | null };
    }>;
    infraOtherCosts?: Array<{
      actualAmount?: number | null;
      drawnAmount?: number | null;
    }>;
  }
>(project: T) {
  const assignments = project.assignments.map((assignment) => {
    const estimatedAmount = calcAssignmentAmount(assignment.teamMember.monthlyCost, assignment.daysWorked);
    const actualAmount = assignment.actualAmount ?? null;
    const drawnAmount = assignment.drawnAmount ?? null;
    const profitLoss = Number((money(drawnAmount) - money(actualAmount)).toFixed(2));
    return {
      ...assignment,
      amount: estimatedAmount,
      estimatedAmount,
      actualAmount,
      drawnAmount,
      profitLoss
    };
  });

  const otherCosts = (project.infraOtherCosts ?? []).map((cost) => ({
    ...cost,
    profitLoss: Number((money(cost.drawnAmount) - money(cost.actualAmount)).toFixed(2))
  }));

  const staffEstimatedTotal = Number(assignments.reduce((sum, item) => sum + item.estimatedAmount, 0).toFixed(2));
  const staffActualTotal = Number(assignments.reduce((sum, item) => sum + money(item.actualAmount), 0).toFixed(2));
  const staffDrawnTotal = Number(assignments.reduce((sum, item) => sum + money(item.drawnAmount), 0).toFixed(2));
  const otherActualTotal = Number(otherCosts.reduce((sum, item) => sum + money(item.actualAmount), 0).toFixed(2));
  const otherDrawnTotal = Number(otherCosts.reduce((sum, item) => sum + money(item.drawnAmount), 0).toFixed(2));

  const totalActualAmount = Number((staffActualTotal + otherActualTotal).toFixed(2));
  const totalDrawnAmount = Number((staffDrawnTotal + otherDrawnTotal).toFixed(2));
  const totalProfitLoss = Number((totalDrawnAmount - totalActualAmount).toFixed(2));
  // Back-compat: totalCost was estimated staff cost; keep for existing UI/PDF
  const totalCost = staffEstimatedTotal;

  return {
    ...project,
    assignments,
    infraOtherCosts: otherCosts,
    totalCost,
    staffEstimatedTotal,
    staffActualTotal,
    staffDrawnTotal,
    otherActualTotal,
    otherDrawnTotal,
    totalActualAmount,
    totalDrawnAmount,
    totalProfitLoss
  };
}

export const infraService = {
  async overview() {
    const projects = await infraRepository.findProjects();
    const teamMembers = await infraRepository.findTeamMembers();

    const filtered = projects.filter((project) => getProjectSubTechnicalUnitCode(project.projectNumber));
    const ongoingProjects = filtered.filter((project) => getProjectLifecycle(project.assignments) === "ONGOING").length;
    const completedProjects = filtered.filter((project) => getProjectLifecycle(project.assignments) === "COMPLETED").length;
    const withCosts = filtered.map((project) => withFinancials(project));
    const totalStaffCost = Number(withCosts.reduce((sum, project) => sum + project.totalCost, 0).toFixed(2));
    const totalActualAmount = Number(withCosts.reduce((sum, project) => sum + project.totalActualAmount, 0).toFixed(2));
    const totalDrawnAmount = Number(withCosts.reduce((sum, project) => sum + project.totalDrawnAmount, 0).toFixed(2));
    const totalProfitLoss = Number((totalDrawnAmount - totalActualAmount).toFixed(2));

    const byUnit = ["IE", "AE", "PM", "TP"].map((code) => ({
      code,
      count: filtered.filter((project) => getProjectSubTechnicalUnitCode(project.projectNumber) === code).length
    }));

    return {
      totalProjects: filtered.length,
      ongoingProjects,
      completedProjects,
      byUnit,
      teamMembers: teamMembers.length,
      mobilizedTeamMembers: teamMembers.filter((member) => member.mobilizedAt && !member.demobilizedAt).length,
      totalStaffCost,
      totalActualAmount,
      totalDrawnAmount,
      totalProfitLoss
    };
  },
  async listProjects() {
    const projects = await infraRepository.findProjects();
    return projects
      .filter((project) => getProjectSubTechnicalUnitCode(project.projectNumber))
      .map((project) => {
        const enriched = withFinancials(project);
        return {
          ...enriched,
          subTechnicalUnitCode: getProjectSubTechnicalUnitCode(project.projectNumber),
          lifecycle: getProjectLifecycle(project.assignments),
          activeAssignments: project.assignments.filter((assignment) => assignment.demobilizedAt === null).length
        };
      });
  },
  async getProject(id: string) {
    const project = await infraRepository.findProjectById(id);
    if (!project) throw notFound("Project not found");
    const enriched = withFinancials(project);
    return {
      ...enriched,
      subTechnicalUnitCode: getProjectSubTechnicalUnitCode(project.projectNumber),
      lifecycle: getProjectLifecycle(project.assignments),
      activeAssignments: project.assignments.filter((assignment) => assignment.demobilizedAt === null).length
    };
  },
  listTeamMembers() {
    return infraRepository.findTeamMembers();
  },
  async createTeamMember(payload: {
    name: string;
    email?: string | null;
    phone?: string | null;
    manpowerGroup: string;
    manpowerRole: string;
    monthlyCost?: number | null;
    notes?: string | null;
  }) {
    if (!payload.name.trim()) throw badRequest("Name is required");
    return infraRepository.createTeamMember({
      name: payload.name.trim(),
      email: payload.email?.trim() || null,
      phone: payload.phone?.trim() || null,
      manpowerGroup: payload.manpowerGroup,
      manpowerRole: payload.manpowerRole.trim(),
      monthlyCost: payload.monthlyCost ?? null,
      notes: payload.notes?.trim() || null
    });
  },
  async updateTeamMember(
    id: string,
    payload: {
      name?: string;
      email?: string | null;
      phone?: string | null;
      manpowerGroup?: string;
      manpowerRole?: string;
      monthlyCost?: number | null;
      notes?: string | null;
    }
  ) {
    const member = await infraRepository.findTeamMemberById(id);
    if (!member) throw notFound("Team member not found");
    return infraRepository.updateTeamMember(id, {
      name: payload.name?.trim(),
      email: payload.email === undefined ? undefined : payload.email?.trim() || null,
      phone: payload.phone === undefined ? undefined : payload.phone?.trim() || null,
      manpowerGroup: payload.manpowerGroup,
      manpowerRole: payload.manpowerRole?.trim(),
      monthlyCost: payload.monthlyCost === undefined ? undefined : payload.monthlyCost,
      notes: payload.notes === undefined ? undefined : payload.notes?.trim() || null
    });
  },
  async removeTeamMember(id: string) {
    const member = await infraRepository.findTeamMemberById(id);
    if (!member) throw notFound("Team member not found");
    return infraRepository.deleteTeamMember(id);
  },
  async assignProject(
    projectId: string,
    payload: {
      teamMemberId?: string;
      teamMemberIds?: string[];
      mode?: "assign" | "mobilize";
      mobilizedAt?: string | null;
      daysWorked?: number | null;
    }
  ) {
    const project = await infraRepository.findProjectById(projectId);
    if (!project) throw notFound("Project not found");
    if (!getProjectSubTechnicalUnitCode(project.projectNumber)) {
      throw badRequest("This project is not an Infra project (IE / AE / PM / TP)");
    }

    const mode = payload.mode ?? (payload.mobilizedAt ? "mobilize" : "assign");
    const memberIds = Array.from(
      new Set([...(payload.teamMemberIds ?? []), ...(payload.teamMemberId ? [payload.teamMemberId] : [])])
    );
    if (memberIds.length === 0) throw badRequest("Select at least one team member");

    let mobilizedAt: Date | null = null;
    if (mode === "mobilize") {
      if (!payload.mobilizedAt) throw badRequest("Please select a mobilization date");
      mobilizedAt = new Date(payload.mobilizedAt);
      if (Number.isNaN(mobilizedAt.getTime())) throw badRequest("Please select a valid mobilization date");
    }

    const activeByMember = new Map(
      project.assignments
        .filter((assignment) => assignment.demobilizedAt === null)
        .map((assignment) => [assignment.teamMemberId, assignment] as const)
    );

    const results = [];
    for (const teamMemberId of memberIds) {
      const teamMember = await infraRepository.findTeamMemberById(teamMemberId);
      if (!teamMember) throw notFound(`Team member not found (${teamMemberId})`);

      const activeAssignment = activeByMember.get(teamMemberId);

      if (mode === "assign") {
        if (activeAssignment) {
          throw badRequest(`${teamMember.name} is already assigned to this project`);
        }
        const assignment = await infraRepository.createAssignment({
          projectId,
          teamMemberId,
          mobilizedAt: null,
          daysWorked: payload.daysWorked ?? null
        });
        await infraRepository.updateTeamMember(teamMember.id, {
          currentProject: project.name,
          demobilizedAt: null
        });
        activeByMember.set(teamMemberId, assignment as (typeof project.assignments)[number]);
        results.push(assignment);
        continue;
      }

      // mobilize
      if (activeAssignment) {
        if (activeAssignment.mobilizedAt) {
          throw badRequest(`${teamMember.name} is already mobilized on this project`);
        }
        const updated = await infraRepository.updateAssignment(activeAssignment.id, {
          mobilizedAt
        });
        await infraRepository.updateTeamMember(teamMember.id, {
          currentProject: project.name,
          mobilizedAt,
          demobilizedAt: null
        });
        activeByMember.set(teamMemberId, { ...activeAssignment, mobilizedAt } as (typeof project.assignments)[number]);
        results.push(updated);
        continue;
      }

      const assignment = await infraRepository.createAssignment({
        projectId,
        teamMemberId,
        mobilizedAt,
        daysWorked: payload.daysWorked ?? null
      });
      await infraRepository.updateTeamMember(teamMember.id, {
        currentProject: project.name,
        mobilizedAt,
        demobilizedAt: null
      });
      activeByMember.set(teamMemberId, assignment as (typeof project.assignments)[number]);
      results.push(assignment);
    }

    return results.length === 1 ? results[0] : results;
  },
  async updateAssignment(
    id: string,
    payload: {
      mobilizedAt?: string | null;
      demobilizedAt?: string | null;
      daysWorked?: number | null;
      actualAmount?: number | null;
      drawnAmount?: number | null;
    }
  ) {
    const assignment = await infraRepository.findAssignmentById(id);
    if (!assignment) throw notFound("Assignment not found");

    const nextMobilizedAt =
      payload.mobilizedAt === undefined ? undefined : payload.mobilizedAt ? new Date(payload.mobilizedAt) : null;
    const nextDemobilizedAt =
      payload.demobilizedAt === undefined ? undefined : payload.demobilizedAt ? new Date(payload.demobilizedAt) : null;

    if (nextMobilizedAt !== undefined && nextMobilizedAt && Number.isNaN(nextMobilizedAt.getTime())) {
      throw badRequest("Please select a valid mobilization date");
    }
    if (nextDemobilizedAt !== undefined && nextDemobilizedAt && Number.isNaN(nextDemobilizedAt.getTime())) {
      throw badRequest("Please select a valid demobilization date");
    }

    const effectiveMobilizedAt = nextMobilizedAt === undefined ? assignment.mobilizedAt : nextMobilizedAt;
    if (nextDemobilizedAt && effectiveMobilizedAt && nextDemobilizedAt < effectiveMobilizedAt) {
      throw badRequest("Demobilization date cannot be before mobilization date");
    }

    const updated = await infraRepository.updateAssignment(id, {
      mobilizedAt: nextMobilizedAt,
      demobilizedAt: nextDemobilizedAt,
      daysWorked: payload.daysWorked === undefined ? undefined : payload.daysWorked,
      actualAmount: payload.actualAmount === undefined ? undefined : payload.actualAmount,
      drawnAmount: payload.drawnAmount === undefined ? undefined : payload.drawnAmount
    });

    if (payload.demobilizedAt !== undefined) {
      await infraRepository.updateTeamMember(assignment.teamMemberId, {
        currentProject: nextDemobilizedAt ? null : assignment.project.name,
        demobilizedAt: nextDemobilizedAt,
        mobilizedAt: nextMobilizedAt
      });
    } else if (payload.mobilizedAt !== undefined) {
      await infraRepository.updateTeamMember(assignment.teamMemberId, {
        mobilizedAt: nextMobilizedAt,
        currentProject: assignment.project.name
      });
    }

    return updated;
  },

  async createOtherCost(
    projectId: string,
    payload: { description: string; actualAmount?: number | null; drawnAmount?: number | null }
  ) {
    const project = await infraRepository.findProjectById(projectId);
    if (!project) throw notFound("Project not found");
    if (!getProjectSubTechnicalUnitCode(project.projectNumber)) {
      throw badRequest("This project is not an Infra project (IE / AE / PM / TP)");
    }
    const description = payload.description.trim();
    if (!description) throw badRequest("Description is required");
    return infraRepository.createOtherCost({
      projectId,
      description,
      actualAmount: payload.actualAmount ?? null,
      drawnAmount: payload.drawnAmount ?? null
    });
  },

  async updateOtherCost(
    id: string,
    payload: Partial<{ description: string; actualAmount: number | null; drawnAmount: number | null }>
  ) {
    const cost = await infraRepository.findOtherCostById(id);
    if (!cost) throw notFound("Other cost not found");
    return infraRepository.updateOtherCost(id, {
      description: payload.description?.trim(),
      actualAmount: payload.actualAmount === undefined ? undefined : payload.actualAmount,
      drawnAmount: payload.drawnAmount === undefined ? undefined : payload.drawnAmount
    });
  },

  async removeOtherCost(id: string) {
    const cost = await infraRepository.findOtherCostById(id);
    if (!cost) throw notFound("Other cost not found");
    await infraRepository.deleteOtherCost(id);
    return { deleted: true };
  }
};
