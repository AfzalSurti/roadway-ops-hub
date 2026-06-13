import { projectRequisitionFormRepository } from "../repositories/project-requisition-form.repository.js";
import { projectRepository } from "../repositories/project.repository.js";
import type { ProjectImportRowInput } from "../validators/project-import.validator.js";
import { conflict } from "../utils/errors.js";

function parseMoney(value: string): number {
  const numeric = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatMoney(value: number): string {
  return value.toFixed(2);
}

function resolveTotalAmount(row: ProjectImportRowInput): string {
  const explicit = row.totalAmount?.trim();
  if (explicit) return explicit;
  return formatMoney(parseMoney(row.amountOfWorkOrder) + parseMoney(row.gstAmount));
}

function toDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function buildRequisitionPayload(projectId: string, row: ProjectImportRowInput, totalAmount: string) {
  const newProjectNumber = row.newProjectNumber?.trim() || row.projectNumber;
  const workOrderValue = row.workOrderValue?.trim() || totalAmount || row.amountOfWorkOrder;

  return {
    projectId,
    costCentreDepartment: row.costCentreDepartment,
    hodDirectorName: row.hodDirectorName,
    applicationDate: toDate(row.applicationDate),
    clientName: row.clientName,
    billingName: row.billingName,
    addressWithPincode: row.addressWithPincode ?? "",
    pincode: row.pincode ?? "",
    gstNumber: row.gstNumber ?? "",
    gstType: row.gstType ?? "REGISTERED",
    contactName: row.contactName ?? "",
    contactNumber: row.contactNumber ?? "",
    designation: row.designation ?? "",
    department: row.department ?? "",
    panTanNumber: row.panTanNumber ?? "",
    email: row.email ?? "",
    workOrderValue,
    workOrderDate: row.workOrderDate ? toDate(row.workOrderDate) : null,
    agreementNumber: row.agreementNumber ?? null,
    agreementDate: row.agreementDate ? toDate(row.agreementDate) : null,
    projectStartingDate: toDate(row.projectStartingDate),
    projectDurationDays: row.projectDurationDays,
    projectCompletionDate: toDate(row.projectCompletionDate),
    workOrderNumber: row.workOrderNumber ?? "",
    newProjectNumber,
    amountOfWorkOrder: row.amountOfWorkOrder,
    gstAmount: row.gstAmount,
    totalAmount,
    emdAmount: row.emdAmount?.trim() || "0.00",
    pgSdAmount: row.pgSdAmount?.trim() || "0.00",
    pgDate: row.pgDate ? toDate(row.pgDate) : null,
    pgExpiryDate: row.pgExpiryDate ? toDate(row.pgExpiryDate) : null,
    nameOfWork: row.nameOfWork,
    locationDistrict: row.locationDistrict ?? "",
    state: row.state ?? "",
    approvedProjectNumber: row.approvedProjectNumber,
    approvedBy: row.approvedBy
  };
}

export const projectImportService = {
  async bulkImport(rows: ProjectImportRowInput[]) {
    const created: Array<{ row: number; projectId: string; projectNumber: string; action: "created" | "updated" }> = [];
    const errors: Array<{ row: number; message: string }> = [];

    const batchProjectNumbers = new Map<string, number>();
    const batchProjectNames = new Map<string, number>();

    for (let index = 0; index < rows.length; index += 1) {
      const rowNumber = index + 1;
      const row = rows[index];
      const projectNumber = row.projectNumber.trim().toUpperCase();
      const projectName = row.projectName.trim();
      const numberKey = projectNumber;
      const nameKey = projectName.toLowerCase();

      try {
        const duplicateNumberRow = batchProjectNumbers.get(numberKey);
        if (duplicateNumberRow !== undefined) {
          throw conflict(`Duplicate Project Number "${projectNumber}" (same as import row ${duplicateNumberRow})`);
        }

        const duplicateNameRow = batchProjectNames.get(nameKey);
        if (duplicateNameRow !== undefined) {
          throw conflict(`Duplicate Project Name "${projectName}" (same as import row ${duplicateNameRow})`);
        }

        batchProjectNumbers.set(numberKey, rowNumber);
        batchProjectNames.set(nameKey, rowNumber);

        const totalAmount = resolveTotalAmount(row);
        const financialPayload = {
          woAmount: row.amountOfWorkOrder,
          woGstAmount: row.gstAmount,
          woTotalAmount: totalAmount,
          emdAmount: row.emdAmount?.trim() || "0.00",
          bgAmount: row.pgSdAmount?.trim() || "0.00",
          bgIssueDate: row.pgDate ? toDate(row.pgDate) : null,
          bgExpiryDate: row.pgExpiryDate ? toDate(row.pgExpiryDate) : null
        };

        const existingByNumber = await projectRepository.findFirstByProjectNumber(projectNumber);
        const existingByName = await projectRepository.findByName(projectName);

        if (existingByNumber && existingByName && existingByNumber.id !== existingByName.id) {
          throw conflict(
            `Project Number "${projectNumber}" and Project Name "${projectName}" belong to different existing projects`
          );
        }

        let projectId: string;
        let action: "created" | "updated";

        if (existingByNumber) {
          projectId = existingByNumber.id;
          action = "updated";
          await projectRepository.update(projectId, {
            name: projectName,
            description: row.projectDescription ?? undefined,
            projectNumber,
            ...financialPayload
          });
        } else if (existingByName) {
          projectId = existingByName.id;
          action = "updated";
          if (existingByName.projectNumber && existingByName.projectNumber !== projectNumber) {
            throw conflict(
              `Project Name "${projectName}" already exists with number ${existingByName.projectNumber}`
            );
          }
          await projectRepository.update(projectId, {
            description: row.projectDescription ?? undefined,
            projectNumber,
            ...financialPayload
          });
        } else {
          const createdProject = await projectRepository.create({
            name: projectName,
            description: row.projectDescription ?? undefined,
            projectNumber,
            woAmount: financialPayload.woAmount,
            woGstAmount: financialPayload.woGstAmount,
            woTotalAmount: financialPayload.woTotalAmount,
            emdAmount: financialPayload.emdAmount,
            bgAmount: financialPayload.bgAmount,
            bgIssueDate: financialPayload.bgIssueDate ?? undefined,
            bgExpiryDate: financialPayload.bgExpiryDate ?? undefined
          });
          projectId = createdProject.id;
          action = "created";
        }

        await projectRequisitionFormRepository.upsert(
          projectId,
          buildRequisitionPayload(projectId, row, totalAmount)
        );

        created.push({ row: rowNumber, projectId, projectNumber, action });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to import project";
        errors.push({ row: rowNumber, message });
      }
    }

    return {
      createdCount: created.length,
      failedCount: errors.length,
      created,
      errors
    };
  }
};
