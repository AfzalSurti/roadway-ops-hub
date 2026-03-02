import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";

export const commentRepository = {
  create(data: Prisma.CommentUncheckedCreateInput) {
    return prisma.comment.create({
      data,
      include: {
        author: { select: { id: true, email: true, name: true, role: true } }
      }
    });
  },
  findByTaskId(taskId: string) {
    return prisma.comment.findMany({
      where: { taskId },
      orderBy: { createdAt: "asc" },
      include: {
        author: { select: { id: true, email: true, name: true, role: true } }
      }
    });
  }
};