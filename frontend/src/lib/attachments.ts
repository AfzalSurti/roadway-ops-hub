const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");

export function resolveAttachmentUrl(url?: string | null): string | null {
  if (!url?.trim()) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith("blob:")) return url;
  const origin = API_BASE_URL.replace(/\/api$/i, "");
  return `${origin}${url.startsWith("/") ? url : `/${url}`}`;
}

type ViewerListener = (url: string | null) => void;
let viewerListener: ViewerListener | null = null;

export function registerAttachmentViewer(listener: ViewerListener) {
  viewerListener = listener;
  return () => {
    if (viewerListener === listener) viewerListener = null;
  };
}

export function openAttachment(url?: string | null) {
  const resolved = resolveAttachmentUrl(url);
  if (!resolved || !viewerListener) return;
  viewerListener(resolved);
}
