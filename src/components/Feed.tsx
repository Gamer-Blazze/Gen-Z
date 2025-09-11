import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PostCard } from "./PostCard";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export function Feed() {
  const [limit, setLimit] = useState(20);
  const posts = useQuery(api.posts.getFeedPosts, { limit });

  useEffect(() => {
    const onScroll = () => {
      const nearBottom =
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 600;
      if (nearBottom) {
        setLimit((n) => (n < 200 ? n + 10 : n)); // soft cap
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
    <div className="space-y-6">
      {posts.map((post, index) => (
        <motion.div
          key={post._id}
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: index * 0.1 }}
        >
          <PostCard post={post} />
        </motion.div>
      ))}
      {/* Sentinel for spacing */}
      <div className="h-12" />
    </div>
  );
}