import type { LetterCategory, Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";

export const letterNumberingRepository = {
  listProjects() {
    return prisma.letterProject.findMany({
      orderBy: [{ projectNumber: "asc" }, { shortName: "asc" }],
      include: {
        linkedProject: { select: { id: true, name: true, projectNumber: true } },
        _count: { select: { letters: true } }
      }
    });
  },

  findProjectById(id: string) {
    return prisma.letterProject.findUnique({
      where: { id },
      include: {
        linkedProject: { select: { id: true, name: true, projectNumber: true } },
        letters: { orderBy: { sortOrder: "asc" } }
      }
    });
  },

  findProjectByNumberCode(projectNumber: string, projectCode: string) {
    return prisma.letterProject.findUnique({
      where: { projectNumber_projectCode: { projectNumber, projectCode } }
    });
  },

  createProject(data: Prisma.LetterProjectCreateInput) {
    return prisma.letterProject.create({
      data,
      include: {
        linkedProject: { select: { id: true, name: true, projectNumber: true } },
        _count: { select: { letters: true } }
      }
    });
  },

  updateProject(id: string, data: Prisma.LetterProjectUpdateInput) {
    return prisma.letterProject.update({
      where: { id },
      data,
      include: {
        linkedProject: { select: { id: true, name: true, projectNumber: true } },
        _count: { select: { letters: true } }
      }
    });
  },

  deleteProject(id: string) {
    return prisma.letterProject.delete({ where: { id } });
  },

  listLetters(letterProjectId: string) {
    return prisma.letterEntry.findMany({
      where: { letterProjectId },
      orderBy: { sortOrder: "asc" }
    });
  },

  findLetterById(id: string) {
    return prisma.letterEntry.findUnique({
      where: { id },
      include: { letterProject: true }
    });
  },

  listPendingReplies() {
    return prisma.letterEntry.findMany({
      where: {
        needsReply: true,
        repliedAt: null,
        category: { in: ["INWARD", "OTHER"] }
      },
      include: {
        letterProject: {
          select: {
            id: true,
            projectNumber: true,
            projectCode: true,
            shortName: true
          }
        }
      },
      orderBy: [{ letterDate: "asc" }, { sortOrder: "asc" }]
    });
  },

  createLetter(data: Prisma.LetterEntryCreateInput) {
    return prisma.letterEntry.create({ data });
  },

  updateLetter(id: string, data: Prisma.LetterEntryUpdateInput) {
    return prisma.letterEntry.update({ where: { id }, data });
  },

  deleteLetter(id: string) {
    return prisma.letterEntry.delete({ where: { id } });
  },

  updateManyLetters(letterProjectId: string, updates: Array<{ id: string; data: Prisma.LetterEntryUpdateInput }>) {
    return prisma.$transaction(
      updates.map((item) =>
        prisma.letterEntry.update({
          where: { id: item.id },
          data: item.data
        })
      )
    );
  },

  async suggestions(letterProjectId: string | undefined, field: "sentBy" | "sentTo" | "subject" | "ccTo", q: string) {
    const where: Prisma.LetterEntryWhereInput = {
      ...(letterProjectId ? { letterProjectId } : {}),
      [field]: { contains: q, mode: "insensitive" }
    };
    const rows = await prisma.letterEntry.findMany({
      where,
      select: { [field]: true },
      take: 80,
      orderBy: { updatedAt: "desc" }
    });
    const values = Array.from(
      new Set(
        rows
          .map((row) => String((row as Record<string, string>)[field] ?? "").trim())
          .filter(Boolean)
      )
    );
    return values.slice(0, 20);
  },

  findMainProjectById(id: string) {
    return prisma.project.findUnique({ where: { id } });
  },

  findMainProjectByName(name: string) {
    return prisma.project.findUnique({ where: { name } });
  },

  createMainProject(data: { name: string; description?: string | null; projectNumber?: string | null }) {
    return prisma.project.create({ data });
  },

  listMainProjects() {
    return prisma.project.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        projectNumber: true
      }
    });
  }
};

export type { LetterCategory };
