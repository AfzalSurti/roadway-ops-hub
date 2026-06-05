const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");

export const ASSET_BILL_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.bmp,.doc,.docx,.xls,.xlsx";

const ASSET_BILL_ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/bmp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
]);

const ASSET_BILL_ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx"
]);

export function validateAssetBillFile(file: File): string | null {
  if (file.size > 10 * 1024 * 1024) {
    return "Bill file must be 10 MB or smaller";
  }

  const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase() : "";
  const mimeAllowed = ASSET_BILL_ALLOWED_MIME_TYPES.has(file.type);
  const extensionAllowed = ASSET_BILL_ALLOWED_EXTENSIONS.has(extension);

  if (!mimeAllowed && !extensionAllowed) {
    return "Unsupported bill format. Use PDF, PNG, JPG, or other common document/image formats";
  }

  return null;
}

export function resolveAssetBillUrl(url?: string | null): string | null {
  if (!url?.trim()) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`;
}

export function isAssetBillImage(mimeType?: string | null): boolean {
  return Boolean(mimeType?.startsWith("image/"));
}
