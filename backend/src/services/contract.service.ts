import { contractRepository } from "../repositories/contract.repository.js";
import { notFound } from "../utils/errors.js";
import { getPagination } from "../utils/pagination.js";

const DATE_FIELDS = [
  "sdIssuedDate",
  "sdExpiryDate",
  "additionalSdIssuedDate",
  "additionalSdExpiryDate",
  "proceedingOrderDate",
  "piPlPolicyDate",
  "piPlPolicyIssueDate",
  "piPlPolicyExpiryDate",
  "wcPolicyDate",
  "wcPolicyIssueDate",
  "wcPolicyExpiryDate"
] as const;

export const contractService = {
  async list(
    filters: { workCategory?: string; client?: string; search?: string; tenderBidId?: string },
    page = 1,
    limit = 100
  ) {
    const pag = getPagination({ page, limit });
    const [items, total] = await Promise.all([
      contractRepository.findMany(filters, pag.skip, pag.limit),
      contractRepository.count(filters)
    ]);
    return {
      items,
      pagination: { page: pag.page, limit: pag.limit, total, totalPages: Math.ceil(total / pag.limit) }
    };
  },

  async getById(id: string) {
    const activity = await contractRepository.findById(id);
    if (!activity) throw notFound("Contract activity not found");
    return activity;
  },

  async getByTenderBidId(tenderBidId: string) {
    return contractRepository.findByTenderBidId(tenderBidId);
  },

  async create(data: Record<string, unknown> & { nameOfWork: string; workCategory: string; client: string }) {
    const srNo = await contractRepository.nextSrNo();
    const createInput: Parameters<typeof contractRepository.create>[0] = {
      srNo,
      nameOfWork: data.nameOfWork,
      nameOfBidder: (data.nameOfBidder as string) ?? "",
      bidInvitingAuthority: (data.bidInvitingAuthority as string) ?? "",
      bidInvitingAuthorityAddress: (data.bidInvitingAuthorityAddress as string) ?? "",
      workCategory: data.workCategory,
      client: data.client,
      state: (data.state as string) ?? "",
      securityDepositType: (data.securityDepositType as never) ?? null,
      sdBank: (data.sdBank as string) ?? "",
      sdIssuedDate: data.sdIssuedDate ? new Date(data.sdIssuedDate as string) : null,
      sdNumber: (data.sdNumber as string) ?? "",
      sdAmount: (data.sdAmount as number) ?? 0,
      sdExpiryDate: data.sdExpiryDate ? new Date(data.sdExpiryDate as string) : null,
      sdLetterUrl: (data.sdLetterUrl as string) ?? null,
      additionalSdType: (data.additionalSdType as never) ?? null,
      additionalSdBank: (data.additionalSdBank as string) ?? "",
      additionalSdIssuedDate: data.additionalSdIssuedDate ? new Date(data.additionalSdIssuedDate as string) : null,
      additionalSdNumber: (data.additionalSdNumber as string) ?? "",
      additionalSdAmount: (data.additionalSdAmount as number) ?? 0,
      additionalSdExpiryDate: data.additionalSdExpiryDate ? new Date(data.additionalSdExpiryDate as string) : null,
      additionalSdLetterUrl: (data.additionalSdLetterUrl as string) ?? null,
      proceedingOrderDate: data.proceedingOrderDate ? new Date(data.proceedingOrderDate as string) : null,
      proceedingOrderLetterUrl: (data.proceedingOrderLetterUrl as string) ?? null,
      woAmount: (data.woAmount as number) ?? 0,
      piPlPolicyNo: (data.piPlPolicyNo as string) ?? "",
      piPlPolicyDate: data.piPlPolicyDate ? new Date(data.piPlPolicyDate as string) : null,
      piPlPolicyAmount: (data.piPlPolicyAmount as number) ?? 0,
      piPlPolicyIssueDate: data.piPlPolicyIssueDate ? new Date(data.piPlPolicyIssueDate as string) : null,
      piPlPolicyExpiryDate: data.piPlPolicyExpiryDate ? new Date(data.piPlPolicyExpiryDate as string) : null,
      piPlPolicyLetterUrl: (data.piPlPolicyLetterUrl as string) ?? null,
      wcPolicyNo: (data.wcPolicyNo as string) ?? "",
      wcPolicyDate: data.wcPolicyDate ? new Date(data.wcPolicyDate as string) : null,
      wcPolicyAmount: (data.wcPolicyAmount as number) ?? 0,
      wcPolicyIssueDate: data.wcPolicyIssueDate ? new Date(data.wcPolicyIssueDate as string) : null,
      wcPolicyExpiryDate: data.wcPolicyExpiryDate ? new Date(data.wcPolicyExpiryDate as string) : null,
      wcPolicyLetterUrl: (data.wcPolicyLetterUrl as string) ?? null,
      remarks: (data.remarks as string) ?? ""
    };
    if (data.tenderBidId) {
      createInput.tenderBid = { connect: { id: data.tenderBidId as string } };
    }
    return contractRepository.create(createInput);
  },

  async update(id: string, data: Record<string, unknown>) {
    await this.getById(id);
    const updateData: Record<string, unknown> = { ...data };
    for (const dateField of DATE_FIELDS) {
      if (dateField in updateData) {
        const val = updateData[dateField];
        updateData[dateField] = val ? new Date(val as string) : null;
      }
    }
    return contractRepository.update(id, updateData);
  },

  async remove(id: string) {
    await this.getById(id);
    await contractRepository.delete(id);
    return { deleted: true };
  }
};
