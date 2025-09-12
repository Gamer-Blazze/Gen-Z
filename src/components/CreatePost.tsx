import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Send, Image as ImageIcon, X } from "lucide-react";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, Users, Lock } from "lucide-react";
import { Video as VideoIcon, Clapperboard } from "lucide-react";

// Direct post (text-only) composer
export function CreatePost() {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createPost = useMutation(api.posts.createPost);

  // Add: media state
  const [files, setFiles] = useState<Array<File>>([]);
  const fileInputId = "create-post-media-input";

  // Add: upload action
  const generateUploadUrl = useAction(api.files.generateUploadUrl);

  // Add: derived state
  const hasMedia = files.length > 0;

  // Add: audience state
  const [audience, setAudience] = useState<"public" | "friends" | "only_me">("public");

  const canPost = (content.trim().length > 0 || hasMedia) && !isSubmitting;

  // Add: handlers
  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (picked.length === 0) return;

    // Limit to max 4 items for simplicity
    const next = [...files, ...picked].slice(0, 4);
    setFiles(next);
    // reset input so same file can be picked again if removed
    e.currentTarget.value = "";
  };

  const removeFileAt = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // Upload each file -> storageId
  const uploadAll = async (selected: Array<File>) => {
    const imageIds: Array<string> = [];
    const videoIds: Array<string> = [];

    for (const f of selected) {
      const url = await generateUploadUrl({});
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": f.type || "application/octet-stream" },
        body: f,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = (await res.json()) as { storageId: string };

      if ((f.type || "").startsWith("video/")) {
        videoIds.push(storageId);
      } else {
        imageIds.push(storageId);
      }
    }
    return { imageIds, videoIds };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPost) return;

    setIsSubmitting(true);
    try {
      let imageIds: Array<string> = [];
      let videoIds: Array<string> = [];

      if (files.length > 0) {
        const uploaded = await uploadAll(files);
        imageIds = uploaded.imageIds;
        videoIds = uploaded.videoIds;
      }

      await createPost({
        content: content.trim(),
        images: imageIds as any,
        videos: videoIds as any,
        isDraft: false,
        audience,
      });

      setContent("");
      setFiles([]);
      // Reset audience to default if desired
      setAudience("public");
      toast.success("Posted!");
    } catch {
      toast.error("Failed to post");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-4 sm:mb-6">
      <Card className="border border-primary/20">
        <CardContent className="p-2 sm:p-3">
          <form onSubmit={handleSubmit}>
            {/* Header row: avatar + privacy selector (top-right) */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8 sm:h-9 sm:w-9">
                  <AvatarImage src={user?.image} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs sm:text-sm">
                    {user?.name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="text-xs sm:text-sm">
                  <div className="font-medium leading-tight">{user?.name || "You"}</div>
                  <div className="text-muted-foreground leading-tight">@{(user as any)?.username || "username"}</div>
                </div>
              </div>

              {/* Compact privacy selector */}
              <Select
                value={audience}
                onValueChange={(val: "public" | "friends" | "only_me") => setAudience(val)}
              >
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue placeholder="Select privacy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">
                    <span className="inline-flex items-center gap-2 text-sm">
                      <Globe className="h-4 w-4" /> Public
                    </span>
                  </SelectItem>
                  <SelectItem value="friends">
                    <span className="inline-flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4" /> Friends
                    </span>
                  </SelectItem>
                  <SelectItem value="only_me">
                    <span className="inline-flex items-center gap-2 text-sm">
                      <Lock className="h-4 w-4" /> Only Me
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Composer: avatar on left, textarea on right (compact) */}
            <div className="flex gap-2">
              <div className="shrink-0 md:hidden">
                {/* small avatar visible on mobile too, but header already has one; keep clean */}
              </div>
              <div className="flex-1">
                <Textarea
                  placeholder="What's on your mind?"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[60px] sm:min-h-[72px] resize-none border-0 p-0 text-sm sm:text-base placeholder:text-muted-foreground focus-visible:ring-0"
                />

                {/* Media previews (unchanged) */}
                {hasMedia && (
                  <div className="mt-2 sm:mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {files.map((f, idx) => {
                      const url = URL.createObjectURL(f);
                      const isVideo = (f.type || "").startsWith("video/");
                      return (
                        <div key={idx} className="relative rounded-lg overflow-hidden border bg-black/5">
                          <button
                            type="button"
                            className="absolute right-1 top-1 z-10 rounded-full bg-black/60 p-1 text-white"
                            onClick={() => removeFileAt(idx)}
                            aria-label="Remove"
                            title="Remove"
                          >
                            <X className="h-4 w-4" />
                          </button>
                          {isVideo ? (
                            <video
                              src={url}
                              className="w-full h-24 object-cover"
                              muted
                              playsInline
                            />
                          ) : (
                            <img src={url} alt="preview" className="w-full h-24 object-cover" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Action row: Live Video, Photo/Video, Reel + Post */}
                <div className="mt-2 sm:mt-3 pt-2 border-t flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-xs sm:text-sm px-2 py-1 rounded-md hover:bg-muted"
                      title="Go Live"
                      onClick={() => toast("Live Video coming soon!")}
                    >
                      <VideoIcon className="h-4 w-4 text-rose-500" />
                      <span>Live Video</span>
                    </button>

                    <label
                      htmlFor={fileInputId}
                      className="inline-flex items-center gap-1.5 text-xs sm:text-sm px-2 py-1 rounded-md hover:bg-muted cursor-pointer"
                      title="Add Photo/Video"
                    >
                      <ImageIcon className="h-4 w-4 text-green-500" />
                      <span>Photo/Video</span>
                    </label>
                    <input
                      id={fileInputId}
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="hidden"
                      onChange={onPickFiles}
                    />

                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-xs sm:text-sm px-2 py-1 rounded-md hover:bg-muted"
                      title="Create a Reel"
                      onClick={() => window.location.assign("/reels")}
                    >
                      <Clapperboard className="h-4 w-4 text-purple-500" />
                      <span>Reel</span>
                    </button>
                  </div>

                  <Button
                    type="submit"
                    disabled={!canPost}
                    title={
                      !content.trim() && !hasMedia
                        ? "Write something or add media to post"
                        : isSubmitting
                        ? "Posting…"
                        : undefined
                    }
                    className="self-end sm:self-auto bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-full h-8 px-4"
                  >
                    {isSubmitting ? (
                      <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-1" />
                        Post
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}