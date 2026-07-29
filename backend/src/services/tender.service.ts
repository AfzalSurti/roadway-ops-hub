import { tenderRepository } from "../repositories/tender.repository.js";
import { notFound } from "../utils/errors.js";
import { getPagination } from "../utils/pagination.js";

export const tenderService = {
  async list(
    filters: { workCategory?: string; client?: string; status?: string; search?: string },
    page = 1,
    limit = 100
  ) {
    const pag = getPagination({ page, limit });
    const [items, total] = await Promise.all([
      tenderRepository.findMany(filters, pag.skip, pag.limit),
      tenderRepository.count(filters)
    ]);
    return {
      items,
      pagination: { page: pag.page, limit: pag.limit, total, totalPages: Math.ceil(total / pag.limit) }
    };
  },

  async getById(id: string) {
    const bid = await tenderRepository.findById(id);
    if (!bid) throw notFound("Tender bid not found");
    return bid;
  },

  async create(data: {
    nameOfWork: string;
    workCategory: string;
    client: string;
    state?: string;
    emd?: number;
    tenderFees?: number;
    infraconFees?: number;
    status?: "ALLOTTED" | "NOT_ALLOTTED";
    letterPreviewUrl?: string | null;
    remarks?: string;
  }) {
    const srNo = await tenderRepository.nextSrNo();
    return tenderRepository.create({
      srNo,
      nameOfWork: data.nameOfWork,
      workCategory: data.workCategory,
      client: data.client,
      state: data.state ?? "",
      emd: data.emd ?? 0,
      tenderFees: data.tenderFees ?? 0,
      infraconFees: data.infraconFees ?? 0,
      status: data.status ?? "NOT_ALLOTTED",
      letterPreviewUrl: data.letterPreviewUrl ?? null,
      remarks: data.remarks ?? ""
    });
  },

  async update(id: string, data: Record<string, unknown>) {
    await this.getById(id);
    return tenderRepository.update(id, data);
  },

  async remove(id: string) {
    await this.getById(id);
    await tenderRepository.delete(id);
    return { deleted: true };
  }
};
