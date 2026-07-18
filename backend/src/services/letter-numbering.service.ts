import { letterNumberingRepository } from "../repositories/letter-numbering.repository.js";
import { badRequest, conflict, notFound } from "../utils/errors.js";
import {
  buildLetterNumber,
  nextInsertSerial,
  nextOutwardSequence,
  nextWholeSerial
} from "../utils/letter-numbering.js";
import type { LetterCategory } from "@prisma/client";

function parseDate(value?: string | null) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw badRequest("Invalid letter date");
  return date;
}

function resolveReplyFields(
  category: LetterCategory,
  args: {
    needsReply?: boolean | null;
    replied?: boolean;
    currentNeedsReply?: boolean | null;
    currentRepliedAt?: Date | null;
  }
) {
  if (category === "OUTWARD") {
    return { needsReply: null as boolean | null, repliedAt: null as Date | null };
  }

  let needsReply =
    args.needsReply !== undefined ? args.needsReply : (args.currentNeedsReply ?? null);
  let repliedAt = args.currentRepliedAt ?? null;

  if (needsReply !== true) {
    repliedAt = null;
  } else if (args.replied === true) {
    repliedAt = new Date();
  } else if (args.replied === false) {
    repliedAt = null;
  }

  return { needsReply, repliedAt };
}

function regenerateNumbers(
  project: { projectNumber: string; projectCode: string },
  letters: Array<{
    id: string;
    serialLabel: string;
    category: LetterCategory;
    outwardSequence: string | null;
  }>
) {
  return letters.map((letter) => ({
    id: letter.id,
    data: {
      letterNumber: buildLetterNumber({
        projectNumber: project.projectNumber,
        projectCode: project.projectCode,
        serialLabel: letter.serialLabel,
        category: letter.category,
        outwardSequence: letter.outwardSequence
      })
    }
  }));
}

export const letterNumberingService = {
  listProjects() {
    return letterNumberingRepository.listProjects();
  },

  async getProject(id: string) {
    const project = await letterNumberingRepository.findProjectById(id);
    if (!project) throw notFound("Letter project not found");
    return project;
  },

  listMainProjectsForSync() {
    return letterNumberingRepository.listMainProjects();
  },

  async createProject(payload: {
    projectNumber: string;
    projectCode: string;
    shortName: string;
    fullName?: string;
    projectCoordinator?: string;
    projectEngineer?: string;
    linkedProjectId?: string | null;
    syncToMainProject?: boolean;
  }) {
    const projectNumber = payload.projectNumber.trim();
    const projectCode = payload.projectCode.trim().toUpperCase();
    const shortName = payload.shortName.trim();
    if (!projectNumber || !projectCode || !shortName) {
      throw badRequest("Project number, code, and short name are required");
    }

    const existing = await letterNumberingRepository.findProjectByNumberCode(projectNumber, projectCode);
    if (existing) throw conflict("A letter project with this number and code already exists");

    let linkedProjectId = payload.linkedProjectId ?? null;
    if (linkedProjectId) {
      const main = await letterNumberingRepository.findMainProjectById(linkedProjectId);
      if (!main) throw notFound("Linked project not found");
    }

    if (payload.syncToMainProject && !linkedProjectId) {
      const name = shortName;
      const existingMain = await letterNumberingRepository.findMainProjectByName(name);
      const main =
        existingMain ??
        (await letterNumberingRepository.createMainProject({
          name,
          description: payload.fullName?.trim() || null,
          projectNumber: projectCode
        }));
      linkedProjectId = main.id;
    }

    return letterNumberingRepository.createProject({
      projectNumber,
      projectCode,
      shortName,
      fullName: payload.fullName?.trim() || "",
      projectCoordinator: payload.projectCoordinator?.trim() || "",
      projectEngineer: payload.projectEngineer?.trim() || "",
      ...(linkedProjectId
        ? { linkedProject: { connect: { id: linkedProjectId } } }
        : {})
    });
  },

  async importFromMainProject(mainProjectId: string, overrides?: {
    projectNumber?: string;
    projectCode?: string;
    shortName?: string;
    fullName?: string;
    projectCoordinator?: string;
    projectEngineer?: string;
  }) {
    const main = await letterNumberingRepository.findMainProjectById(mainProjectId);
    if (!main) throw notFound("Project not found");

    const projectCode = (overrides?.projectCode ?? main.projectNumber ?? "").trim().toUpperCase();
    const projectNumber = (overrides?.projectNumber ?? "").trim();
    const shortName = (overrides?.shortName ?? main.name).trim();
    if (!projectNumber || !projectCode) {
      throw badRequest("Project number and project code are required to import into Letter Numbering");
    }

    const existing = await letterNumberingRepository.findProjectByNumberCode(projectNumber, projectCode);
    if (existing) throw conflict("This project is already in Letter Numbering");

    return letterNumberingRepository.createProject({
      projectNumber,
      projectCode,
      shortName,
      fullName: overrides?.fullName?.trim() || main.description || "",
      projectCoordinator: overrides?.projectCoordinator?.trim() || "",
      projectEngineer: overrides?.projectEngineer?.trim() || "",
      linkedProject: { connect: { id: main.id } }
    });
  },

  async syncToMainProject(letterProjectId: string) {
    const letterProject = await letterNumberingRepository.findProjectById(letterProjectId);
    if (!letterProject) throw notFound("Letter project not found");
    if (letterProject.linkedProjectId) {
      return letterNumberingRepository.findProjectById(letterProjectId);
    }

    const name = letterProject.shortName;
    const existingMain = await letterNumberingRepository.findMainProjectByName(name);
    const main =
      existingMain ??
      (await letterNumberingRepository.createMainProject({
        name,
        description: letterProject.fullName || null,
        projectNumber: letterProject.projectCode
      }));

    return letterNumberingRepository.updateProject(letterProjectId, {
      linkedProject: { connect: { id: main.id } }
    });
  },

  async updateProject(
    id: string,
    payload: Partial<{
      projectNumber: string;
      projectCode: string;
      shortName: string;
      fullName: string;
      projectCoordinator: string;
      projectEngineer: string;
    }>
  ) {
    const project = await letterNumberingRepository.findProjectById(id);
    if (!project) throw notFound("Letter project not found");

    const nextNumber = payload.projectNumber?.trim() ?? project.projectNumber;
    const nextCode = payload.projectCode?.trim().toUpperCase() ?? project.projectCode;
    if (nextNumber !== project.projectNumber || nextCode !== project.projectCode) {
      const clash = await letterNumberingRepository.findProjectByNumberCode(nextNumber, nextCode);
      if (clash && clash.id !== id) throw conflict("Another letter project already uses this number/code");
    }

    await letterNumberingRepository.updateProject(id, {
      projectNumber: payload.projectNumber?.trim(),
      projectCode: payload.projectCode?.trim().toUpperCase(),
      shortName: payload.shortName?.trim(),
      fullName: payload.fullName?.trim(),
      projectCoordinator: payload.projectCoordinator?.trim(),
      projectEngineer: payload.projectEngineer?.trim()
    });

    if (
      (payload.projectNumber !== undefined || payload.projectCode !== undefined) &&
      project.letters.length
    ) {
      await letterNumberingRepository.updateManyLetters(
        id,
        regenerateNumbers(
          { projectNumber: nextNumber, projectCode: nextCode },
          project.letters
        )
      );
    }

    return letterNumberingRepository.findProjectById(id);
  },

  async removeProject(id: string) {
    const project = await letterNumberingRepository.findProjectById(id);
    if (!project) throw notFound("Letter project not found");
    await letterNumberingRepository.deleteProject(id);
    return { deleted: true };
  },

  async listLetters(letterProjectId: string) {
    await this.getProject(letterProjectId);
    return letterNumberingRepository.listLetters(letterProjectId);
  },

  async addLetter(
    letterProjectId: string,
    payload: {
      category: LetterCategory;
      letterDate?: string | null;
      sentBy?: string;
      sentTo?: string;
      subject?: string;
      ccTo?: string;
      subjectCategory?: string;
      letterLinkUrl?: string | null;
      needsReply?: boolean | null;
      replied?: boolean;
    }
  ) {
    const project = await this.getProject(letterProjectId);
    const letters = project.letters;
    const serialLabel = String(nextWholeSerial(letters.map((item) => item.serialLabel)));
    const sortOrder =
      letters.length === 0 ? 1 : Math.max(...letters.map((item) => item.sortOrder)) + 1;

    let outwardSequence: string | null = null;
    if (payload.category === "OUTWARD") {
      outwardSequence = nextOutwardSequence(
        letters.filter((item) => item.category === "OUTWARD").map((item) => item.outwardSequence || "")
      );
    }

    const letterNumber = buildLetterNumber({
      projectNumber: project.projectNumber,
      projectCode: project.projectCode,
      serialLabel,
      category: payload.category,
      outwardSequence
    });

    const replyFields = resolveReplyFields(payload.category, {
      needsReply: payload.needsReply,
      replied: payload.replied,
      currentNeedsReply: null,
      currentRepliedAt: null
    });

    return letterNumberingRepository.createLetter({
      letterProject: { connect: { id: letterProjectId } },
      sortOrder,
      serialLabel,
      letterDate: parseDate(payload.letterDate) ?? null,
      letterNumber,
      category: payload.category,
      sentBy: payload.sentBy?.trim() || "",
      sentTo: payload.sentTo?.trim() || "",
      subject: payload.subject?.trim() || "",
      ccTo: payload.ccTo?.trim() || "",
      subjectCategory: payload.subjectCategory?.trim() || "",
      letterLinkUrl: payload.letterLinkUrl?.trim() || null,
      outwardSequence,
      needsReply: replyFields.needsReply,
      repliedAt: replyFields.repliedAt
    });
  },

  async insertLetterAfter(
    letterProjectId: string,
    afterLetterId: string,
    payload: {
      category: LetterCategory;
      letterDate?: string | null;
      sentBy?: string;
      sentTo?: string;
      subject?: string;
      ccTo?: string;
      subjectCategory?: string;
      letterLinkUrl?: string | null;
      needsReply?: boolean | null;
      replied?: boolean;
    }
  ) {
    const project = await this.getProject(letterProjectId);
    const after = project.letters.find((item) => item.id === afterLetterId);
    if (!after) throw notFound("Reference letter not found");

    const baseMatch = after.serialLabel.match(/^(\d+)/);
    if (!baseMatch) throw badRequest("Cannot insert after this serial");
    const baseSerial = Number(baseMatch[1]);
    const serialLabel = nextInsertSerial(
      baseSerial,
      project.letters.map((item) => item.serialLabel)
    );

    const afterIndex = project.letters.findIndex((item) => item.id === afterLetterId);
    const next = project.letters[afterIndex + 1];
    const sortOrder = next ? (after.sortOrder + next.sortOrder) / 2 : after.sortOrder + 1;

    let outwardSequence: string | null = null;
    if (payload.category === "OUTWARD") {
      const outwardLetters = project.letters.filter((item) => item.category === "OUTWARD");
      const previousOutward = [...outwardLetters]
        .reverse()
        .find((item) => item.sortOrder <= after.sortOrder);
      outwardSequence = nextOutwardSequence(
        outwardLetters.map((item) => item.outwardSequence || ""),
        previousOutward?.outwardSequence
      );
    }

    const letterNumber = buildLetterNumber({
      projectNumber: project.projectNumber,
      projectCode: project.projectCode,
      serialLabel,
      category: payload.category,
      outwardSequence
    });

    const replyFields = resolveReplyFields(payload.category, {
      needsReply: payload.needsReply,
      replied: payload.replied,
      currentNeedsReply: null,
      currentRepliedAt: null
    });

    return letterNumberingRepository.createLetter({
      letterProject: { connect: { id: letterProjectId } },
      sortOrder,
      serialLabel,
      letterDate: parseDate(payload.letterDate) ?? null,
      letterNumber,
      category: payload.category,
      sentBy: payload.sentBy?.trim() || "",
      sentTo: payload.sentTo?.trim() || "",
      subject: payload.subject?.trim() || "",
      ccTo: payload.ccTo?.trim() || "",
      subjectCategory: payload.subjectCategory?.trim() || "",
      letterLinkUrl: payload.letterLinkUrl?.trim() || null,
      outwardSequence,
      needsReply: replyFields.needsReply,
      repliedAt: replyFields.repliedAt
    });
  },

  async updateLetter(
    letterId: string,
    payload: Partial<{
      category: LetterCategory;
      letterDate: string | null;
      sentBy: string;
      sentTo: string;
      subject: string;
      ccTo: string;
      subjectCategory: string;
      letterLinkUrl: string | null;
      needsReply: boolean | null;
      replied: boolean;
    }>
  ) {
    const letter = await letterNumberingRepository.findLetterById(letterId);
    if (!letter) throw notFound("Letter not found");

    const category = payload.category ?? letter.category;
    let outwardSequence = letter.outwardSequence;

    if (payload.category && payload.category !== letter.category) {
      if (category === "OUTWARD") {
        const siblings = await letterNumberingRepository.listLetters(letter.letterProjectId);
        outwardSequence = nextOutwardSequence(
          siblings
            .filter((item) => item.category === "OUTWARD" && item.id !== letter.id)
            .map((item) => item.outwardSequence || "")
        );
      } else {
        outwardSequence = null;
      }
    }

    const letterNumber = buildLetterNumber({
      projectNumber: letter.letterProject.projectNumber,
      projectCode: letter.letterProject.projectCode,
      serialLabel: letter.serialLabel,
      category,
      outwardSequence
    });

    const replyFields = resolveReplyFields(category, {
      needsReply: payload.needsReply,
      replied: payload.replied,
      currentNeedsReply: letter.needsReply,
      currentRepliedAt: letter.repliedAt
    });

    return letterNumberingRepository.updateLetter(letterId, {
      category: payload.category,
      letterDate: parseDate(payload.letterDate),
      sentBy: payload.sentBy?.trim(),
      sentTo: payload.sentTo?.trim(),
      subject: payload.subject?.trim(),
      ccTo: payload.ccTo?.trim(),
      subjectCategory: payload.subjectCategory?.trim(),
      letterLinkUrl:
        payload.letterLinkUrl === undefined ? undefined : payload.letterLinkUrl?.trim() || null,
      outwardSequence,
      letterNumber,
      needsReply: replyFields.needsReply,
      repliedAt: replyFields.repliedAt
    });
  },

  async removeLetter(letterId: string) {
    const letter = await letterNumberingRepository.findLetterById(letterId);
    if (!letter) throw notFound("Letter not found");
    await letterNumberingRepository.deleteLetter(letterId);
    return { deleted: true };
  },

  suggestions(args: {
    letterProjectId?: string;
    field: "sentBy" | "sentTo" | "subject" | "ccTo";
    q?: string;
  }) {
    return letterNumberingRepository.suggestions(args.letterProjectId, args.field, args.q?.trim() || "");
  }
};
