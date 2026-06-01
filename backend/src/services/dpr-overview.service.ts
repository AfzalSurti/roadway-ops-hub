import { dprOverviewRepository } from "../repositories/dpr-overview.repository.js";
import { notFound, badRequest } from "../utils/errors.js";

export const dprOverviewService = {
  list() {
    return dprOverviewRepository.findMany();
  },
  getByProject(projectId: string) {
    return dprOverviewRepository.findByProjectId(projectId);
  },
  async create(payload: { projectId: string; status?: string; data?: any }) {
    const existing = await dprOverviewRepository.findByProjectId(payload.projectId);
    if (existing) {
      throw badRequest("DPR overview already exists for this project");
    }
    return dprOverviewRepository.create({
      projectId: payload.projectId,
      status: payload.status as any,
      data: payload.data
    } as any);
  },
  async update(id: string, payload: { status?: string; data?: any }) {
    const existing = await dprOverviewRepository.findById(id);
    if (!existing) throw notFound("DPR overview not found");
    return dprOverviewRepository.update(id, { status: payload.status as any, data: payload.data } as any);
  },
  async remove(id: string) {
    const existing = await dprOverviewRepository.findById(id);
    if (!existing) throw notFound("DPR overview not found");
    await dprOverviewRepository.delete(id);
    return { deleted: true };
  }
};
