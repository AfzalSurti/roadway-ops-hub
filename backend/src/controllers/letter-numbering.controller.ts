import type { Request, Response } from "express";
import { letterNumberingService } from "../services/letter-numbering.service.js";
import { sendSuccess } from "../utils/response.js";

export const letterNumberingController = {
  async listProjects(_req: Request, res: Response) {
    return sendSuccess(res, await letterNumberingService.listProjects());
  },

  async getProject(req: Request, res: Response) {
    return sendSuccess(res, await letterNumberingService.getProject(req.params.id));
  },

  async listMainProjects(_req: Request, res: Response) {
    return sendSuccess(res, await letterNumberingService.listMainProjectsForSync());
  },

  async createProject(req: Request, res: Response) {
    return sendSuccess(res, await letterNumberingService.createProject(req.body), 201);
  },

  async importFromMainProject(req: Request, res: Response) {
    const { mainProjectId, ...overrides } = req.body;
    return sendSuccess(
      res,
      await letterNumberingService.importFromMainProject(mainProjectId, overrides),
      201
    );
  },

  async syncToMainProject(req: Request, res: Response) {
    return sendSuccess(res, await letterNumberingService.syncToMainProject(req.params.id));
  },

  async updateProject(req: Request, res: Response) {
    return sendSuccess(res, await letterNumberingService.updateProject(req.params.id, req.body));
  },

  async removeProject(req: Request, res: Response) {
    return sendSuccess(res, await letterNumberingService.removeProject(req.params.id));
  },

  async listLetters(req: Request, res: Response) {
    return sendSuccess(res, await letterNumberingService.listLetters(req.params.id));
  },

  async addLetter(req: Request, res: Response) {
    return sendSuccess(res, await letterNumberingService.addLetter(req.params.id, req.body), 201);
  },

  async insertLetter(req: Request, res: Response) {
    const { afterLetterId, ...payload } = req.body;
    return sendSuccess(
      res,
      await letterNumberingService.insertLetterAfter(req.params.id, afterLetterId, payload),
      201
    );
  },

  async updateLetter(req: Request, res: Response) {
    return sendSuccess(res, await letterNumberingService.updateLetter(req.params.letterId, req.body));
  },

  async removeLetter(req: Request, res: Response) {
    return sendSuccess(res, await letterNumberingService.removeLetter(req.params.letterId));
  },

  async suggestions(req: Request, res: Response) {
    return sendSuccess(
      res,
      await letterNumberingService.suggestions({
        field: req.query.field as "sentBy" | "sentTo" | "subject" | "ccTo",
        q: typeof req.query.q === "string" ? req.query.q : "",
        letterProjectId: typeof req.query.letterProjectId === "string" ? req.query.letterProjectId : undefined
      })
    );
  }
};
