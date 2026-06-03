import type { ProjectItem } from "./domain";

export function getFinancialYearShort(referenceDate = new Date()): number {
  const month = referenceDate.getMonth();
  const year = referenceDate.getFullYear();
  return month >= 3 ? year % 100 : (year - 1) % 100;
}

export function parseManualFinancialYearShort(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed || !/^\d{2,4}$/.test(trimmed)) {
    return null;
  }

  const numeric = Number(trimmed);
  if (!Number.isInteger(numeric)) {
    return null;
  }

  if (trimmed.length === 4) {
    if (numeric < 1900 || numeric > 2100) {
      return null;
    }
    return numeric % 100;
  }

  if (numeric < 0 || numeric > 99) {
    return null;
  }

  return numeric;
}

export function formatFinancialYearShort(fy: number): string {
  return String(fy).padStart(2, "0");
}

export function getMaxSerialForPrefixYear(
  projects: ProjectItem[],
  projectCodePrefix: string,
  financialYearShort: number
): number {
  return projects
    .map((project) => {
      if (project.projectCodePrefix === projectCodePrefix && project.financialYearShort === financialYearShort) {
        return project.serialNumber ?? 0;
      }
      const number = project.projectNumber?.trim();
      if (!number) return 0;
      const match = number.match(/^([A-Z]{4})(\d{2})(\d{2})[A-Z]$/);
      if (!match) return 0;
      const [, prefix, year, serial] = match;
      if (prefix !== projectCodePrefix || Number(year) !== financialYearShort) return 0;
      return Number(serial) || 0;
    })
    .reduce((max, value) => Math.max(max, value), 0);
}

export function buildProjectBaseCode(args: {
  companyCode: string;
  technicalUnitCode: string;
  subTechnicalUnitCode: string;
  financialYearShort: number;
  projects: ProjectItem[];
}): string {
  const projectCodePrefix = `${args.companyCode}${args.technicalUnitCode}${args.subTechnicalUnitCode}`;
  const fyText = formatFinancialYearShort(args.financialYearShort);
  const maxSerial = getMaxSerialForPrefixYear(args.projects, projectCodePrefix, args.financialYearShort);
  return `${projectCodePrefix}${fyText}${String(maxSerial + 1).padStart(2, "0")}`;
}
