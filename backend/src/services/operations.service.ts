import { operationsRepository } from "../repositories/operations.repository.js";
import { notFound } from "../utils/errors.js";
import { getPagination } from "../utils/pagination.js";

export const operationsService = {
  async list(
    filters: { workCategory?: string; client?: string; search?: string; tenderBidId?: string },
    page = 1,
    limit = 100
  ) {
    const pag = getPagination({ page, limit });
    const [items, total] = await Promise.all([
      operationsRepository.findMany(filters, pag.skip, pag.limit),
      operationsRepository.count(filters)
    ]);
    return {
      items,
      pagination: { page: pag.page, limit: pag.limit, total, totalPages: Math.ceil(total / pag.limit) }
    };
  },

  async getById(id: string) {
    const activity = await operationsRepository.findById(id);
    if (!activity) throw notFound("Pre-contract activity not found");
    return activity;
  },

  async getByTenderBidId(tenderBidId: string) {
    return operationsRepository.findByTenderBidId(tenderBidId);
  },

  async create(data: {
    nameOfWork: string;
    workCategory: string;
    client: string;
    state?: string;
    tenderBidId?: string;
    awardOfProjectDate?: string | null;
    awardOfProjectLetterUrl?: string | null;
    securityDepositType?: "PERFORMANCE_SECURITY" | "BANK_GUARANTEE" | "FDR" | null;
    sdBank?: string;
    sdIssuedDate?: string | null;
    sdNumber?: string;
    sdAmount?: number;
    sdExpiryDate?: string | null;
    signingAgreementDate?: string | null;
    signingAgreementLetterUrl?: string | null;
    proceedingOrderDate?: string | null;
    proceedingOrderLetterUrl?: string | null;
    insurancePolicy?: string;
    remarks?: string;
  }) {
    const srNo = await operationsRepository.nextSrNo();
    const createInput: Parameters<typeof operationsRepository.create>[0] = {
      srNo,
      nameOfWork: data.nameOfWork,
      workCategory: data.workCategory,
      client: data.client,
      state: data.state ?? "",
      awardOfProjectDate: data.awardOfProjectDate ? new Date(data.awardOfProjectDate) : null,
      awardOfProjectLetterUrl: data.awardOfProjectLetterUrl ?? null,
      securityDepositType: data.securityDepositType ?? null,
      sdBank: data.sdBank ?? "",
      sdIssuedDate: data.sdIssuedDate ? new Date(data.sdIssuedDate) : null,
      sdNumber: data.sdNumber ?? "",
      sdAmount: data.sdAmount ?? 0,
      sdExpiryDate: data.sdExpiryDate ? new Date(data.sdExpiryDate) : null,
      signingAgreementDate: data.signingAgreementDate ? new Date(data.signingAgreementDate) : null,
      signingAgreementLetterUrl: data.signingAgreementLetterUrl ?? null,
      proceedingOrderDate: data.proceedingOrderDate ? new Date(data.proceedingOrderDate) : null,
      proceedingOrderLetterUrl: data.proceedingOrderLetterUrl ?? null,
      insurancePolicy: data.insurancePolicy ?? "",
      remarks: data.remarks ?? ""
    };
    if (data.tenderBidId) {
      createInput.tenderBid = { connect: { id: data.tenderBidId } };
    }
    return operationsRepository.create(createInput);
  },

  async update(id: string, data: Record<string, unknown>) {
    await this.getById(id);
    const updateData: Record<string, unknown> = { ...data };
    for (const dateField of [
      "awardOfProjectDate",
      "sdIssuedDate",
      "sdExpiryDate",
      "additionalSdIssuedDate",
      "additionalSdExpiryDate",
      "signingAgreementDate",
      "proceedingOrderDate",
      "piPlPolicyDate",
      "piPlPolicyIssueDate",
      "piPlPolicyExpiryDate",
      "wcPolicyDate",
      "wcPolicyIssueDate",
      "wcPolicyExpiryDate"
    ]) {
      if (dateField in updateData) {
        const val = updateData[dateField];
        updateData[dateField] = val ? new Date(val as string) : null;
      }
    }
    return operationsRepository.update(id, updateData);
  },

  async remove(id: string) {
    await this.getById(id);
    await operationsRepository.delete(id);
    await operationsRepository.resequenceSrNos();
    return { deleted: true };
  }
};
