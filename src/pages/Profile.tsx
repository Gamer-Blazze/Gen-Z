import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Sidebar } from "@/components/Sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PostCard } from "@/components/PostCard";
import { toast } from "sonner";

export default function Profile() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-background">
      <div className="flex">
        <Sidebar />
        <main className="flex-1 max-w-2xl mx-auto px-4 py-6 space-y-6">
          <h1 className="text-2xl font-bold">Profile</h1>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={user.image} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {user.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-semibold text-lg">{user.name || "User"}</div>
                <div className="text-muted-foreground">{user.email}</div>
              </div>
            </CardContent>
          </Card>

          {/* Manage Posts */}
          <ManageOwnPosts />
          <p className="text-muted-foreground">More profile details and settings coming soon.</p>
        </main>
      </div>
    </motion.div>
  );
}

function ManageOwnPosts() {
  const { user } = useAuth();
  const posts = useQuery(api.posts.getUserPosts, user ? { userId: user._id } : "skip");
  const deletePost = useMutation(api.posts.deletePost);

  if (!user) return null;

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Your Posts</h2>
          <span className="text-sm text-muted-foreground">
            {Array.isArray(posts) ? posts.length : 0} total
          </span>
        </div>

        {posts && posts.length > 0 ? (
          <div className="space-y-4">
            {posts.map((post) => (
              <div key={post._id} className="relative">
                <div className="absolute right-2 top-2 z-10">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await deletePost({ postId: post._id });
                        toast.success("Post deleted");
                      } catch (e) {
                        toast.error("Failed to delete post");
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
                <PostCard post={post as any} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">You haven't posted anything yet.</p>
        )}
      </CardContent>
    </Card>
  );
}