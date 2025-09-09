import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Image, Send } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Id } from "@/convex/_generated/dataModel";

function readFileAsArrayBuffer(file: File) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function CreatePost() {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createPost = useMutation(api.posts.createPost);
  const [files, setFiles] = useState<File[]>([]);
  const [imageIds, setImageIds] = useState<Array<Id<"_storage">>>([]);
  const [videoIds, setVideoIds] = useState<Array<Id<"_storage">>>([]);
  // Use Convex action hook to request an upload URL
  const generateUploadUrl = useAction(api.files.generateUploadUrl);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && imageIds.length === 0 && videoIds.length === 0) return;

    setIsSubmitting(true);
    try {
      await createPost({
        content: content.trim(),
        isPublic: true,
        images: imageIds,
        videos: videoIds,
      });
      setContent("");
      setFiles([]);
      setImageIds([]);
      setVideoIds([]);
      toast.success("Post created successfully!");
    } catch (error) {
      toast.error("Failed to create post");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onPickFiles = async (picked: FileList | null) => {
    if (!picked || picked.length === 0) return;

    try {
      const selected = Array.from(picked);
      setFiles((prev) => [...prev, ...selected]);

      const uploadOne = async (file: File) => {
        // Request an upload URL from Convex
        const uploadUrl = await generateUploadUrl({});

        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
          body: await readFileAsArrayBuffer(file),
        });
        if (!res.ok) {
          throw new Error("Upload failed");
        }
        const { storageId } = await res.json();

        if (file.type.startsWith("image")) {
          setImageIds((prev) => [...prev, storageId]);
        } else if (file.type.startsWith("video")) {
          setVideoIds((prev) => [...prev, storageId]);
        }
      };

      await Promise.all(selected.map(uploadOne));
      toast.success("Files uploaded");
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload files");
    }
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="mb-6"
    >
      <input
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => onPickFiles(e.target.files)}
        id="create-post-file-input"
      />
      <Card className="border-2 border-primary/20">
        <CardContent className="p-4">
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
                  placeholder="What's happening in Nepal today?"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[100px] resize-none border-0 p-0 text-base placeholder:text-muted-foreground focus-visible:ring-0"
                />

                {(files.length > 0) && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {files.map((f, i) => (
                      <div key={i} className="relative rounded-lg overflow-hidden border">
                        {f.type.startsWith("image") ? (
                          <img
                            src={URL.createObjectURL(f)}
                            alt={f.name}
                            className="w-full h-24 object-cover"
                          />
                        ) : (
                          <video
                            src={URL.createObjectURL(f)}
                            className="w-full h-24 object-cover"
                            controls
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-primary"
                      onClick={() => {
                        const el = document.getElementById("create-post-file-input");
                        (el as HTMLInputElement)?.click();
                      }}
                    >
                      <Image className="w-4 h-4 mr-1" />
                      Photo/Video
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="submit"
                      disabled={(!content.trim() && imageIds.length === 0 && videoIds.length === 0) || isSubmitting}
                      className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
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
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}