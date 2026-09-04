import { letterNumberingRepository } from "../repositories/letter-numbering.repository.js";
import { badRequest, conflict, forbidden, notFound } from "../utils/errors.js";
import {
  buildLetterNumber,
  nextInsertSerial,
  nextOutwardSequence,
  nextWholeSerial,
  planOutwardSequences
} from "../utils/letter-numbering.js";
import type { LetterActionStatus, LetterActionType, LetterCategory } from "@prisma/client";

function parseDate(value?: string | null) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const text = String(value).trim();
  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    // Noon UTC keeps the calendar day stable across timezones (e.g. IST).
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    if (
      Number.isNaN(date.getTime()) ||
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw badRequest("Invalid letter date");
    }
    return date;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  }

  const date = new Date(text.includes("T") ? text : `${text}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw badRequest("Invalid letter date");
  // Normalize date-only intent to noon UTC when time is midnight UTC
  if (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  ) {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0)
    );
  }
  return date;
}

function sortOrderFromSerial(serialLabel: string): number {
  const match = serialLabel.trim().match(/^(\d+)([a-z]*)$/i);
  if (!match) return Date.now() % 1_000_000;
  const base = Number(match[1]) * 1000;
  const suffix = match[2].toLowerCase();
  let extra = 0;
  for (let i = 0; i < suffix.length; i += 1) {
    extra = extra * 26 + (suffix.charCodeAt(i) - 96);
  }
  return base + extra;
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

/** Resolve Referred To for a new letter: employee id (if given) wins and snapshots the employee's name. */
async function resolveReferredToForCreate(payload: { referredTo?: string; referredToUserId?: string | null }) {
  if (payload.referredToUserId) {
    const employee = await letterNumberingRepository.findUserById(payload.referredToUserId);
    if (!employee) throw notFound("Employee not found");
    return {
      referredTo: employee.name,
      referredToUser: { connect: { id: employee.id } },
      referredToUserId: employee.id as string | null
    } as const;
  }
  return { referredTo: payload.referredTo?.trim() || "", referredToUser: undefined, referredToUserId: null as string | null } as const;
}

/** Resolve Referred To for an update: undefined leaves both fields untouched (falls back to the letter's current assignee). */
async function resolveReferredToForUpdate(
  payload: { referredTo?: string; referredToUserId?: string | null },
  currentReferredToUserId: string | null
) {
  if (payload.referredToUserId !== undefined) {
    if (payload.referredToUserId === null) {
      return { referredTo: "", referredToUser: { disconnect: true }, referredToUserId: null as string | null } as const;
    }
    const employee = await letterNumberingRepository.findUserById(payload.referredToUserId);
    if (!employee) throw notFound("Employee not found");
    return {
      referredTo: employee.name,
      referredToUser: { connect: { id: employee.id } },
      referredToUserId: employee.id as string | null
    } as const;
  }
  if (payload.referredTo !== undefined) {
    return { referredTo: payload.referredTo.trim(), referredToUser: undefined, referredToUserId: currentReferredToUserId } as const;
  }
  return { referredTo: undefined, referredToUser: undefined, referredToUserId: currentReferredToUserId } as const;
}

type ActionFieldsPatch = { actionType: LetterActionType | null; actionStatus: LetterActionStatus | null };

/** Resolve the assigned action for a new letter — any real type starts a fresh Pending cycle. */
function resolveActionForCreate(category: LetterCategory, actionType?: LetterActionType | null): ActionFieldsPatch {
  if (category === "OUTWARD" || !actionType) {
    return { actionType: null, actionStatus: null };
  }
  return { actionType, actionStatus: "PENDING" };
}

/** Resolve the assigned action for an update. undefined = untouched. Any change restarts the cycle (fresh Pending, cleared remark). */
function resolveActionForUpdate(
  category: LetterCategory,
  actionType: LetterActionType | null | undefined
): (ActionFieldsPatch & { employeeRemark: string }) | undefined {
  if (actionType === undefined) return undefined;
  if (category === "OUTWARD" || actionType === null) {
    return { actionType: null, actionStatus: null, employeeRemark: "" };
  }
  return { actionType, actionStatus: "PENDING", employeeRemark: "" };
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

async function resequenceOutwardLetters(
  letterProjectId: string,
  project: { projectNumber: string; projectCode: string }
) {
  const letters = await letterNumberingRepository.listLetters(letterProjectId);
  const planned = planOutwardSequences(letters);
  const updates: Array<{ id: string; data: { outwardSequence: string | null; letterNumber: string } }> =
    [];

  for (const letter of letters) {
    if (letter.category !== "OUTWARD") {
      if (letter.outwardSequence) {
        updates.push({
          id: letter.id,
          data: {
            outwardSequence: null,
            // Keep manual Inward/Other letter numbers — do not overwrite with Sr.
            letterNumber: letter.letterNumber
          }
        });
      }
      continue;
    }

    const nextSeq = planned.get(letter.id);
    if (!nextSeq) continue;
    const nextNumber = buildLetterNumber({
      projectNumber: project.projectNumber,
      projectCode: project.projectCode,
      serialLabel: letter.serialLabel,
      category: "OUTWARD",
      outwardSequence: nextSeq
    });
    if (letter.outwardSequence === nextSeq && letter.letterNumber === nextNumber) continue;
    updates.push({
      id: letter.id,
      data: { outwardSequence: nextSeq, letterNumber: nextNumber }
    });
  }

  if (updates.length > 0) {
    await letterNumberingRepository.updateManyLetters(letterProjectId, updates);
  }
  return updates.length;
}

export const letterNumberingService = {
  listProjects() {
    return letterNumberingRepository.listProjects();
  },

  listEmployees() {
    return letterNumberingRepository.listEmployees();
  },

  async listPendingReplies(referredToUserId?: string) {
    const [pending, replyLinks] = await Promise.all([
      letterNumberingRepository.listPendingReplies(referredToUserId),
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
          letterNumberingRepository.updateLetter(letter.id, {
            repliedAt: new Date(),
            ...(letter.actionType ? { actionStatus: "CLOSE" as const } : {})
          })
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

    let dirty = false;
    if (heals.length > 0) {
      await Promise.all(
        heals.map((letter) =>
          letterNumberingRepository.updateLetter(letter.id, {
            repliedAt: new Date(),
            ...(letter.actionType ? { actionStatus: "CLOSE" as const } : {})
          })
        )
      );
      dirty = true;
    }

    const outwardFixed = await resequenceOutwardLetters(id, {
      projectNumber: project.projectNumber,
      projectCode: project.projectCode
    });
    if (outwardFixed > 0) dirty = true;

    if (dirty) {
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
      referredTo?: string;
      referredToUserId?: string | null;
      subjectCategory?: string;
      letterLinkUrl?: string | null;
      needsReply?: boolean | null;
      replied?: boolean;
      /** Action assigned to the referred employee (null = "-") */
      actionType?: LetterActionType | null;
      replyOfSerial?: string | null;
      remark?: string;
      /** Existing Sr No when pushing old letters (e.g. 01, 2a) */
      serialLabel?: string | null;
      /** Existing outward sequence when pushing old outward letters */
      outwardSequence?: string | null;
      /** Existing letter number as already assigned (optional override) */
      letterNumber?: string | null;
    }
  ) {
    const project = await this.getProject(letterProjectId);
    const letters = project.letters;

    const providedSerial = payload.serialLabel?.trim() || "";
    let serialLabel: string;
    if (providedSerial) {
      if (!/^(\d+)([a-z]*)$/i.test(providedSerial)) {
        throw badRequest("Sr No must look like 01, 2, or 3a");
      }
      const key = normalizeSerialLabel(providedSerial);
      const duplicate = letters.find((item) => normalizeSerialLabel(item.serialLabel) === key);
      if (duplicate) {
        throw conflict(`Sr No "${providedSerial}" already exists in this project`);
      }
      serialLabel = /^\d+$/.test(providedSerial)
        ? String(Number(providedSerial))
        : providedSerial.toLowerCase();
    } else {
      serialLabel = String(nextWholeSerial(letters.map((item) => item.serialLabel)));
    }

    const sortOrder = providedSerial
      ? sortOrderFromSerial(serialLabel)
      : letters.length === 0
        ? 1
        : Math.max(...letters.map((item) => item.sortOrder)) + 1;

    let outwardSequence: string | null = null;
    if (payload.category === "OUTWARD") {
      const providedOutward = payload.outwardSequence?.trim() || "";
      if (providedOutward) {
        outwardSequence = providedOutward;
      } else if (payload.letterNumber?.trim()) {
        // Try extract outward seq from full letter number: PN/CODE/SR/OUT
        const parts = payload.letterNumber.trim().split("/");
        outwardSequence = parts.length >= 4 ? parts[parts.length - 1] : null;
      }
      if (!outwardSequence) {
        outwardSequence = nextOutwardSequence(
          letters.filter((item) => item.category === "OUTWARD").map((item) => item.outwardSequence || "")
        );
      }
    }

    const providedLetterNumber = payload.letterNumber?.trim() || "";
    const letterNumber =
      providedLetterNumber ||
      (payload.category === "OUTWARD"
        ? buildLetterNumber({
            projectNumber: project.projectNumber,
            projectCode: project.projectCode,
            serialLabel,
            category: payload.category,
            outwardSequence
          })
        : "");

    const replyFields = resolveReplyFields(payload.category, {
      needsReply: payload.needsReply,
      replied: payload.replied,
      currentNeedsReply: null,
      currentRepliedAt: null
    });

    const replyOfSerial =
      payload.replyOfSerial === undefined ? null : payload.replyOfSerial?.trim() || null;

    const referredToFields = await resolveReferredToForCreate(payload);
    const actionFields = resolveActionForCreate(payload.category, payload.actionType);
    if (actionFields.actionType && !referredToFields.referredToUserId) {
      throw badRequest("Select an employee to refer this action to");
    }

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
      referredTo: referredToFields.referredTo,
      referredToUser: referredToFields.referredToUser,
      subjectCategory: payload.subjectCategory?.trim() || "",
      letterLinkUrl: payload.letterLinkUrl?.trim() || null,
      outwardSequence,
      needsReply: actionFields.actionType ? true : replyFields.needsReply,
      repliedAt: replyFields.repliedAt,
      actionType: actionFields.actionType,
      actionStatus: actionFields.actionStatus,
      replyOfSerial,
      remark: payload.remark?.trim() || ""
    });

    if (replyOfSerial) {
      await this.markSerialReplied(letterProjectId, replyOfSerial, created.id);
    }

    return created;
  },

  async bulkImportLetters(
    letterProjectId: string,
    rows: Array<{
      category: LetterCategory;
      letterDate?: string | null;
      sentBy?: string;
      sentTo?: string;
      subject?: string;
      ccTo?: string;
      referredTo?: string;
      referredToUserId?: string | null;
      subjectCategory?: string;
      letterLinkUrl?: string | null;
      needsReply?: boolean | null;
      replied?: boolean;
      actionType?: LetterActionType | null;
      replyOfSerial?: string | null;
      remark?: string;
      serialLabel?: string | null;
      outwardSequence?: string | null;
      letterNumber?: string | null;
    }>
  ) {
    await this.getProject(letterProjectId);

    const created: Array<{ row: number; id: string; serialLabel: string; letterNumber: string; category: LetterCategory }> =
      [];
    const errors: Array<{ row: number; message: string }> = [];

    for (let index = 0; index < rows.length; index += 1) {
      const rowNumber = index + 1;
      const row = rows[index];
      try {
        const letter = await this.addLetter(letterProjectId, row);
        created.push({
          row: rowNumber,
          id: letter.id,
          serialLabel: letter.serialLabel,
          letterNumber: letter.letterNumber,
          category: letter.category
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to import letter row";
        errors.push({ row: rowNumber, message });
      }
    }

    return {
      createdCount: created.length,
      failedCount: errors.length,
      created,
      errors
    };
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
      referredTo?: string;
      referredToUserId?: string | null;
      subjectCategory?: string;
      letterLinkUrl?: string | null;
      needsReply?: boolean | null;
      replied?: boolean;
      actionType?: LetterActionType | null;
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

    const letterNumber =
      payload.category === "OUTWARD"
        ? buildLetterNumber({
            projectNumber: project.projectNumber,
            projectCode: project.projectCode,
            serialLabel,
            category: payload.category,
            outwardSequence
          })
        : "";

    const replyFields = resolveReplyFields(payload.category, {
      needsReply: payload.needsReply,
      replied: payload.replied,
      currentNeedsReply: null,
      currentRepliedAt: null
    });

    const replyOfSerial =
      payload.replyOfSerial === undefined ? null : payload.replyOfSerial?.trim() || null;

    const referredToFields = await resolveReferredToForCreate(payload);
    const actionFields = resolveActionForCreate(payload.category, payload.actionType);
    if (actionFields.actionType && !referredToFields.referredToUserId) {
      throw badRequest("Select an employee to refer this action to");
    }

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
      referredTo: referredToFields.referredTo,
      referredToUser: referredToFields.referredToUser,
      subjectCategory: payload.subjectCategory?.trim() || "",
      letterLinkUrl: payload.letterLinkUrl?.trim() || null,
      outwardSequence,
      needsReply: actionFields.actionType ? true : replyFields.needsReply,
      repliedAt: replyFields.repliedAt,
      actionType: actionFields.actionType,
      actionStatus: actionFields.actionStatus,
      replyOfSerial,
      remark: payload.remark?.trim() || ""
    });

    if (replyOfSerial) {
      await this.markSerialReplied(letterProjectId, replyOfSerial, created.id);
    }

    if (payload.category === "OUTWARD") {
      await resequenceOutwardLetters(letterProjectId, {
        projectNumber: project.projectNumber,
        projectCode: project.projectCode
      });
      const refreshed = await letterNumberingRepository.findLetterById(created.id);
      return refreshed ?? created;
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
      repliedAt: new Date(),
      ...(target.actionType ? { actionStatus: "CLOSE" as const } : {})
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
      repliedAt: null,
      ...(target.actionType ? { actionStatus: "PENDING" as const } : {})
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
      referredTo: string;
      referredToUserId: string | null;
      subjectCategory: string;
      letterLinkUrl: string | null;
      needsReply: boolean | null;
      replied: boolean;
      actionType: LetterActionType | null;
      replyOfSerial: string | null;
      remark: string;
      letterNumber: string | null;
    }>
  ) {
    const letter = await letterNumberingRepository.findLetterById(letterId);
    if (!letter) throw notFound("Letter not found");

    const category = payload.category ?? letter.category;
    let outwardSequence = letter.outwardSequence;

    if (payload.category && payload.category !== letter.category) {
      if (category === "OUTWARD") {
        // Temporary placeholder; full project resequence runs after save
        const siblings = await letterNumberingRepository.listLetters(letter.letterProjectId);
        const previousOutward = [...siblings]
          .filter(
            (item) =>
              item.id !== letter.id &&
              item.category === "OUTWARD" &&
              item.sortOrder <= letter.sortOrder
          )
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .at(-1);
        outwardSequence = nextOutwardSequence(
          siblings
            .filter((item) => item.category === "OUTWARD" && item.id !== letter.id)
            .map((item) => item.outwardSequence || ""),
          previousOutward?.outwardSequence
        );
      } else {
        outwardSequence = null;
      }
    }

    let letterNumber = letter.letterNumber;
    if (category === "OUTWARD") {
      letterNumber = buildLetterNumber({
        projectNumber: letter.letterProject.projectNumber,
        projectCode: letter.letterProject.projectCode,
        serialLabel: letter.serialLabel,
        category,
        outwardSequence
      });
    } else if (payload.letterNumber !== undefined) {
      letterNumber = payload.letterNumber?.trim() || "";
    } else if (payload.category && payload.category !== letter.category) {
      // Switched to Inward/Other — clear auto Outward number for manual entry
      letterNumber = "";
    }

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

    const referredToFields = await resolveReferredToForUpdate(payload, letter.referredToUserId);
    // Only an actual change to the assigned action restarts the workflow (fresh Pending, cleared remark) —
    // re-saving the dialog with the same action must not disturb an in-progress or closed cycle.
    const actionFields =
      payload.actionType !== undefined && payload.actionType !== letter.actionType
        ? resolveActionForUpdate(category, payload.actionType)
        : undefined;
    const finalActionType = actionFields ? actionFields.actionType : letter.actionType;
    if (finalActionType && !referredToFields.referredToUserId) {
      throw badRequest("Select an employee to refer this action to");
    }

    const updated = await letterNumberingRepository.updateLetter(letterId, {
      category: payload.category,
      letterDate: parseDate(payload.letterDate),
      sentBy: payload.sentBy?.trim(),
      sentTo: payload.sentTo?.trim(),
      subject: payload.subject?.trim(),
      ccTo: payload.ccTo?.trim(),
      referredTo: referredToFields.referredTo,
      referredToUser: referredToFields.referredToUser,
      subjectCategory: payload.subjectCategory?.trim(),
      letterLinkUrl:
        payload.letterLinkUrl === undefined ? undefined : payload.letterLinkUrl?.trim() || null,
      outwardSequence,
      letterNumber,
      needsReply: actionFields ? (actionFields.actionType ? true : null) : replyFields.needsReply,
      repliedAt: actionFields ? null : replyFields.repliedAt,
      actionType: actionFields?.actionType,
      actionStatus: actionFields?.actionStatus,
      employeeRemark: actionFields?.employeeRemark,
      replyOfSerial,
      remark: payload.remark?.trim()
    });

    // Keep Outward seq / letter numbers correct in table order (fixes 3b=/04 vs 4=/03)
    if (payload.category && payload.category !== letter.category) {
      await resequenceOutwardLetters(letter.letterProjectId, {
        projectNumber: letter.letterProject.projectNumber,
        projectCode: letter.letterProject.projectCode
      });
    }

    let clearedPendingSerial: string | null = null;
    let reopenedPendingSerial: string | null = null;

    if (replyOfSerial !== undefined) {
      const prevKey = previousReplyOf ? normalizeSerialLabel(previousReplyOf) : "";
      const nextKey = replyOfSerial ? normalizeSerialLabel(replyOfSerial) : "";

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

    const refreshed = await letterNumberingRepository.findLetterById(letterId);
    return {
      ...(refreshed ?? updated),
      clearedPendingSerial,
      reopenedPendingSerial
    };
  },

  async removeLetter(letterId: string) {
    const letter = await letterNumberingRepository.findLetterById(letterId);
    if (!letter) throw notFound("Letter not found");
    const projectMeta = {
      projectNumber: letter.letterProject.projectNumber,
      projectCode: letter.letterProject.projectCode
    };
    const letterProjectId = letter.letterProjectId;
    await letterNumberingRepository.deleteLetter(letterId);
    await resequenceOutwardLetters(letterProjectId, projectMeta);
    return { deleted: true };
  },

  listMyActionableLetters(userId: string) {
    return letterNumberingRepository.listMyActionableLetters(userId);
  },

  /** Employee submits their action with a remark — scoped so they can only act on letters referred to them. */
  async submitEmployeeAction(userId: string, letterId: string, remark: string) {
    const letter = await letterNumberingRepository.findLetterById(letterId);
    if (!letter) throw notFound("Letter not found");
    if (letter.referredToUserId !== userId) throw forbidden("This letter is not referred to you");
    if (letter.actionStatus !== "PENDING") throw badRequest("This letter is not awaiting your action");
    return letterNumberingRepository.updateLetter(letterId, {
      actionStatus: "COMPLETED",
      employeeRemark: remark.trim()
    });
  },

  /** Admin reviews a completed action: approve closes it, reject sends it back to the employee. */
  async reviewAction(letterId: string, approve: boolean) {
    const letter = await letterNumberingRepository.findLetterById(letterId);
    if (!letter) throw notFound("Letter not found");
    if (letter.actionStatus !== "COMPLETED") throw badRequest("This letter is not awaiting review");
    if (approve) {
      return letterNumberingRepository.updateLetter(letterId, {
        actionStatus: "CLOSE",
        needsReply: true,
        repliedAt: new Date()
      });
    }
    return letterNumberingRepository.updateLetter(letterId, {
      actionStatus: "PENDING",
      repliedAt: null
    });
  },

  suggestions(args: {
    letterProjectId?: string;
    field: "sentBy" | "sentTo" | "subject" | "ccTo" | "referredTo";
    q?: string;
  }) {
    return letterNumberingRepository.suggestions(args.letterProjectId, args.field, args.q?.trim() || "");
  }
};
