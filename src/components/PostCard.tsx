import { useState, memo } from "react";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import ProgressiveVideo from "@/components/ProgressiveVideo";
import ProgressiveImage from "@/components/ProgressiveImage";
import { Volume2, VolumeX } from "lucide-react";
import { useRef } from "react";

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

const LikeToggleButton = memo(function LikeToggleButton({
  isLiked,
  count,
  onClick,
  disabled,
}: {
  isLiked: boolean;
  count: number;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      aria-pressed={isLiked}
      aria-label={isLiked ? "Unlike" : "Like"}
      title={isLiked ? "Unlike" : "Like"}
      aria-busy={disabled ? true : undefined}
      disabled={disabled}
      className={`group relative z-10 gap-2 rounded-full px-3 py-1.5 transition-all active:scale-[0.98] pointer-events-auto border ${
        isLiked
          ? "bg-red-600/10 text-red-600 border-red-300 hover:bg-red-600/15 hover:text-red-700 focus-visible:ring-2 focus-visible:ring-red-500/40 dark:border-red-500/30"
          : "bg-muted/60 text-foreground border-border/60 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/60"
      } shadow-sm`}
      data-state={isLiked ? "on" : "off"}
    >
      <Heart
        className={`w-4 h-4 transition-transform duration-200 ${
          isLiked ? "scale-110 fill-current drop-shadow-sm" : "scale-100"
        }`}
      />
      <span className="text-xs sm:text-sm font-medium">
        {isLiked ? "Unlike" : "Like"}
      </span>
      <span aria-hidden="true" className="ml-1 tabular-nums text-xs sm:text-sm font-semibold">
        {count}
      </span>
    </Button>
  );
});

const MediaSection = memo(function MediaSection({
  postId,
  images,
  videos,
  onImageLoad,
  onVideoLoad,
  videoMuted,
  toggleSoundAt,
}: {
  postId: string;
  images: string[];
  videos: string[];
  onImageLoad: () => void;
  onVideoLoad: () => void;
  videoMuted: Record<number, boolean>;
  toggleSoundAt: (index: number) => void;
}) {
  return (
    <>
      {images.length > 0 && (
        <div
          className={`mb-4 rounded-lg overflow-hidden grid gap-2 ${
            images.length === 1 ? "grid-cols-1" : images.length === 2 ? "grid-cols-2" : "grid-cols-2"
          }`}
        >
          {images.slice(0, 4).map((image, index) => (
            <ProgressiveImage
              key={index}
              src={image}
              alt="Post image"
              className={`w-full h-auto ${images.length > 1 ? "aspect-video object-cover" : "object-contain"} rounded-xl bg-black/5 cursor-zoom-in`}
              onLoad={onImageLoad}
            />
          ))}
        </div>
      )}

      {videos.length > 0 && (
        <div className="mb-4 rounded-lg overflow-hidden grid grid-cols-1 gap-2">
          {videos.map((video, index) => (
            <div
              key={index}
              className="relative"
              data-post-id={postId}
              data-video-idx={index}
            >
              <ProgressiveVideo
                src={video}
                className="w-full h-auto rounded-md bg-black"
                onLoadedData={onVideoLoad}
                mode="loop"
                lazy
                preload="metadata"
                autoSound
              />
              <button
                type="button"
                aria-label={videoMuted[index] ? "Unmute" : "Mute"}
                title={videoMuted[index] ? "Unmute" : "Mute"}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSoundAt(index);
                }}
                className="absolute bottom-3 right-3 z-10 grid place-items-center rounded-full bg-black/60 hover:bg-black/70 text-white p-2"
              >
                {videoMuted[index] ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}, (prev, next) => {
  // Prevent media re-renders unless media or mute state changes
  const sameImages = prev.images.length === next.images.length && prev.images.every((v, i) => v === next.images[i]);
  const sameVideos = prev.videos.length === next.videos.length && prev.videos.every((v, i) => v === next.videos[i]);
  const sameMutedKeys = Object.keys(prev.videoMuted).length === Object.keys(next.videoMuted).length &&
    Object.keys(prev.videoMuted).every((k) => prev.videoMuted[Number(k)] === next.videoMuted[Number(k)]);
  return prev.postId === next.postId && sameImages && sameVideos && sameMutedKeys;
});

function PostCardInner({ post }: PostCardProps) {
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

  // Track per-video mute UI state
  const [videoMuted, setVideoMuted] = useState<Record<number, boolean>>({});

  // Helper: toggle sound for a given video container (by index)
  function toggleSoundAt(index: number) {
    const container = document.querySelector<HTMLDivElement>(`[data-post-id='${post._id as unknown as string}'][data-video-idx='${index}']`);
    if (!container) return;
    const video = container.querySelector<HTMLVideoElement>("video[data-pv='1']");
    if (!video) return;

    const willUnmute = video.muted;
    if (willUnmute) {
      // Mute all others first
      const all = Array.from(document.querySelectorAll<HTMLVideoElement>("video[data-pv='1']"));
      for (const v of all) {
        if (v !== video) {
          v.muted = true;
          v.dataset.userUnmuted && delete v.dataset.userUnmuted;
        }
      }
      // Unmute this one and mark as user-unmuted
      video.muted = false;
      video.dataset.userUnmuted = "1";
    } else {
      // Mute this one and clear the flag
      video.muted = true;
      video.dataset.userUnmuted && delete video.dataset.userUnmuted;
    }
    setVideoMuted((prev) => ({ ...prev, [index]: video.muted }));
  }

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

  const isOwner = user && ((user._id as unknown as string) === (post.userId as unknown as string));

  const toggleLike = useMutation(api.posts.toggleLike);
  const addComment = useMutation(api.posts.addComment);
  const sharePost = useMutation(api.posts.sharePost);
  const deletePost = useMutation(api.posts.deletePost);
  const editPost = useMutation(api.posts.editPost);
  const comments = useQuery(api.posts.getPostComments, { postId: post._id });

  // NEW: See more / See less for long text
  const [collapsed, setCollapsed] = useState(true);
  const isLong = (post.content?.length || 0) > 220;
  const displayedContent = collapsed && isLong ? `${post.content.slice(0, 220)}…` : post.content || "";

  // NEW: Quick emoji bar for comments
  const quickEmojis = ["👍", "❤️", "😂", "😮", "😢", "😡", "🎉", "🙏"];

  // Optimistic like state to avoid DOM replacement/flicker
  const [localLiked, setLocalLiked] = useState<boolean>(() => {
    return user ? post.likes.includes(user._id) : false;
  });
  const [localLikesCount, setLocalLikesCount] = useState<number>(post.likesCount);
  const [pendingCount, setPendingCount] = useState<number>(0);
  // Add: brief click cooldown to prevent rapid double-clicks beyond in-flight disable
  const [cooldown, setCooldown] = useState(false);

  // Reconcile optimistic like state when backend data changes (avoid mid-flight stomping)
  useEffect(() => {
    // If any toggles are still in flight, don't overwrite the local optimistic state
    if (pendingCount > 0) return;
    const serverLiked = user ? post.likes.includes(user._id) : false;
    setLocalLiked(serverLiked);
    setLocalLikesCount(post.likesCount);
  }, [post.likes, post.likesCount, user, pendingCount]);

  const isLiked = localLiked;

  // Add: friendly error classifier for like/unlike
  function getFriendlyLikeErrorMessage(error: any): string {
    const raw = (error?.message || "").toString().toLowerCase();
    if (raw.includes("not authenticated")) return "Please sign in to like posts.";
    if (raw.includes("post not found")) return "This post is no longer available.";
    if (raw.includes("permission") || raw.includes("authorized")) return "You can't like this post.";
    if (raw.includes("rate") || raw.includes("429") || raw.includes("too many")) return "You're tapping too fast. Please slow down.";
    if (raw.includes("network") || raw.includes("failed to fetch") || raw.includes("timeout") || raw.includes("ecconn")) {
      return "Network issue while updating your like. Please try again.";
    }
    return "Couldn't update your like. Please try again.";
  }

  const handleLike = async () => {
    // Add: short cooldown to throttle rapid taps (in addition to pending disable)
    if (cooldown) return;
    setCooldown(true);
    setTimeout(() => setCooldown(false), 450);

    // Snapshot current state
    const prevLiked = localLiked;
    const prevCount = localLikesCount;

    // Optimistic next state
    const nextLiked = !prevLiked;
    const delta = nextLiked ? 1 : -1;

    // Apply optimistic UI
    setLocalLiked(nextLiked);
    setLocalLikesCount(Math.max(0, prevCount + delta));
    setPendingCount((c) => c + 1);

    // Offline fast-path: revert immediately and notify
    if (typeof navigator !== "undefined" && navigator && navigator.onLine === false) {
      setLocalLiked(prevLiked);
      setLocalLikesCount(prevCount);
      setPendingCount((c) => Math.max(0, c - 1));
      toast.error("You're offline. Connect to the internet and try again.");
      return;
    }

    try {
      // Server returns the definitive liked state after toggle
      const serverLiked = await toggleLike({ postId: post._id });

      // Reconcile UI with server result only if it differs from optimistic state
      if (serverLiked !== nextLiked) {
        // Revert like state and count back to what server says (one step back from optimistic)
        setLocalLiked(serverLiked);
        setLocalLikesCount((c) => Math.max(0, c - delta));
      }
    } catch (error: any) {
      // On error, hard revert to original state and show friendly message
      setLocalLiked(prevLiked);
      setLocalLikesCount(prevCount);
      toast.error(getFriendlyLikeErrorMessage(error));
    } finally {
      setPendingCount((c) => Math.max(0, c - 1));
    }
  };

  const handleShare = async () => {
    try {
      await sharePost({ postId: post._id });
      toast("Post shared");
    } catch {
      toast.error("Failed to share");
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

  const handleDelete = async () => {
    const ok = window.confirm("Delete this post?");
    if (!ok) return;
    try {
      await deletePost({ postId: post._id });
      toast.success("Post deleted");
    } catch {
      toast.error("Failed to delete post");
    }
  };

  const handleSaveEdit = async () => {
    if (!editedContent.trim()) {
      toast.error("Content cannot be empty");
      return;
    }
    try {
      await editPost({
        postId: post._id,
        content: editedContent.trim(),
        location: (post as any).location,
        feeling: (post as any).feeling,
      });
      setEditing(false);
      toast.success("Post updated");
    } catch {
      toast.error("Failed to update post");
    }
  };

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(post.content);

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

          {/* NEW: Owner actions */}
          {isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit post
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete post
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Content with See more/less OR edit textarea */}
        {!editing ? (
          <>
            <p className="text-sm leading-relaxed mb-2 whitespace-pre-wrap">
              {linkify(displayedContent)}
            </p>
            {isLong && (
              <button
                type="button"
                className="text-xs text-[#1877F2] hover:underline mb-2"
                onClick={() => setCollapsed((s) => !s)}
              >
                {collapsed ? "See more" : "See less"}
              </button>
            )}
          </>
        ) : (
          <div className="mb-3">
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="min-h-[100px] text-sm"
            />
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={handleSaveEdit} className="bg-[#1877F2] hover:bg-[#166FE5] text-white">
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setEditing(false); setEditedContent(post.content); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Optional: small meta line for location/feeling if available */}
        {(post as any).location || (post as any).feeling ? (
          <div className="text-xs text-muted-foreground mb-3">
            {(post as any).feeling ? `Feeling ${(post as any).feeling}` : ""}
            {(post as any).feeling && (post as any).location ? " · " : ""}
            {(post as any).location ? `At ${(post as any).location}` : ""}
          </div>
        ) : null}

        {(post.images?.length ?? 0) > 0 || (post.videos?.length ?? 0) > 0 ? (
          <MediaSection
            postId={post._id as unknown as string}
            images={(post.images ?? []) as string[]}
            videos={(post.videos ?? []) as string[]}
            onImageLoad={markMediaLoaded}
            onVideoLoad={markMediaLoaded}
            videoMuted={videoMuted}
            toggleSoundAt={toggleSoundAt}
          />
        ) : null}

        {/* Action Buttons */}
        <div className="flex items-center gap-4 py-2 border-t border-border/50">
          <LikeToggleButton
            isLiked={isLiked}
            count={localLikesCount}
            onClick={handleLike}
            // Disable during server call and brief cooldown to block rapid taps
            disabled={pendingCount > 0 || cooldown}
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowComments(!showComments)}
            className="gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            {post.commentsCount}
          </Button>

          <Button variant="ghost" size="sm" className="gap-2" onClick={handleShare}>
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
            {/* NEW: Quick emoji bar */}
            <div className="mb-2 flex flex-wrap gap-1">
              {quickEmojis.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="px-2 py-1 text-base rounded-md hover:bg-muted"
                  onClick={() => setCommentContent((c) => `${c}${e}`)}
                  aria-label={`Insert ${e}`}
                  title={`Insert ${e}`}
                >
                  {e}
                </button>
              ))}
            </div>

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
                {comments.map((comment: any) => (
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

export const PostCard = memo(PostCardInner, (prev, next) => {
  const p = prev.post as any;
  const n = next.post as any;

  // Different post doc
  if ((p._id as unknown as string) !== (n._id as unknown as string)) return false;

  // Re-render when content or media changes
  if (p.content !== n.content) return false;
  if ((p.images?.length || 0) !== (n.images?.length || 0)) return false;
  if ((p.videos?.length || 0) !== (n.videos?.length || 0)) return false;

  // Re-render when engagement other than likes changes
  if (p.commentsCount !== n.commentsCount) return false;
  if (p.sharesCount !== n.sharesCount) return false;

  // Ownership changes
  if ((p.userId as unknown as string) !== (n.userId as unknown as string)) return false;

  // Header user updates
  const pu = p.user || {};
  const nu = n.user || {};
  if ((pu._id as unknown as string) !== (nu._id as unknown as string)) return false;
  if (pu.name !== nu.name) return false;
  if (pu.image !== nu.image) return false;

  return true;
});