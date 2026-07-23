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

function normalizeSerialLabel(value: string) {
  const trimmed = value.trim().toLowerCase();
  const match = trimmed.match(/^0*(\d+)([a-z]*)$/i);
  if (!match) return trimmed;
  return `${Number(match[1])}${match[2].toLowerCase()}`;
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

  async listPendingReplies() {
    const [pending, replyLinks] = await Promise.all([
      letterNumberingRepository.listPendingReplies(),
      letterNumberingRepository.listReplyOfLinks()
    ]);

    const coveredKeys = new Set(
      replyLinks
        .map((row) => {
          const serial = (row.replyOfSerial ?? "").trim();
          if (!serial) return null;
          return `${row.letterProjectId}:${normalizeSerialLabel(serial)}`;
        })
        .filter((value): value is string => Boolean(value))
    );

    // Auto-heal: if a reply-of link exists but repliedAt was never set, mark done now
    const toHeal = pending.filter((letter) =>
      coveredKeys.has(`${letter.letterProjectId}:${normalizeSerialLabel(letter.serialLabel)}`)
    );
    if (toHeal.length > 0) {
      await Promise.all(
        toHeal.map((letter) =>
          letterNumberingRepository.updateLetter(letter.id, { repliedAt: new Date() })
        )
      );
    }

    return pending.filter(
      (letter) =>
        !coveredKeys.has(`${letter.letterProjectId}:${normalizeSerialLabel(letter.serialLabel)}`)
    );
  },

  async getProject(id: string) {
    const project = await letterNumberingRepository.findProjectById(id);
    if (!project) throw notFound("Letter project not found");

    const covered = new Set(
      project.letters
        .map((letter) => (letter.replyOfSerial ?? "").trim())
        .filter(Boolean)
        .map((serial) => normalizeSerialLabel(serial))
    );

    const heals = project.letters.filter(
      (letter) =>
        (letter.category === "INWARD" || letter.category === "OTHER") &&
        letter.needsReply === true &&
        !letter.repliedAt &&
        covered.has(normalizeSerialLabel(letter.serialLabel))
    );

    if (heals.length > 0) {
      await Promise.all(
        heals.map((letter) =>
          letterNumberingRepository.updateLetter(letter.id, { repliedAt: new Date() })
        )
      );
      const refreshed = await letterNumberingRepository.findProjectById(id);
      if (!refreshed) throw notFound("Letter project not found");
      return refreshed;
    }

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
      replyOfSerial?: string | null;
      remark?: string;
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

    const replyOfSerial =
      payload.replyOfSerial === undefined ? null : payload.replyOfSerial?.trim() || null;

    const created = await letterNumberingRepository.createLetter({
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
      repliedAt: replyFields.repliedAt,
      replyOfSerial,
      remark: payload.remark?.trim() || ""
    });

    if (replyOfSerial) {
      await this.markSerialReplied(letterProjectId, replyOfSerial, created.id);
    }

    return created;
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
      replyOfSerial?: string | null;
      remark?: string;
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

    const replyOfSerial =
      payload.replyOfSerial === undefined ? null : payload.replyOfSerial?.trim() || null;

    const created = await letterNumberingRepository.createLetter({
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
      repliedAt: replyFields.repliedAt,
      replyOfSerial,
      remark: payload.remark?.trim() || ""
    });

    if (replyOfSerial) {
      await this.markSerialReplied(letterProjectId, replyOfSerial, created.id);
    }

    return created;
  },

  async markSerialReplied(letterProjectId: string, serial: string, excludeLetterId?: string) {
    const targetKey = normalizeSerialLabel(serial);
    if (!targetKey) return null;
    const siblings = await letterNumberingRepository.listLetters(letterProjectId);
    const target = siblings.find((item) => {
      if (excludeLetterId && item.id === excludeLetterId) return false;
      if (item.category !== "INWARD" && item.category !== "OTHER") return false;
      const serialMatch = normalizeSerialLabel(item.serialLabel) === targetKey;
      const numberMatch = normalizeSerialLabel(item.letterNumber || "") === targetKey;
      return serialMatch || numberMatch;
    });
    if (!target) return null;

    // Linking a reply means this letter is done — set needsReply + repliedAt
    return letterNumberingRepository.updateLetter(target.id, {
      needsReply: true,
      repliedAt: new Date()
    });
  },

  /** If no other row still links to this serial, put it back to Reply Pending */
  async reopenSerialIfUnlinked(letterProjectId: string, serial: string, excludeLetterId?: string) {
    const targetKey = normalizeSerialLabel(serial);
    if (!targetKey) return null;
    const siblings = await letterNumberingRepository.listLetters(letterProjectId);

    const stillLinked = siblings.some((item) => {
      if (excludeLetterId && item.id === excludeLetterId) return false;
      const link = (item.replyOfSerial ?? "").trim();
      return Boolean(link) && normalizeSerialLabel(link) === targetKey;
    });
    if (stillLinked) return null;

    const target = siblings.find((item) => {
      if (excludeLetterId && item.id === excludeLetterId) return false;
      if (item.category !== "INWARD" && item.category !== "OTHER") return false;
      const serialMatch = normalizeSerialLabel(item.serialLabel) === targetKey;
      const numberMatch = normalizeSerialLabel(item.letterNumber || "") === targetKey;
      return serialMatch || numberMatch;
    });
    if (!target || !target.repliedAt) return null;

    return letterNumberingRepository.updateLetter(target.id, {
      needsReply: true,
      repliedAt: null
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
      replyOfSerial: string | null;
      remark: string;
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

    const previousReplyOf = (letter.replyOfSerial ?? "").trim() || null;
    const replyOfSerial =
      payload.replyOfSerial === undefined
        ? undefined
        : payload.replyOfSerial?.trim() || null;

    const updated = await letterNumberingRepository.updateLetter(letterId, {
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
      repliedAt: replyFields.repliedAt,
      replyOfSerial,
      remark: payload.remark?.trim()
    });

    let clearedPendingSerial: string | null = null;
    let reopenedPendingSerial: string | null = null;

    if (replyOfSerial !== undefined) {
      const prevKey = previousReplyOf ? normalizeSerialLabel(previousReplyOf) : "";
      const nextKey = replyOfSerial ? normalizeSerialLabel(replyOfSerial) : "";

      // Cleared or changed away from previous Sr. → reopen old letter if nothing else links it
      if (previousReplyOf && prevKey !== nextKey) {
        const reopened = await this.reopenSerialIfUnlinked(
          letter.letterProjectId,
          previousReplyOf,
          letterId
        );
        if (reopened) reopenedPendingSerial = previousReplyOf;
      }

      if (replyOfSerial) {
        const cleared = await this.markSerialReplied(letter.letterProjectId, replyOfSerial, letterId);
        if (cleared) clearedPendingSerial = replyOfSerial;
      }
    }

    return { ...updated, clearedPendingSerial, reopenedPendingSerial };
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
