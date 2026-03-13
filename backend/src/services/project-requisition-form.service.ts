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
    costCentreDepartment?: string;
    hodDirectorName?: string;
    applicationDate?: Date;
    clientName?: string;
    billingName?: string;
    addressWithPincode?: string;
    pincode?: string;
    gstNumber?: string;
    gstType: string;
    contactName?: string;
    contactNumber?: string;
    designation?: string;
    department?: string;
    panTanNumber?: string;
    email?: string;
    workOrderValue?: string;
    workOrderDate?: Date;
    agreementNumber?: string;
    agreementDate?: Date;
    projectStartingDate?: Date;
    projectDurationDays?: number;
    projectCompletionDate?: Date;
    workOrderNumber?: string;
    newProjectNumber?: string;
    amountOfWorkOrder?: string;
    gstAmount?: string;
    emdAmount?: string;
    pgSdAmount?: string;
    pgDate?: Date;
    pgExpiryDate?: Date;
    nameOfWork?: string;
    locationDistrict?: string;
    state?: string;
    approvedProjectNumber?: string;
    approvedBy?: string;
  }) {
    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw notFound("Project not found");
    }

    return projectRequisitionFormRepository.upsert(projectId, {
      projectId,
      costCentreDepartment: payload.costCentreDepartment ?? "",
      hodDirectorName: payload.hodDirectorName ?? "",
      applicationDate: payload.applicationDate ?? new Date(),
      clientName: payload.clientName ?? "",
      billingName: payload.billingName ?? "",
      addressWithPincode: payload.addressWithPincode ?? "",
      pincode: payload.pincode ?? "",
      gstNumber: payload.gstNumber ?? "",
      gstType: payload.gstType ?? "REGISTERED",
      contactName: payload.contactName ?? "",
      contactNumber: payload.contactNumber ?? "",
      designation: payload.designation ?? "",
      department: payload.department ?? "",
      panTanNumber: payload.panTanNumber ?? "",
      email: payload.email ?? "",
      workOrderValue: payload.workOrderValue ?? "",
      agreementNumber: payload.agreementNumber || null,
      workOrderDate: payload.workOrderDate ?? null,
      agreementDate: payload.agreementDate ?? null,
      projectStartingDate: payload.projectStartingDate ?? new Date(),
      projectDurationDays: payload.projectDurationDays ?? 0,
      projectCompletionDate: payload.projectCompletionDate ?? new Date(),
      workOrderNumber: payload.workOrderNumber ?? "",
      newProjectNumber: payload.newProjectNumber ?? "",
      amountOfWorkOrder: payload.amountOfWorkOrder ?? "",
      gstAmount: payload.gstAmount ?? "",
      emdAmount: payload.emdAmount ?? "",
      pgSdAmount: payload.pgSdAmount ?? "",
      pgDate: payload.pgDate ?? null,
      pgExpiryDate: payload.pgExpiryDate ?? null,
      nameOfWork: payload.nameOfWork ?? "",
      locationDistrict: payload.locationDistrict ?? "",
      state: payload.state ?? "",
      approvedProjectNumber: payload.approvedProjectNumber ?? "",
      approvedBy: payload.approvedBy ?? ""
    });
  }
};