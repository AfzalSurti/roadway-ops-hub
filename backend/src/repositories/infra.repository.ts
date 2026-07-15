import { prisma } from "../prisma/client.js";

export const infraRepository = {
  findProjects() {
    return prisma.project.findMany({
      orderBy: { name: "asc" },
      include: {
        assignments: {
          include: { teamMember: true },
          orderBy: { createdAt: "desc" }
        }
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
        }
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
  createTeamMember(data: { name: string; email?: string | null; phone?: string | null; manpowerGroup: string; manpowerRole: string; notes?: string | null }) {
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
  createAssignment(data: { projectId: string; teamMemberId: string; mobilizedAt?: Date | null }) {
    return prisma.projectAssignment.create({ data });
  },
  updateAssignment(id: string, data: { mobilizedAt?: Date | null; demobilizedAt?: Date | null }) {
    return prisma.projectAssignment.update({ where: { id }, data });
  },
  findAssignmentById(id: string) {
    return prisma.projectAssignment.findUnique({ where: { id }, include: { teamMember: true, project: true } });
  }
};