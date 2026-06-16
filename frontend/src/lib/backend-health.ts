const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function probeBackendHealth(signal?: AbortSignal): Promise<boolean> {
  const paths = ["/health", "/api/health"];

  for (const path of paths) {
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: "GET",
        cache: "no-store",
        signal
      });
      if (response.ok) {
        return true;
      }
    } catch {
      // Render free tier may still be waking up.
    }
  }

  return false;
}

export async function waitForBackendReady(options?: {
  maxAttempts?: number;
  intervalMs?: number;
  signal?: AbortSignal;
}): Promise<boolean> {
  const maxAttempts = options?.maxAttempts ?? 45;
  const intervalMs = options?.intervalMs ?? 2500;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (options?.signal?.aborted) {
      return false;
    }

    if (await probeBackendHealth(options?.signal)) {
      return true;
    }

    if (attempt < maxAttempts - 1) {
      await sleep(intervalMs);
    }
  }

  return false;
}
