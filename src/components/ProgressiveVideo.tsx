import { useEffect, useRef, useState } from "react";
import { cacheMatch, cachePut, prefetchToCache } from "@/lib/cacheLRU";
import { useNetworkMode } from "@/hooks/use-network";
import { onUserInteractionUnlock, playWithSound } from "@/lib/autoplaySound";

type Props = {
  src: string;
  className?: string;
  onLoadedData?: () => void;
  mode?: "preview" | "loop";
  preload?: "auto" | "metadata" | "none";
  lazy?: boolean;
  // NEW: attempt to autoplay with sound at full volume (falls back to one-tap unlock)
  autoSound?: boolean;
};

export default function ProgressiveVideo({ src, className, onLoadedData, mode = "preview", preload = "metadata", lazy = false, autoSound = false }: Props) {
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

  // Autoplay behavior
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onLoaded = async () => {
      setReady(true);
      onLoadedData?.();
      v.loop = mode === "loop";

      // If autoSound is requested, try to start with sound immediately.
      if (autoSound) {
        // Mark as force sound for outside observers and not be re-muted
        (v as any).dataset.forceSound = "1";
        (v as any).dataset.userUnmuted = "1";
        try {
          await playWithSound(v);
        } catch (err: any) {
          // Likely autoplay with sound blocked; schedule retry after first user interaction
          onUserInteractionUnlock(async () => {
            try {
              await playWithSound(v);
            } catch {
              // ignore repeat failures
            }
          });
          // Start muted as a visual fallback until unlock
          try {
            v.muted = true;
            await v.play();
          } catch {
            // ignore
          }
        }
      } else {
        // Existing default: start muted
        v.muted = true;
        v.play().catch(() => {});
      }
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
  }, [previewDone, userEngaged, onLoadedData, mode, autoSound]);

  return (
    <div className="relative group">
      <video
        ref={videoRef}
        className={className}
        playsInline
        // If autoSound, we want controls visible only after user engages; keep consistent
        controls={userEngaged}
        preload={preload}
        loop={mode === "loop"}
        data-pv="1"
        // Mark intent for observers
        data-force-sound={autoSound ? "1" : undefined}
        onClick={(e) => {
          e.stopPropagation();
          const v = videoRef.current;
          if (!v) return;
          setUserEngaged(true);
          // Always try to enable sound and controls on click
          v.muted = false;
          v.volume = 1;
          (v as any).dataset.userUnmuted = "1";
          (v as any).dataset.forceSound = "1";
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
            v.volume = 1;
            (v as any).dataset.userUnmuted = "1";
            (v as any).dataset.forceSound = "1";
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