import React from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PostCard } from "./PostCard";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { prefetchToCache } from "@/lib/cacheLRU";

export function Feed() {
  const [limit, setLimit] = useState(20);
  const posts = useQuery(api.posts.getFeedPosts, { limit });
  const prefetched = useQuery(api.posts.getFeedPosts, { limit: limit + 10 });
  const listRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onScroll = () => {
      const nearBottom =
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 600;
      if (nearBottom) {
        // Append from prefetched chunk if available, else soft-increase
        setLimit((n) => {
          const target = Math.min(n + 10, (prefetched?.length ?? n + 10));
          return target > n ? target : n;
        });
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [prefetched]);

  // Add: IntersectionObserver sentinel to append from prefetched when near end (for smoothness on mobile/WebKit)
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setLimit((n) => {
              const target = Math.min(n + 10, (prefetched?.length ?? n + 10));
              return target > n ? target : n;
            });
          }
        }
      },
      { root: null, rootMargin: "800px 0px", threshold: 0 }
    );

    io.observe(sentinel);
    return () => io.disconnect();
  }, [prefetched]);

  // Prefetch next posts' media when near viewport
  useEffect(() => {
    if (!posts || posts.length === 0) return;
    const root = listRef.current || undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset["idx"] || -1);
            // Prefetch media for next 1–3 items
            for (let i = idx + 1; i <= Math.min(posts.length - 1, idx + 3); i++) {
              const p: any = posts[i];
              (p?.images || []).forEach((u: string) => prefetchToCache(u));
              (p?.videos || []).forEach((u: string) => prefetchToCache(u));
            }
          }
        }
      },
      { rootMargin: "400px 0px" }
    );

    const nodes = document.querySelectorAll("[data-feed-card-idx]");
    nodes.forEach((n) => observer.observe(n));

    return () => observer.disconnect();
  }, [posts]);

  // Add: Manage video playback like TikTok/IG Reels: play/reset on enter, pause on leave
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;

    const allVideos = Array.from(container.querySelectorAll<HTMLVideoElement>("video[data-pv='1']"));
    if (allVideos.length === 0) return;

    function pauseOthers(except?: HTMLVideoElement | null) {
      for (const v of allVideos) {
        if (v !== except) {
          try {
            v.pause();
          } catch {}
        }
      }
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const v = entry.target as HTMLVideoElement;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            try {
              // Always start from the beginning when it comes into view
              v.currentTime = 0;

              // Respect force-sound policy if set by the component
              if ((v.dataset.forceSound || "") === "1") {
                v.muted = false;
                v.volume = 1;
                v.controls = false;
              } else if ((v.dataset.userUnmuted || "") !== "1") {
                v.muted = true;
              }

              v.controls = false;
              v.play().catch(() => {});
              pauseOthers(v);
            } catch {}
          } else {
            try {
              v.pause();
            } catch {}
          }
        });
      },
      { root: null, threshold: [0, 0.6, 1], rootMargin: "0px 0px 200px 0px" }
    );

    allVideos.forEach((v) => io.observe(v));

    return () => {
      io.disconnect();
    };
  }, [posts]);

  if (posts === undefined) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-12"
      >
        <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
        <p className="text-muted-foreground">Be the first to share something!</p>
      </motion.div>
    );
  }

  return (
    <div ref={listRef} className="space-y-6">
      {posts.map((post: any, index: number) => (
        <motion.div
          key={post._id}
          data-feed-card-idx
          data-idx={index}
          initial={false}
          animate={{ y: 0, opacity: 1 }}
        >
          <PostCard post={post} />
        </motion.div>
      ))}
      {/* Add: invisible sentinel to trigger background-append without loaders */}
      <div ref={sentinelRef} aria-hidden="true" className="h-8" />
      <div className="h-12" />
    </div>
  );
}