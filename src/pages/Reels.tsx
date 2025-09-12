import { useMemo, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import ProgressiveVideo from "@/components/ProgressiveVideo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Heart, Share2, MessageCircle } from "lucide-react";
import { prefetchToCache } from "@/lib/cacheLRU";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { MobileTopNav } from "@/components/MobileTopNav";

export default function Reels() {
  const navigate = useNavigate();
  const reels = useQuery(api.posts.getFeedPosts, { limit: 50 });
  const onlyVideos = useMemo(
    () => (Array.isArray(reels) ? reels.filter((p: any) => (p.videos?.length || 0) > 0) : undefined),
    [reels]
  );

  // Prefetch next 1–2 reels' media when a reel enters view
  useEffect(() => {
    if (!onlyVideos) return;
    const nodes = document.querySelectorAll("[data-reel-idx]");
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset["reelIdx"] || -1);
            for (let i = idx + 1; i <= Math.min(onlyVideos.length - 1, idx + 2); i++) {
              const p: any = onlyVideos[i];
              (p?.videos || []).forEach((u: string) => prefetchToCache(u));
              (p?.images || []).forEach((u: string) => prefetchToCache(u));
            }
          }
        }
      },
      { rootMargin: "300px 0px" }
    );
    nodes.forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, [onlyVideos]);

  if (onlyVideos === undefined) {
    return (
      <div className="h-screen grid place-items-center bg-black text-white">
        <div className="flex items-center gap-2 text-sm opacity-80">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          Loading Reels…
        </div>
      </div>
    );
  }

  if (onlyVideos.length === 0) {
    return (
      <div className="h-screen bg-black text-white grid place-items-center">
        <div className="text-center px-6">
          <h2 className="text-2xl font-semibold mb-2">No reels yet</h2>
          <p className="text-white/70">When people post videos, they'll appear here.</p>
          <div className="mt-6">
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black text-white overflow-y-scroll snap-y snap-mandatory">
      {/* Top Navigation Bar */}
      <MobileTopNav showOnDesktop />

      {/* Reels list */}
      {onlyVideos.map((post: any, index: number) => (
        <section
          key={post._id as string}
          className="relative h-screen w-screen snap-start overflow-hidden"
          data-reel-idx={index}
        >
          {/* Video */}
          <div className="absolute inset-0">
            <ProgressiveVideo
              src={post.videos[0]}
              className="h-full w-full object-contain md:object-cover bg-black"
              // ProgressiveVideo autoplays a 3–4s muted preview; user tap continues with sound
              onLoadedData={() => {}}
            />
          </div>

          {/* Right-side actions */}
          <div className="absolute right-2 bottom-24 flex flex-col gap-4 items-center">
            <button
              className="grid place-items-center rounded-full bg-white/10 hover:bg-white/20 p-3 backdrop-blur"
              title="Like"
              aria-label="Like"
            >
              <Heart className="h-6 w-6" />
            </button>
            <button
              className="grid place-items-center rounded-full bg-white/10 hover:bg-white/20 p-3 backdrop-blur"
              title="Comment"
              aria-label="Comment"
            >
              <MessageCircle className="h-6 w-6" />
            </button>
            <button
              className="grid place-items-center rounded-full bg-white/10 hover:bg-white/20 p-3 backdrop-blur"
              title="Share"
              aria-label="Share"
              onClick={() => {
                try {
                  if (navigator.share) {
                    navigator
                      .share({ url: window.location.href, title: post.user?.name || "Reel" })
                      .catch(() => {});
                  }
                } catch {}
              }}
            >
              <Share2 className="h-6 w-6" />
            </button>
          </div>

          {/* Bottom-left meta */}
          <div className="absolute left-3 right-20 bottom-8">
            <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
              <div className="flex items-center gap-2 mb-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={post.user?.image} />
                  <AvatarFallback className="bg-white/20 text-white">
                    {post.user?.name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="font-semibold">{post.user?.name || "Anonymous"}</div>
              </div>
              {post.content && (
                <p className="text-sm text-white/90 max-w-[75vw] whitespace-pre-wrap">
                  {post.content}
                </p>
              )}
            </motion.div>

            {/* Hint for user action */}
            <div className="mt-2 text-xs text-white/70">Tap video to play with sound</div>
          </div>
        </section>
      ))}
    </div>
  );
}