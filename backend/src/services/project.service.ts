import { projectRepository } from "../repositories/project.repository.js";
import { badRequest, conflict, notFound } from "../utils/errors.js";

export const COMPANY_OPTIONS = [
  { label: "Geo Designs & Research Pvt. Ltd", code: "G" },
  { label: "Sai Geotechnical Lab", code: "S" },
  { label: "Inertia Engineering Solution", code: "I" },
  { label: "Shree Hari Testing Lab", code: "H" }
] as const;

export const TECHNICAL_UNIT_OPTIONS = [
  { label: "Testing Consultancy", code: "T" },
  { label: "Supervision Consultancy", code: "S" },
  { label: "Building Designs Consultancy", code: "D" }
] as const;

export const SUB_TECHNICAL_UNIT_OPTIONS = {
  T: [
    { label: "Geotechnical Exploration", code: "GE" },
    { label: "Laboratory Testing", code: "MT" },
    { label: "Load Testing Services (Bridge/Pile)", code: "LT" },
    { label: "Chemical Environment Testing", code: "CE" },
    { label: "NDT", code: "ND" }
  ],
  S: [
    { label: "Authority Engineer", code: "AE" },
    { label: "Independent Engineer", code: "IE" },
    { label: "Project Management Consultant", code: "PM" },
    { label: "Third Party Inspection", code: "TP" },
    { label: "Proof Checking", code: "PC" },
    { label: "Field Highway Testing", code: "FH" },
    { label: "Road Safety Audit", code: "RS" },
    { label: "Environment Audit", code: "EA" }
  ],
  D: [
    { label: "Architectural Design", code: "AR" },
    { label: "Structural Design", code: "ST" },
    { label: "BIM Services", code: "BM" },
    { label: "Utilities Design Services", code: "UD" },
    { label: "Quantity Survey & Estimation", code: "QS" },
    { label: "Energy Audit Services", code: "EN" },
    { label: "Green Building Services", code: "GB" },
    { label: "Building Infrastructure Designs", code: "BU" },
    { label: "Road Infrastructure Designs", code: "IR" },
    { label: "Bridge Infrastructure Designs", code: "IB" },
    { label: "Industrial Infrastructure & Park", code: "IS" },
    { label: "Marine Infrastructure", code: "MS" },
    { label: "Detail Design Infrastructure", code: "DD" },
    { label: "Hydro Engineering", code: "HE" },
    { label: "Tunnel Engineering", code: "TE" }
  ]
} as const;

export const FH_WORK_CATEGORY_OPTIONS = [
  { label: "NSV Test", code: "N" },
  { label: "FWD Test", code: "F" },
  { label: "BBD Test", code: "B" },
  { label: "Roughness Index (BI/IRI) Test", code: "I" },
  { label: "Pavement Design", code: "P" },
  { label: "Retro Reflectometer Test", code: "R" },
  { label: "Topography / LiDAR Survey", code: "S" },
  { label: "Traffic Survey (Incl. ATCC / TMC / Videography / Axel load etc.)", code: "T" },
  { label: "Bridge Load Test", code: "L" },
  { label: "Mobile Bridge Inspection Unit", code: "M" }
] as const;

export const DEFAULT_WORK_CATEGORY_OPTIONS = [
  { label: "Road", code: "R" },
  { label: "Building", code: "B" },
  { label: "Canal", code: "C" },
  { label: "Irrigation", code: "I" },
  { label: "Bridge", code: "G" },
  { label: "Pre Bid", code: "P" },
  { label: "Drainage", code: "D" }
] as const;

function getFinancialYearShort(referenceDate = new Date()): number {
  const month = referenceDate.getMonth();
  const year = referenceDate.getFullYear();
  return month >= 3 ? year % 100 : (year - 1) % 100;
}

function validateSubTechnicalUnit(technicalUnitCode: "T" | "S" | "D", subTechnicalUnitCode: string) {
  const options = SUB_TECHNICAL_UNIT_OPTIONS[technicalUnitCode] ?? [];
  if (!options.some((item) => item.code === subTechnicalUnitCode)) {
    throw badRequest("Invalid sub technical unit code for selected technical unit");
  }
}

async function buildBaseCode(args: {
  companyCode: string;
  technicalUnitCode: "T" | "S" | "D";
  subTechnicalUnitCode: string;
}) {
  validateSubTechnicalUnit(args.technicalUnitCode, args.subTechnicalUnitCode);

  const projectCodePrefix = `${args.companyCode}${args.technicalUnitCode}${args.subTechnicalUnitCode}`;
  const financialYearShort = getFinancialYearShort();
  const maxSerial = await projectRepository.findMaxSerialForPrefixYear(projectCodePrefix, financialYearShort);
  const serialNumber = (maxSerial?.serialNumber ?? 0) + 1;
  const serial = String(serialNumber).padStart(2, "0");
  const baseCode = `${projectCodePrefix}${String(financialYearShort).padStart(2, "0")}${serial}`;

  return {
    projectCodePrefix,
    financialYearShort,
    serialNumber,
    baseCode
  };
}

export const projectService = {
  list() {
    return projectRepository.findMany();
  },
  listWithoutNumber() {
    return projectRepository.findWithoutNumber();
  },
  getNumberingOptions() {
    return {
      companies: COMPANY_OPTIONS,
      technicalUnits: TECHNICAL_UNIT_OPTIONS,
      subTechnicalUnits: SUB_TECHNICAL_UNIT_OPTIONS,
      workCategories: {
        fieldHighwayTesting: FH_WORK_CATEGORY_OPTIONS,
        default: DEFAULT_WORK_CATEGORY_OPTIONS
      }
    };
  },
  async previewProjectNumber(payload: { companyCode: string; technicalUnitCode: "T" | "S" | "D"; subTechnicalUnitCode: string }) {
    return buildBaseCode(payload);
  },
  async assignProjectNumber(
    projectId: string,
    payload: {
      companyCode: string;
      technicalUnitCode: "T" | "S" | "D";
      subTechnicalUnitCode: string;
      workCategoryCode: string;
    }
  ) {
    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw notFound("Project not found");
    }
    if (project.projectNumber) {
      throw conflict("Project number already assigned for this project");
    }

    const base = await buildBaseCode(payload);

    const validWorkCategoryCodes = payload.subTechnicalUnitCode === "FH"
      ? FH_WORK_CATEGORY_OPTIONS.map((item) => item.code)
      : DEFAULT_WORK_CATEGORY_OPTIONS.map((item) => item.code);
    if (!validWorkCategoryCodes.includes(payload.workCategoryCode)) {
      throw badRequest("Invalid work category code for selected sub technical unit");
    }

    const projectNumber = `${base.baseCode}${payload.workCategoryCode}`;

    return projectRepository.assignNumber(projectId, {
      projectNumber,
      projectCodePrefix: base.projectCodePrefix,
      companyCode: payload.companyCode,
      technicalUnitCode: payload.technicalUnitCode,
      subTechnicalUnitCode: payload.subTechnicalUnitCode,
      workCategoryCode: payload.workCategoryCode,
      financialYearShort: base.financialYearShort,
      serialNumber: base.serialNumber,
      projectNumberAssignedAt: new Date()
    });
  },
  async create(payload: { name: string; description?: string }) {
    const existing = await projectRepository.findByName(payload.name);
    if (existing) {
      throw conflict("Project with this name already exists");
    }

    return projectRepository.create({
      name: payload.name,
      description: payload.description
    });
  },
  async remove(id: string) {
    const existing = await projectRepository.findById(id);
    if (!existing) {
      throw notFound("Project not found");
    }

    await projectRepository.delete(id);
    return { deleted: true };
  }
};