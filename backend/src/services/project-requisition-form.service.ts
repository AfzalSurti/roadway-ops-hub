import { projectRequisitionFormRepository } from "../repositories/project-requisition-form.repository.js";
import { projectRepository } from "../repositories/project.repository.js";
import { notFound } from "../utils/errors.js";

export const projectRequisitionFormService = {
  list() {
    return projectRequisitionFormRepository.findMany();
  },
  async getByProjectId(projectId: string) {
    const form = await projectRequisitionFormRepository.findByProjectId(projectId);
    if (!form) {
      throw notFound("Project requisition form not found");
    }
    return form;
  },
  async upsert(projectId: string, payload: {
    costCentreDepartment: string;
    hodDirectorName: string;
    applicationDate: Date;
    clientName: string;
    billingName: string;
    addressWithPincode: string;
    pincode: string;
    gstNumber: string;
    gstType: string;
    contactName: string;
    contactNumber: string;
    designation: string;
    department: string;
    panTanNumber: string;
    email: string;
    workOrderValue: string;
    workOrderDate?: Date;
    agreementNumber?: string;
    agreementDate?: Date;
    projectStartingDate: Date;
    projectDurationDays: number;
    projectCompletionDate: Date;
    workOrderNumber: string;
    newProjectNumber: string;
    amountOfWorkOrder: string;
    gstAmount: string;
    emdAmount: string;
    pgSdAmount: string;
    pgDate?: Date;
    pgExpiryDate?: Date;
    nameOfWork: string;
    locationDistrict: string;
    state: string;
    approvedProjectNumber: string;
    approvedBy: string;
  }) {
    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw notFound("Project not found");
    }

    return projectRequisitionFormRepository.upsert(projectId, {
      projectId,
      ...payload,
      agreementNumber: payload.agreementNumber || null,
      workOrderDate: payload.workOrderDate ?? null,
      agreementDate: payload.agreementDate ?? null,
      pgDate: payload.pgDate ?? null,
      pgExpiryDate: payload.pgExpiryDate ?? null
    });
  }
};