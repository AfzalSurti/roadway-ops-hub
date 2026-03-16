import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";

export const taskRepository = {
  create(data: Prisma.TaskUncheckedCreateInput) {
    return prisma.task.create({ data });
  },
  findById(id: string) {
    return prisma.task.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, email: true, name: true, role: true } },
        createdBy: { select: { id: true, email: true, name: true, role: true } },
        reportTemplate: true
      }
    });
  },
  update(id: string, data: Prisma.TaskUncheckedUpdateInput) {
    return prisma.task.update({ where: { id }, data });
  },
  delete(id: string) {
    return prisma.task.delete({ where: { id } });
  },
  findMany(where: Prisma.TaskWhereInput, skip: number, take: number) {
    return prisma.task.findMany({
      where,
      skip,
      take,
      include: {
        assignedTo: { select: { id: true, email: true, name: true, role: true } },
        createdBy: { select: { id: true, email: true, name: true, role: true } },
        reportTemplate: true
      },
      orderBy: { createdAt: "desc" }
    });
  },
  findDueReviewPending(now: Date) {
    return prisma.task.findMany({
      where: {
        status: "IN_PROGRESS",
        dueDate: {
          lt: now
        }
      },
      include: {
        assignedTo: { select: { id: true, email: true, name: true, role: true } },
        createdBy: { select: { id: true, email: true, name: true, role: true } },
        reportTemplate: true
      },
      orderBy: { dueDate: "asc" }
    });
  },
  count(where: Prisma.TaskWhereInput) {
    return prisma.task.count({ where });
  }
};