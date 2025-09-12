import { useEffect, useRef, useState } from "react";
import { cacheMatch, cachePut, prefetchToCache } from "@/lib/cacheLRU";
import { useNetworkMode } from "@/hooks/use-network";

type Props = {
  src: string;
  className?: string;
  onLoadedData?: () => void;
  // Add: mode to control behavior (preview vs. continuous loop)
  mode?: "preview" | "loop";
};

export default function ProgressiveVideo({ src, className, onLoadedData, mode = "preview" }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);
  const [previewDone, setPreviewDone] = useState(false);
  const [userEngaged, setUserEngaged] = useState(false);
  const net = useNetworkMode();

  useEffect(() => {
    let cancelled = false;

    async function attachSource() {
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
    if (net === "wifi") {
      prefetchToCache(src).catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [src, net]);

  // Autoplay a 3–4s muted preview then pause (only in preview mode)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onLoaded = () => {
      setReady(true);
      onLoadedData?.();
      // auto-play muted
      v.muted = true;
      // Add: loop mode enables continuous looping
      v.loop = mode === "loop";
      v.play().catch(() => {});
    };

    const onTime = () => {
      // Only pause after 3.5s in preview mode
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
        preload="metadata"
        // Add: ensure loop attribute reflects mode as well
        loop={mode === "loop"}
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