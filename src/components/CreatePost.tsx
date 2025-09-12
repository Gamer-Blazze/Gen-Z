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
    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-6">
      <Card className="border border-primary/20">
        <CardContent className="p-3">
          <form onSubmit={handleSubmit}>
            <div className="flex gap-3">
              <Avatar>
                <AvatarImage src={user?.image} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {user?.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Textarea
                  placeholder="Share your thoughts…"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[72px] resize-none border-0 p-0 text-base placeholder:text-muted-foreground focus-visible:ring-0"
                />

                {/* Add: privacy selector */}
                <div className="mt-2 flex items-center gap-2">
                  <Select
                    value={audience}
                    onValueChange={(val: "public" | "friends" | "only_me") => setAudience(val)}
                  >
                    <SelectTrigger className="w-[180px] h-8 text-xs">
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

                {/* Add: media previews */}
                {hasMedia && (
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
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

                {/* Add: media buttons + Post */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor={fileInputId}
                      className="inline-flex items-center gap-1 text-sm text-primary cursor-pointer hover:underline"
                      title="Add Photo/Video"
                    >
                      <ImageIcon className="h-4 w-4" />
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
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-full"
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