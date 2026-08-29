/** Base Subject Category options from Subject category.xlsx */
export const LETTER_SUBJECT_CATEGORIES = [
  "Tender",
  "Excess",
  "Time Limit",
  "Survey & Investigations",
  "MoM",
  "Inception",
  "Alignment",
  "Feasibility",
  "DPR",
  "Finance",
  "Site Visit",
  "NOC",
  "Reminder",
  "Delay",
  "Notice",
  "Submissions",
  "LAQ",
  "Contractor",
  "Force Majure",
  "Other",
  "Utility - LT Lines",
  "Utility - HT Lines",
  "Utility - EHT Lines",
  "Utility - Water Pipeline",
  "Utility - Sewage Line",
  "Utility - Storm Water Line",
  "Utility - Hand Pumps",
  "Utility - OFC Line",
  "Utility - Telephone Cable Line",
  "Utility - GAS Line",
  "Utility - CNG Line",
  "Utility - Petrolium Line",
  "Utility - Gantry Board",
  "Utility - Hoarding Board",
  "Utility - Other",
  "Clearance - Protected Forest",
  "Clearance - Reserved Forest",
  "Clearance - Environment",
  "Clearance - Wildlife",
  "Clearance - CRZ Clearance",
  "Clearance - Inlandwater",
  "Clearance - Railway",
  "Clearance - Irrigation",
  "Clearance - Archeology - State protected",
  "Clearance - Archeology - Central protected",
  "Clearance - NHAI",
  "Clearance - State PWD",
  "Clearance - Panchayat",
  "Clearance - Local Govt. Body",
  "Clearance - R&B Design Circle (Span>60m)",
  "Clearance - NIT (GAD Submission) (Span<= 60m)",
  "Clearance - Others",
] as const;

/** Selecting these opens a free-text box; typed value is saved and added to the dropdown. */
export const LETTER_SUBJECT_CATEGORY_OTHER_OPTIONS = [
  "Other",
  "Utility - Other",
  "Clearance - Others",
] as const;

const CUSTOM_STORAGE_KEY = "letter-subject-categories-custom";

export function isLetterSubjectCategoryOtherOption(value: string) {
  return (LETTER_SUBJECT_CATEGORY_OTHER_OPTIONS as readonly string[]).includes(value.trim());
}

export function loadCustomLetterSubjectCategories(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function saveCustomLetterSubjectCategory(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return;
  if ((LETTER_SUBJECT_CATEGORIES as readonly string[]).includes(trimmed)) return;
  if (isLetterSubjectCategoryOtherOption(trimmed)) return;

  const existing = loadCustomLetterSubjectCategories();
  if (existing.some((item) => item.toLowerCase() === trimmed.toLowerCase())) return;
  localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify([...existing, trimmed]));
}

export function mergeLetterSubjectCategories(extra: string[] = []): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const push = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(trimmed);
  };

  for (const item of LETTER_SUBJECT_CATEGORIES) push(item);
  for (const item of loadCustomLetterSubjectCategories()) push(item);
  for (const item of extra) push(item);
  return result;
}
