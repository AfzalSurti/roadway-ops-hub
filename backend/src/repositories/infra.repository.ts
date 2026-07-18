import { prisma } from "../prisma/client.js";

export const infraRepository = {
  findProjects() {
    return prisma.project.findMany({
      orderBy: { name: "asc" },
      include: {
        assignments: {
          include: { teamMember: true },
          orderBy: { createdAt: "desc" }
        },
        infraOtherCosts: { orderBy: { createdAt: "asc" } }
      }
    });
  },
  findProjectById(id: string) {
    return prisma.project.findUnique({
      where: { id },
      include: {
        assignments: {
          include: { teamMember: true },
          orderBy: { createdAt: "desc" }
        },
        infraOtherCosts: { orderBy: { createdAt: "asc" } }
      }
    });
  },
  findTeamMembers() {
    return prisma.infraTeamMember.findMany({
      orderBy: [{ manpowerGroup: "asc" }, { manpowerRole: "asc" }, { name: "asc" }],
      include: {
        projectAssignments: {
          include: { project: true },
          orderBy: { createdAt: "desc" }
        }
      }
    });
  },
  findTeamMemberById(id: string) {
    return prisma.infraTeamMember.findUnique({
      where: { id },
      include: {
        projectAssignments: {
          include: { project: true },
          orderBy: { createdAt: "desc" }
        }
      }
    });
  },
  createTeamMember(data: {
    name: string;
    email?: string | null;
    phone?: string | null;
    manpowerGroup: string;
    manpowerRole: string;
    monthlyCost?: number | null;
    notes?: string | null;
  }) {
    return prisma.infraTeamMember.create({ data });
  },
  updateTeamMember(
    id: string,
    data: Partial<{
      name: string;
      email: string | null;
      phone: string | null;
      manpowerGroup: string;
      manpowerRole: string;
      monthlyCost: number | null;
      currentProject: string | null;
      mobilizedAt: Date | null;
      demobilizedAt: Date | null;
      notes: string | null;
    }>
  ) {
    return prisma.infraTeamMember.update({ where: { id }, data });
  },
  deleteTeamMember(id: string) {
    return prisma.infraTeamMember.delete({ where: { id } });
  },
  createAssignment(data: {
    projectId: string;
    teamMemberId: string;
    mobilizedAt?: Date | null;
    daysWorked?: number | null;
  }) {
    return prisma.projectAssignment.create({ data });
  },
  updateAssignment(
    id: string,
    data: {
      mobilizedAt?: Date | null;
      demobilizedAt?: Date | null;
      daysWorked?: number | null;
      actualAmount?: number | null;
      drawnAmount?: number | null;
    }
  ) {
    return prisma.projectAssignment.update({ where: { id }, data });
  },
  findAssignmentById(id: string) {
    return prisma.projectAssignment.findUnique({ where: { id }, include: { teamMember: true, project: true } });
  },
  createOtherCost(data: {
    projectId: string;
    description: string;
    actualAmount?: number | null;
    drawnAmount?: number | null;
  }) {
    return prisma.infraProjectOtherCost.create({ data });
  },
  updateOtherCost(
    id: string,
    data: Partial<{ description: string; actualAmount: number | null; drawnAmount: number | null }>
  ) {
    return prisma.infraProjectOtherCost.update({ where: { id }, data });
  },
  deleteOtherCost(id: string) {
    return prisma.infraProjectOtherCost.delete({ where: { id } });
  },
  findOtherCostById(id: string) {
    return prisma.infraProjectOtherCost.findUnique({ where: { id } });
  }
};
