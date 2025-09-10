import { useEffect, useState } from "react";

export type DeviceKind = "mobile" | "tablet" | "desktop";

/**
 * useDevice returns the current device kind by width, re-evaluated on resize.
 * - mobile: < 640px
 * - tablet: 640px - 1024px
 * - desktop: > 1024px
 */
export function useDevice(): DeviceKind {
  const getKind = () => {
    const w = typeof window !== "undefined" ? window.innerWidth : 1024;
    if (w < 640) return "mobile";
    if (w <= 1024) return "tablet";
    return "desktop";
  };

  const [kind, setKind] = useState<DeviceKind>(getKind);

  useEffect(() => {
    const onResize = () => setKind(getKind());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return kind;
}
