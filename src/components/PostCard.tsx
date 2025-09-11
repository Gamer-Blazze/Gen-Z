import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Heart, MessageCircle, Share, Send } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Id } from "@/convex/_generated/dataModel";
import { useNavigate } from "react-router";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useEffect } from "react";

function linkify(text: string) {
  // very lightweight linkifier for URLs, #hashtags, and @mentions
  const parts = text.split(/(\s+)/);
  return parts.map((part, i) => {
    if (/^https?:\/\/\S+$/i.test(part)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
          {part}
        </a>
      );
    }
    if (/^#\w+$/i.test(part)) {
      const tag = part.slice(1);
      return (
        <a key={i} href={`#/hashtag/${encodeURIComponent(tag)}`} className="text-blue-600 hover:underline">
          {part}
        </a>
      );
    }
    if (/^@\w+$/i.test(part)) {
      const handle = part.slice(1);
      return (
        <a key={i} href={`#/user/${encodeURIComponent(handle)}`} className="text-blue-600 hover:underline">
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

interface PostCardProps {
  post: {
    _id: Id<"posts">;
    _creationTime: number;
    userId: Id<"users">;
    content: string;
    images?: string[];
    videos?: string[];
    likes: Id<"users">[];
    likesCount: number;
    commentsCount: number;
    sharesCount: number;
    isPublic: boolean;
    user: any;
  };
}

export function PostCard({ post }: PostCardProps) {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [commentContent, setCommentContent] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const navigate = useNavigate();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [viewerKind, setViewerKind] = useState<"image" | "video">("image");

  // ADD: measure media loading time
  const [mediaLoadStart, setMediaLoadStart] = useState<number | null>(null);
  const [mediaLoadMs, setMediaLoadMs] = useState<number | null>(null);

  useEffect(() => {
    // Start timing if the post has media and timing hasn't started yet
    const hasMedia = (post.images?.length ?? 0) > 0 || (post.videos?.length ?? 0) > 0;
    if (hasMedia && mediaLoadStart === null) {
      setMediaLoadStart(performance.now());
    }
  }, [post.images, post.videos, mediaLoadStart]);

  const markMediaLoaded = () => {
    if (mediaLoadMs !== null) return; // already recorded
    const now = performance.now();
    const start = mediaLoadStart ?? now;
    setMediaLoadMs(Math.max(0, now - start));
  };

  const openViewer = (src: string, kind: "image" | "video") => {
    setViewerSrc(src);
    setViewerKind(kind);
    setViewerOpen(true);
  };

  const toggleLike = useMutation(api.posts.toggleLike);
  const addComment = useMutation(api.posts.addComment);
  const comments = useQuery(api.posts.getPostComments, { postId: post._id });

  const isLiked = user ? post.likes.includes(user._id) : false;

  const handleLike = async () => {
    try {
      await toggleLike({ postId: post._id });
    } catch (error) {
      toast.error("Failed to like post");
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim()) return;

    setIsSubmittingComment(true);
    try {
      await addComment({
        postId: post._id,
        content: commentContent.trim(),
      });
      setCommentContent("");
      toast.success("Comment added!");
    } catch (error) {
      toast.error("Failed to add comment");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
    <Card className="border border-border/50 hover:border-border transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/profile?id=${post.userId}`)}
            className="shrink-0"
            aria-label="View profile"
          >
            <Avatar className="w-12 h-12 md:w-14 md:h-14">
              <AvatarImage src={post.user?.image} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {post.user?.name?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
          </button>
          <div className="flex-1">
            <p
              className="font-semibold cursor-pointer hover:underline"
              onClick={() => navigate(`/profile?id=${post.userId}`)}
            >
              {post.user?.name || "Anonymous"}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(post._creationTime), { addSuffix: true })}
              {mediaLoadMs !== null && (
                <span className="ml-2">
                  • media loaded in {(mediaLoadMs / 1000).toFixed(1)}s
                </span>
              )}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <p className="text-sm leading-relaxed mb-4 whitespace-pre-wrap">
          {linkify(post.content || "")}
        </p>

        {(post.images?.length ?? 0) > 0 && (
          <div
            className={`mb-4 rounded-lg overflow-hidden grid gap-2 ${
              (post.images?.length ?? 0) === 1 ? "grid-cols-1" :
              (post.images?.length ?? 0) === 2 ? "grid-cols-2" :
              "grid-cols-2"
            }`}
          >
            {(post.images ?? []).slice(0, 4).map((image, index) => (
              <img
                key={index}
                src={image}
                alt="Post image"
                className={`w-full h-auto ${((post.images?.length ?? 0) > 1 ? "aspect-video object-cover" : "object-contain")} rounded-xl bg-black/5 cursor-zoom-in`}
                loading="lazy"
                decoding="async"
                onLoad={markMediaLoaded}
                onClick={() => openViewer(image, "image")}
              />
            ))}
          </div>
        )}

        {post.videos && post.videos.length > 0 && (
          <div className="mb-4 rounded-lg overflow-hidden grid grid-cols-1 gap-2">
            {post.videos.map((video, index) => (
              <video
                key={index}
                src={video}
                controls
                className="w-full h-auto rounded-md bg-black cursor-zoom-in"
                preload="metadata"
                playsInline
                onLoadedData={markMediaLoaded}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openViewer(video, "video");
                }}
              />
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-4 py-2 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLike}
            className={`gap-2 ${isLiked ? "text-red-500 hover:text-red-600" : ""}`}
          >
            <Heart className={`w-4 h-4 ${isLiked ? "fill-current" : ""}`} />
            {post.likesCount}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowComments(!showComments)}
            className="gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            {post.commentsCount}
          </Button>

          <Button variant="ghost" size="sm" className="gap-2">
            <Share className="w-4 h-4" />
            {post.sharesCount}
          </Button>
        </div>

        {/* Comments Section */}
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="mt-4 pt-4 border-t border-border/50"
          >
            {/* Add Comment */}
            <form onSubmit={handleComment} className="mb-4">
              <div className="flex gap-2">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user?.image} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {user?.name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 flex gap-2">
                  <Textarea
                    placeholder="Write a comment..."
                    value={commentContent}
                    onChange={(e) => setCommentContent(e.target.value)}
                    className="min-h-[60px] resize-none text-sm"
                    maxLength={200}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!commentContent.trim() || isSubmittingComment}
                    className="self-end"
                  >
                    {isSubmittingComment ? (
                      <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </form>

            {/* Comments List */}
            {comments && comments.length > 0 && (
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment._id} className="flex gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={comment.user?.image} />
                      <AvatarFallback className="bg-muted text-xs">
                        {comment.user?.name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="bg-muted rounded-lg p-3">
                        <p className="font-medium text-sm">{comment.user?.name || "Anonymous"}</p>
                        <p className="text-sm">{comment.content}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                          <Heart className="w-3 h-3 mr-1" />
                          {comment.likesCount}
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(comment._creationTime), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </CardContent>

      {/* Add: Full-screen media viewer */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="p-0 max-w-[95vw] md:max-w-[90vw] bg-black">
          <div className="w-full h-full flex items-center justify-center p-0 md:p-2">
            {viewerSrc && viewerKind === "image" && (
              <img
                src={viewerSrc}
                alt="Full view"
                className="max-h-[85vh] w-auto h-auto object-contain select-none"
                draggable={false}
              />
            )}
            {viewerSrc && viewerKind === "video" && (
              <video
                src={viewerSrc}
                controls
                autoPlay
                className="max-h-[85vh] w-auto h-auto object-contain"
                playsInline
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}