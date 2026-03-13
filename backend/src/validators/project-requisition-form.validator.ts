import { z } from "zod";

const optionalText = z.preprocess(
  (value) => (value === undefined || value === null ? "" : String(value)),
  z.string()
);

const optionalDate = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.date().optional()
);

const optionalNumber = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().optional()
);

export const upsertProjectRequisitionFormSchema = z.object({
  costCentreDepartment: optionalText,
  hodDirectorName: optionalText,
  applicationDate: optionalDate,
  clientName: optionalText,
  billingName: optionalText,
  addressWithPincode: optionalText,
  pincode: optionalText,
  gstNumber: optionalText,
  gstType: z.enum(["REGISTERED", "UNREGISTERED"]).optional().default("REGISTERED"),
  contactName: optionalText,
  contactNumber: optionalText,
  designation: optionalText,
  department: optionalText,
  panTanNumber: optionalText,
  email: optionalText,
  workOrderValue: optionalText,
  workOrderDate: optionalDate,
  agreementNumber: optionalText,
  agreementDate: optionalDate,
  projectStartingDate: optionalDate,
  projectDurationDays: optionalNumber,
  projectCompletionDate: optionalDate,
  workOrderNumber: optionalText,
  newProjectNumber: optionalText,
  amountOfWorkOrder: optionalText,
  gstAmount: optionalText,
  emdAmount: optionalText,
  pgSdAmount: optionalText,
  pgDate: optionalDate,
  pgExpiryDate: optionalDate,
  nameOfWork: optionalText,
  locationDistrict: optionalText,
  state: optionalText,
  approvedProjectNumber: optionalText,
  approvedBy: optionalText
});