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

export const infraService = {
  async overview() {
    const projects = await infraRepository.findProjects();
    const teamMembers = await infraRepository.findTeamMembers();

    const filtered = projects.filter((project) => getProjectSubTechnicalUnitCode(project.projectNumber));
    const ongoingProjects = filtered.filter((project) => getProjectLifecycle(project.assignments) === "ONGOING").length;
    const completedProjects = filtered.filter((project) => getProjectLifecycle(project.assignments) === "COMPLETED").length;

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
      mobilizedTeamMembers: teamMembers.filter((member) => member.mobilizedAt && !member.demobilizedAt).length
    };
  },
  async listProjects() {
    const projects = await infraRepository.findProjects();
    return projects
      .filter((project) => getProjectSubTechnicalUnitCode(project.projectNumber))
      .map((project) => ({
        ...project,
        subTechnicalUnitCode: getProjectSubTechnicalUnitCode(project.projectNumber),
        lifecycle: getProjectLifecycle(project.assignments),
        activeAssignments: project.assignments.filter((assignment) => assignment.demobilizedAt === null).length
      }));
  },
  async getProject(id: string) {
    const project = await infraRepository.findProjectById(id);
    if (!project) throw notFound("Project not found");
    return {
      ...project,
      subTechnicalUnitCode: getProjectSubTechnicalUnitCode(project.projectNumber),
      lifecycle: getProjectLifecycle(project.assignments),
      activeAssignments: project.assignments.filter((assignment) => assignment.demobilizedAt === null).length
    };
  },
  listTeamMembers() {
    return infraRepository.findTeamMembers();
  },
  async createTeamMember(payload: { name: string; email?: string | null; phone?: string | null; manpowerGroup: string; manpowerRole: string; notes?: string | null }) {
    if (!payload.name.trim()) throw badRequest("Name is required");
    return infraRepository.createTeamMember({
      name: payload.name.trim(),
      email: payload.email?.trim() || null,
      phone: payload.phone?.trim() || null,
      manpowerGroup: payload.manpowerGroup,
      manpowerRole: payload.manpowerRole.trim(),
      notes: payload.notes?.trim() || null
    });
  },
  async updateTeamMember(id: string, payload: { name?: string; email?: string | null; phone?: string | null; manpowerGroup?: string; manpowerRole?: string; notes?: string | null }) {
    const member = await infraRepository.findTeamMemberById(id);
    if (!member) throw notFound("Team member not found");
    return infraRepository.updateTeamMember(id, {
      name: payload.name?.trim(),
      email: payload.email === undefined ? undefined : payload.email?.trim() || null,
      phone: payload.phone === undefined ? undefined : payload.phone?.trim() || null,
      manpowerGroup: payload.manpowerGroup,
      manpowerRole: payload.manpowerRole?.trim(),
      notes: payload.notes === undefined ? undefined : payload.notes?.trim() || null
    });
  },
  async removeTeamMember(id: string) {
    const member = await infraRepository.findTeamMemberById(id);
    if (!member) throw notFound("Team member not found");
    return infraRepository.deleteTeamMember(id);
  },
  async assignProject(projectId: string, payload: { teamMemberId: string; mobilizedAt?: string | null }) {
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
      mobilizedAt
    });
    await infraRepository.updateTeamMember(teamMember.id, {
      currentProject: project.name,
      mobilizedAt,
      demobilizedAt: null
    });
    return assignment;
  },
  async updateAssignment(id: string, payload: { mobilizedAt?: string | null; demobilizedAt?: string | null }) {
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
      demobilizedAt: nextDemobilizedAt
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