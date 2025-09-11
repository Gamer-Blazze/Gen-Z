import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

// Direct post (text-only) composer
export function CreatePost() {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createPost = useMutation(api.posts.createPost);

  const canPost = content.trim().length > 0 && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPost) return;

    setIsSubmitting(true);
    try {
      await createPost({
        content: content.trim(),
        // explicitly no media; audience defaults to public on backend
        images: [],
        videos: [],
        isDraft: false,
      });
      setContent("");
      toast.success("Posted!");
    } catch {
      toast.error("Failed to post");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-6">
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
                  placeholder="Share your thoughts…"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[100px] resize-none border-0 p-0 text-base placeholder:text-muted-foreground focus-visible:ring-0"
                />

                <div className="flex items-center justify-end mt-3 pt-3 border-t">
                  <Button
                    type="submit"
                    disabled={!canPost}
                    title={
                      !content.trim()
                        ? "Write something to post"
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