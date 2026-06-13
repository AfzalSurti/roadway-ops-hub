import { z } from "zod";

const optionalText = z.preprocess(
  (value) => (value === undefined || value === null ? "" : String(value)),
  z.string()
);

const optionalNullableText = z.preprocess(
  (value) => {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text.length ? text : null;
  },
  z.string().nullable().optional()
);

const requiredDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

const optionalDateString = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === "") return null;
    return String(value);
  },
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").nullable().optional()
);

export const projectImportRowSchema = z.object({
  projectName: z.string().trim().min(1, "Project Name is required"),
  projectNumber: z.string().trim().min(1, "Project Number is required"),
  projectDescription: optionalNullableText,
  costCentreDepartment: z.string().trim().min(1, "Cost Centre / Department is required"),
  hodDirectorName: z.string().trim().min(1, "HOD / Director Name is required"),
  applicationDate: requiredDateString,
  clientName: z.string().trim().min(1, "Client Name is required"),
  billingName: z.string().trim().min(1, "Billing Name is required"),
  addressWithPincode: optionalNullableText,
  pincode: optionalNullableText,
  gstNumber: optionalNullableText,
  gstType: z.enum(["REGISTERED", "UNREGISTERED"]).optional().default("REGISTERED"),
  contactName: optionalNullableText,
  contactNumber: optionalNullableText,
  designation: optionalNullableText,
  department: optionalNullableText,
  panTanNumber: optionalNullableText,
  email: optionalNullableText,
  workOrderValue: optionalText,
  workOrderDate: optionalDateString,
  agreementNumber: optionalNullableText,
  agreementDate: optionalDateString,
  projectStartingDate: requiredDateString,
  projectDurationDays: z.coerce.number().int().min(0, "Project Duration (days) must be >= 0"),
  projectCompletionDate: requiredDateString,
  workOrderNumber: optionalNullableText,
  newProjectNumber: optionalText,
  amountOfWorkOrder: z.string().trim().min(1, "Amount of Work Order is required"),
  gstAmount: z.string().trim().min(1, "GST Amount is required"),
  totalAmount: optionalText,
  emdAmount: optionalText,
  pgSdAmount: optionalText,
  pgDate: optionalDateString,
  pgExpiryDate: optionalDateString,
  nameOfWork: z.string().trim().min(1, "Name of Work is required"),
  locationDistrict: optionalNullableText,
  state: optionalNullableText,
  approvedProjectNumber: z.string().trim().min(1, "Approved Project Number is required"),
  approvedBy: z.string().trim().min(1, "Approved By is required")
});

export const bulkImportProjectsSchema = z.object({
  rows: z.array(projectImportRowSchema).min(1, "At least one project row is required").max(200, "Maximum 200 projects per import")
});

export type ProjectImportRowInput = z.infer<typeof projectImportRowSchema>;
