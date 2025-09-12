import { useEffect, useMemo, useRef, useState } from "react";
import { cacheMatch, cachePut, prefetchToCache } from "@/lib/cacheLRU";

type Props = {
  src: string;
  alt?: string;
  className?: string;
  onLoad?: () => void;
};

export default function ProgressiveImage({ src, alt, className, onLoad }: Props) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const cached = await cacheMatch(src);
      if (cancelled) return;
      if (cached) {
        const blob = await cached.blob();
        if (cancelled) return;
        const obj = URL.createObjectURL(blob);
        if (imgRef.current) imgRef.current.src = obj;
        setLoaded(true);
        onLoad?.();
      } else {
        // Start network fetch and cache in background
        try {
          const res = await fetch(src, { cache: "no-store" });
          if (cancelled) return;
          if (res.ok) {
            const resClone = res.clone();
            cachePut(src, resClone).catch(() => {});
            const blob = await res.blob();
            if (cancelled) return;
            const obj = URL.createObjectURL(blob);
            if (imgRef.current) imgRef.current.src = obj;
            setLoaded(true);
            onLoad?.();
          }
        } catch {
          // fall back to direct src
          if (imgRef.current) imgRef.current.src = src;
        }
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [src, onLoad]);

  // subtle blur-up until loaded
  const cls = useMemo(
    () =>
      `${className || ""} transition-[filter,opacity] duration-300 ${
        loaded ? "opacity-100 filter-none" : "opacity-80 blur-sm"
      }`,
    [className, loaded]
  );

  return <img ref={imgRef} alt={alt} className={cls} loading="lazy" decoding="async" />;
}