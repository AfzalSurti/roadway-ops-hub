import { useCallback, useEffect, useState } from "react";
import { waitForBackendReady } from "@/lib/backend-health";
import { GeoEarthLoader } from "@/components/GeoEarthLoader";

type GateState = "loading" | "ready" | "failed";

export function BackendReadyGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GateState>("loading");
  const [retrying, setRetrying] = useState(false);

  const connect = useCallback(async (signal?: AbortSignal) => {
    const ok = await waitForBackendReady({ signal });
    if (signal?.aborted) {
      return;
    }
    setState(ok ? "ready" : "failed");
    setRetrying(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void connect(controller.signal);
    return () => controller.abort();
  }, [connect]);

  const handleRetry = () => {
    setRetrying(true);
    setState("loading");
    void connect();
  };

  if (state === "ready") {
    return <>{children}</>;
  }

  return (
    <GeoEarthLoader
      failed={state === "failed"}
      onRetry={state === "failed" ? handleRetry : undefined}
      retrying={retrying}
    />
  );
}
