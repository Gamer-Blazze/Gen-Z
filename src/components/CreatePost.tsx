import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Image, Send } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export function CreatePost() {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createPost = useMutation(api.posts.createPost);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      await createPost({
        content: content.trim(),
        isPublic: true,
      });
      setContent("");
      toast.success("Post created successfully!");
    } catch (error) {
      toast.error("Failed to create post");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="mb-6"
    >
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
                  maxLength={500}
                />
                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="ghost" size="sm" className="text-primary">
                      <Image className="w-4 h-4 mr-1" />
                      Photo
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {content.length}/500
                    </span>
                    <Button
                      type="submit"
                      disabled={!content.trim() || isSubmitting}
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
