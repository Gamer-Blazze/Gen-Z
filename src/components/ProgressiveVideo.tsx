import { useEffect, useRef, useState } from "react";
import { cacheMatch, cachePut, prefetchToCache } from "@/lib/cacheLRU";
import { useNetworkMode } from "@/hooks/use-network";

type Props = {
  src: string;
  className?: string;
  onLoadedData?: () => void;
  // Add: mode to control behavior (preview vs. continuous loop)
  mode?: "preview" | "loop";
  // Add: control preload behaviour
  preload?: "auto" | "metadata" | "none";
  // Add: lazy attach source only when in view
  lazy?: boolean;
};

export default function ProgressiveVideo({ src, className, onLoadedData, mode = "preview", preload = "metadata", lazy = false }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);
  const [previewDone, setPreviewDone] = useState(false);
  const [userEngaged, setUserEngaged] = useState(false);
  const net = useNetworkMode();
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!lazy) {
      setInView(true);
      return;
    }
    const el = videoRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
          }
        }
      },
      { rootMargin: "400px 0px", threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [lazy]);

  useEffect(() => {
    let cancelled = false;

    async function attachSource() {
      // Gate by lazy visibility
      if (!inView) return;

      // If cached, use it (offline support)
      const cached = await cacheMatch(src);
      if (cancelled) return;

      if (cached) {
        const blob = await cached.blob();
        if (cancelled) return;
        const obj = URL.createObjectURL(blob);
        if (videoRef.current) {
          videoRef.current.src = obj;
        }
      } else {
        // Load over network and cache
        try {
          const res = await fetch(src, { cache: "no-store" });
          if (cancelled) return;
          if (res.ok) {
            cachePut(src, res.clone()).catch(() => {});
            const blob = await res.blob();
            if (cancelled) return;
            const obj = URL.createObjectURL(blob);
            if (videoRef.current) {
              videoRef.current.src = obj;
            }
          } else {
            if (videoRef.current) videoRef.current.src = src;
          }
        } catch {
          if (videoRef.current) videoRef.current.src = src;
        }
      }
    }

    attachSource();

    // Prefetch aggressively on Wi‑Fi; lightly on cellular
    if (inView && net === "wifi") {
      prefetchToCache(src).catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [src, net, inView]);

  // Autoplay a 3–4s muted preview then pause (only in preview mode)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onLoaded = () => {
      setReady(true);
      onLoadedData?.();
      v.muted = true;
      v.loop = mode === "loop";
      v.play().catch(() => {});
    };

    const onTime = () => {
      if (mode !== "loop" && !previewDone && v.currentTime >= 3.5 && !userEngaged) {
        v.pause();
        setPreviewDone(true);
      }
    };

    v.addEventListener("loadeddata", onLoaded);
    v.addEventListener("timeupdate", onTime);
    return () => {
      v.removeEventListener("loadeddata", onLoaded);
      v.removeEventListener("timeupdate", onTime);
    };
  }, [previewDone, userEngaged, onLoadedData, mode]);

  return (
    <div className="relative group">
      <video
        ref={videoRef}
        className={className}
        playsInline
        controls={userEngaged}
        preload={preload}
        loop={mode === "loop"}
        data-pv="1"
        onClick={(e) => {
          e.stopPropagation();
          const v = videoRef.current;
          if (!v) return;
          setUserEngaged(true);
          v.muted = false;
          v.controls = true;
          v.play().catch(() => {});
        }}
      />
      {!ready && (
        <div className="absolute inset-0 grid place-items-center bg-black/40">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
        </div>
      )}
      {mode !== "loop" && previewDone && !userEngaged && (
        <button
          className="absolute inset-x-0 bottom-2 mx-auto w-[140px] rounded-full bg-white/90 text-black text-sm py-1.5 shadow group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            const v = videoRef.current;
            if (!v) return;
            setUserEngaged(true);
            v.muted = false;
            v.controls = true;
            v.play().catch(() => {});
          }}
        >
          Tap to play
        </button>
      )}
    </div>
  );
}