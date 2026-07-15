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

function calcAssignmentAmount(monthlyCost?: number | null, daysWorked?: number | null) {
  const month = typeof monthlyCost === "number" && Number.isFinite(monthlyCost) ? monthlyCost : 0;
  const days = typeof daysWorked === "number" && Number.isFinite(daysWorked) ? daysWorked : 0;
  return Number(((month / 30) * days).toFixed(2));
}

function withFinancials<T extends { assignments: Array<{ daysWorked: number | null; teamMember: { monthlyCost: number | null } }> }>(project: T) {
  const assignments = project.assignments.map((assignment) => ({
    ...assignment,
    amount: calcAssignmentAmount(assignment.teamMember.monthlyCost, assignment.daysWorked)
  }));
  const totalCost = Number(assignments.reduce((sum, item) => sum + item.amount, 0).toFixed(2));
  return { ...project, assignments, totalCost };
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
      totalStaffCost
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
  async assignProject(projectId: string, payload: { teamMemberId: string; mobilizedAt?: string | null; daysWorked?: number | null }) {
    const project = await infraRepository.findProjectById(projectId);
    if (!project) throw notFound("Project not found");
    if (!getProjectSubTechnicalUnitCode(project.projectNumber)) {
      throw badRequest("This project is not an Infra project (IE / AE / PM / TP)");
    }
    const teamMember = await infraRepository.findTeamMemberById(payload.teamMemberId);
    if (!teamMember) throw notFound("Team member not found");

    const alreadyActive = project.assignments.some(
      (assignment) => assignment.teamMemberId === payload.teamMemberId && assignment.demobilizedAt === null
    );
    if (alreadyActive) {
      throw badRequest("This team member is already mobilized on this project");
    }

    const mobilizedAt = payload.mobilizedAt ? new Date(payload.mobilizedAt) : new Date();
    if (Number.isNaN(mobilizedAt.getTime())) {
      throw badRequest("Please select a valid mobilization date");
    }

    const assignment = await infraRepository.createAssignment({
      projectId,
      teamMemberId: payload.teamMemberId,
      mobilizedAt,
      daysWorked: payload.daysWorked ?? null
    });
    await infraRepository.updateTeamMember(teamMember.id, {
      currentProject: project.name,
      mobilizedAt,
      demobilizedAt: null
    });
    return assignment;
  },
  async updateAssignment(
    id: string,
    payload: { mobilizedAt?: string | null; demobilizedAt?: string | null; daysWorked?: number | null }
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
      daysWorked: payload.daysWorked === undefined ? undefined : payload.daysWorked
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
  }
};
