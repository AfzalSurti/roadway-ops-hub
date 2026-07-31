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

  async create(data: Record<string, unknown> & { nameOfWork: string; workCategory: string; client: string }) {
    const srNo = await tenderRepository.nextSrNo();
    return tenderRepository.create({
      srNo,
      nameOfWork: data.nameOfWork,
      nameOfBidder: (data.nameOfBidder as string) ?? "",
      bidInvitingAuthority: (data.bidInvitingAuthority as string) ?? "",
      bidInvitingAuthorityAddress: (data.bidInvitingAuthorityAddress as string) ?? "",
      tenderId: (data.tenderId as string) ?? "",
      projectLengthKm: (data.projectLengthKm as number) ?? 0,
      workCategory: data.workCategory,
      client: data.client,
      state: (data.state as string) ?? "",
      emd: (data.emd as number) ?? 0,
      emdType: (data.emdType as string) ?? "",
      emdBank: (data.emdBank as string) ?? "",
      emdIssuedDate: data.emdIssuedDate ? new Date(data.emdIssuedDate as string) : null,
      emdNumber: (data.emdNumber as string) ?? "",
      emdValidUpto: data.emdValidUpto ? new Date(data.emdValidUpto as string) : null,
      emdLetterUrl: (data.emdLetterUrl as string) ?? null,
      tenderFees: (data.tenderFees as number) ?? 0,
      infraconFees: (data.infraconFees as number) ?? 0,
      status: (data.status as "ALLOTTED" | "NOT_ALLOTTED") ?? "NOT_ALLOTTED",
      letterPreviewUrl: (data.letterPreviewUrl as string) ?? null,
      remarks: (data.remarks as string) ?? "",
    });
  },

  async update(id: string, data: Record<string, unknown>) {
    await this.getById(id);
    const update = { ...data };
    for (const dateField of ["emdIssuedDate", "emdValidUpto"]) {
      if (dateField in update) {
        const val = update[dateField];
        update[dateField] = val ? new Date(val as string) : null;
      }
    }
    return tenderRepository.update(id, update);
  },

  async remove(id: string) {
    await this.getById(id);
    await tenderRepository.delete(id);
    await tenderRepository.resequenceSrNos();
    return { deleted: true };
  }
};
