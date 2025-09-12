import { useEffect, useState } from "react";

export type NetworkMode = "wifi" | "cellular" | "unknown";

export function useNetworkMode(): NetworkMode {
  const [mode, setMode] = useState<NetworkMode>("unknown");

  useEffect(() => {
    const nav = (navigator as any);
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    const derive = () => {
      if (!conn || !conn.effectiveType) return "unknown";
      // effectiveType: 'slow-2g' | '2g' | '3g' | '4g'
      if (conn.type === "wifi" || conn.effectiveType === "4g") return "wifi";
      return "cellular";
    };
    setMode(derive());
    if (!conn) return;
    const handler = () => setMode(derive());
    conn.addEventListener?.("change", handler);
    return () => conn.removeEventListener?.("change", handler);
  }, []);

  return mode;
}
