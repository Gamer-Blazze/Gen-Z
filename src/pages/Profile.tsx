import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Sidebar } from "@/components/Sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PostCard } from "@/components/PostCard";
import { toast } from "sonner";
import { useRef } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useLocation } from "react-router";
import { Id } from "@/convex/_generated/dataModel";

export default function Profile() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Parse ?id=<userId> from the URL to view someone else's profile
  const params = new URLSearchParams(location.search);
  const viewUserIdParam = params.get("id") as Id<"users"> | null;

  // If viewing someone else, fetch that user's document
  const viewedUser = useQuery(
    api.users.getUserById,
    viewUserIdParam ? { userId: viewUserIdParam } : "skip"
  );

  // Determine target user (self or other)
  const targetUser = viewUserIdParam ? viewedUser : user;
  const isOwnProfile: boolean =
    !viewUserIdParam || (user ? viewUserIdParam === user._id : false);

  const generateUploadUrl = useAction(api.files.generateUploadUrl);
  const getFileUrl = useAction(api.files.getFileUrl);
  const updateUserImage = useMutation(api.users.updateUserImage);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onPickProfileImage = async (fl: FileList | null) => {
    if (!fl || fl.length === 0) return;
    const file = fl[0];
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    setUploadingImage(true);
    try {
      const uploadUrl = await generateUploadUrl({});
      const buf = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: buf,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = await res.json();
      const signedUrl = await getFileUrl({ fileId: storageId });
      await updateUserImage({ image: signedUrl });
      toast.success("Profile picture updated");
    } catch (e) {
      console.error(e);
      toast.error("Failed to update profile picture");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading || (viewUserIdParam && typeof viewedUser === "undefined")) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) return null;
  if (!targetUser) return <div className="min-h-screen flex items-center justify-center">User not found.</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-background">
      <div className="flex">
        <Sidebar />
        <main className="flex-1 max-w-2xl mx-auto px-4 py-6 space-y-6">
          <h1 className="text-2xl font-bold">
            {isOwnProfile ? "Your Profile" : `${targetUser.name || "User"}'s Profile`}
          </h1>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              {isOwnProfile && (
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickProfileImage(e.target.files)}
                />
              )}
              <Dialog>
                <DialogTrigger asChild>
                  <button aria-label="View profile picture" className="shrink-0">
                    <Avatar className="w-16 h-16">
                      <AvatarImage src={targetUser.image} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                        {targetUser.name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl">
                  <img
                    src={targetUser.image}
                    alt={targetUser.name || "Profile picture"}
                    className="w-full h-auto rounded-lg"
                    loading="eager"
                    decoding="async"
                  />
                </DialogContent>
              </Dialog>
              <div className="flex-1">
                <div className="font-semibold text-lg">{targetUser.name || "User"}</div>
                <div className="text-muted-foreground">{targetUser.email}</div>
              </div>
              {isOwnProfile && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                >
                  {uploadingImage ? (
                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  ) : (
                    "Change Picture"
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Manage Posts of target user; allow delete only on own profile */}
          <ManagePostsForUser targetUserId={targetUser._id} canManage={isOwnProfile} />
          {!isOwnProfile && <p className="text-muted-foreground">You are viewing someone else's profile.</p>}
        </main>
      </div>
    </motion.div>
  );
}

function ManagePostsForUser({ targetUserId, canManage }: { targetUserId: Id<"users">; canManage: boolean }) {
  const posts = useQuery(api.posts.getUserPosts, { userId: targetUserId });
  const deletePost = useMutation(api.posts.deletePost);

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Posts</h2>
          <span className="text-sm text-muted-foreground">
            {Array.isArray(posts) ? posts.length : 0} total
          </span>
        </div>

        {posts && posts.length > 0 ? (
          <div className="space-y-4">
            {posts.map((post) => (
              <div key={post._id} className="relative">
                {canManage && (
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
                )}
                <PostCard post={post as any} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No posts to show.</p>
        )}
      </CardContent>
    </Card>
  );
}