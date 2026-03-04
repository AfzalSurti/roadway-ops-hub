import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";

export const userRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },
  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },
  findEmployees() {
    return prisma.user.findMany({ where: { role: "EMPLOYEE" } });
  },
  async getEmployeeUsageSummary(id: string) {
    const [assignedTasks, submittedReports, comments, uploads] = await Promise.all([
      prisma.task.count({ where: { assignedToId: id } }),
      prisma.report.count({ where: { submittedById: id } }),
      prisma.comment.count({ where: { authorId: id } }),
      prisma.attachment.count({ where: { uploadedById: id } })
    ]);

    return {
      assignedTasks,
      submittedReports,
      comments,
      uploads
    };
  },
  create(data: Prisma.UserCreateInput) {
    return prisma.user.create({ data });
  },
  deleteById(id: string) {
    return prisma.user.delete({ where: { id } });
  }
};