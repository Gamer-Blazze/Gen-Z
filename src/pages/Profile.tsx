import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
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
import { Sidebar } from "@/components/Sidebar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Menu, LogOut } from "lucide-react";
import { useParams } from "react-router";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useDevice } from "@/hooks/use-device";
import { useMemo } from "react";
import { MobileTopNav } from "@/components/MobileTopNav";

export default function Profile() {
  const { isLoading, isAuthenticated, user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { username } = useParams();
  const device = useDevice();
  const isMobile = device === "mobile";
  const isTablet = device === "tablet";
  const isDesktop = device === "desktop";

  // Parse ?id=<userId> from the URL to view someone else's profile (fallback for old links)
  const params = new URLSearchParams(location.search);
  const viewUserIdParam = params.get("id") as Id<"users"> | null;

  // If viewing someone else by username, fetch that user's document
  const viewedByUsername = useQuery(
    api.users.getUserByUsername,
    username ? { username } : "skip"
  );

  // If viewing someone else by id, fetch that user's document
  const viewedUser = useQuery(
    api.users.getUserById,
    !username && viewUserIdParam ? { userId: viewUserIdParam } : "skip"
  );

  // Determine target user (self or other)
  const targetUser = username ? viewedByUsername : viewUserIdParam ? viewedUser : user;
  const isOwnProfile: boolean =
    !!user &&
    (!!username
      ? !!targetUser && user._id === targetUser._id
      : !viewUserIdParam || viewUserIdParam === user._id);

  const updateUserImage = useMutation(api.users.updateUserImage);
  const updateUserProfile = useMutation(api.users.updateUserProfile);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const sendFriend = useMutation(api.friends.sendFriendRequest);
  const relationshipStatus = useQuery(
    api.friends.getRelationshipStatus,
    !isOwnProfile && targetUser ? { otherUserId: targetUser._id } : "skip"
  );

  const generateUploadUrl = useAction(api.files.generateUploadUrl);
  const getFileUrl = useAction(api.files.getFileUrl);

  const [showMobileNav, setShowMobileNav] = useState(false);

  // Edit profile dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState<string>("");
  const [editBio, setEditBio] = useState<string>("");
  const [editUsername, setEditUsername] = useState<string>("");

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

  // NEW: cover image upload
  const onPickCoverImage = async (fl: FileList | null) => {
    if (!fl || fl.length === 0) return;
    const file = fl[0];
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    setUploadingCover(true);
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
      await updateUserProfile({ coverImage: signedUrl });
      toast.success("Cover photo updated");
    } catch (e) {
      console.error(e);
      toast.error("Failed to update cover photo");
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
  }, [isLoading, isAuthenticated, navigate]);

  // Initialize edit fields when dialog opens with current values
  useEffect(() => {
    if (editOpen && targetUser) {
      setEditName(targetUser.name || "");
      setEditBio(targetUser.bio || "");
      setEditUsername(targetUser.username || "");
    }
  }, [editOpen, targetUser]);

  if (
    isLoading ||
    (username && typeof viewedByUsername === "undefined") ||
    (!username && viewUserIdParam && typeof viewedUser === "undefined")
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) return null;
  if (!targetUser) return <div className="min-h-screen flex items-center justify-center">User not found.</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`min-h-screen ${isMobile ? "bg-gradient-to-b from-primary/5 to-background" : "bg-background"}`}>
      {/* Mobile/Tablet sheet container for Sidebar */}
      <Sheet open={showMobileNav} onOpenChange={setShowMobileNav}>
        <SheetContent side="left" className="p-0 w-[85vw] sm:w-[380px]">
          <Sidebar />
        </SheetContent>
      </Sheet>

      {/* Add persistent desktop sidebar and wrap content */}
      <div className="flex">
        {/* Left app navigation (desktop) */}
        <aside className="hidden lg:block w-64 border-r bg-card/50">
          <Sidebar />
        </aside>

        <div className="min-h-screen flex-1">
          {/* Top navigation bar */}
          <MobileTopNav showOnDesktop />
          {/* Cover photo area */}
          <div className="relative h-40 sm:h-56 md:h-64 lg:h-72 w-full bg-muted overflow-hidden">
            {targetUser.coverImage ? (
              <img
                src={targetUser.coverImage}
                alt="Cover"
                className="w-full h-full object-cover"
                loading="eager"
                decoding="async"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-muted to-muted/60" />
            )}
            <div className="absolute top-3 left-3">
              <button
                className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-md bg-background/70 hover:bg-background"
                aria-label="Open navigation"
                onClick={() => setShowMobileNav(true)}
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
            {isOwnProfile && (
              <>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickCoverImage(e.target.files)}
                />
                <div className="absolute bottom-3 right-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => coverInputRef.current?.click()}
                    disabled={uploadingCover}
                    className="text-xs sm:text-sm"
                  >
                    {uploadingCover ? (
                      <div className="w-4 h-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    ) : (
                      <>
                        <span className="sm:inline hidden">Change Cover</span>
                        <span className="sm:hidden inline">Change</span>
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Constrain content width for all devices and adjust paddings */}
          <main className="w-full max-w-none md:max-w-5xl lg:max-w-6xl mx-auto px-3 md:px-6 lg:px-8 py-6 space-y-6">
            {/* Header card */}
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
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
                  {/* Make avatar size & overlap responsive for different devices */}
                  <button aria-label="View profile picture" className="-mt-12 sm:-mt-14 md:-mt-16 lg:-mt-20 shrink-0 self-start">
                    <Avatar className="w-20 h-20 sm:w-22 sm:h-22 md:w-24 md:h-24 lg:w-28 lg:h-28 ring-4 ring-background rounded-full">
                      <AvatarImage src={targetUser.image} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                        {targetUser.name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DialogTrigger>
                {/* Ensure the full image dialog scales well on small screens */}
                <DialogContent className="max-w-[95vw] sm:max-w-2xl md:max-w-3xl">
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
                <div className="font-semibold text-2xl">{targetUser.name || "User"}</div>
                <div className="text-muted-foreground">
                  {targetUser.username ? `@${targetUser.username}` : targetUser.email}
                </div>
                {targetUser.bio && <p className="mt-2 text-sm">{targetUser.bio}</p>}
              </div>

              <div className="flex items-center gap-2">
                {isOwnProfile ? (
                  <>
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
                    <Dialog open={editOpen} onOpenChange={setEditOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800">
                          Edit Profile
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Profile</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-sm font-medium">Name</label>
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Your name" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-medium">Username</label>
                            <Input
                              value={editUsername}
                              onChange={(e) => setEditUsername(e.target.value)}
                              placeholder="username"
                            />
                            <p className="text-xs text-muted-foreground">
                              3-20 chars, lowercase letters, numbers, dot, underscore, dash
                            </p>
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-medium">Bio</label>
                            <Textarea
                              value={editBio}
                              onChange={(e) => setEditBio(e.target.value)}
                              placeholder="Tell something about yourself"
                            />
                          </div>
                        </div>
                        <DialogFooter className="mt-2">
                          <Button
                            variant="secondary"
                            onClick={() => setEditOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
                            onClick={async () => {
                              try {
                                await updateUserProfile({
                                  name: editName,
                                  bio: editBio,
                                  username: editUsername,
                                });
                                toast.success("Profile updated");
                                setEditOpen(false);
                              } catch (e: any) {
                                toast.error(e?.message || "Failed to update profile");
                              }
                            }}
                          >
                            Save
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await signOut();
                        } catch {
                          toast.error("Failed to sign out");
                        }
                      }}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Log out
                    </Button>
                  </>
                ) : (
                  <>
                    {/* Dynamic Friend Button based on relationship status */}
                    {relationshipStatus === "friends" && (
                      <Button size="sm" variant="secondary" disabled>
                        Friend
                      </Button>
                    )}
                    {relationshipStatus === "outgoing_request" && (
                      <Button size="sm" variant="secondary" disabled>
                        Request Sent
                      </Button>
                    )}
                    {relationshipStatus === "incoming_request" && (
                      <Button
                        size="sm"
                        className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
                        onClick={() => navigate("/friends")}
                      >
                        Respond
                      </Button>
                    )}
                    {(relationshipStatus === "none" || relationshipStatus === undefined) && (
                      <Button
                        size="sm"
                        className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
                        onClick={async () => {
                          try {
                            await sendFriend({ userId: targetUser._id });
                            toast.success("Friend request sent");
                          } catch (e: any) {
                            toast.error(e?.message || "Failed to send request");
                          }
                        }}
                      >
                        Add Friend
                      </Button>
                    )}

                    <Button variant="outline" size="sm" onClick={() => navigate("/messages")}>
                      Message
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Manage Posts of target user; allow delete only on own profile */}
            {isDesktop ? (
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-4 space-y-4">
                  <AboutCard user={targetUser} isOwnProfile={isOwnProfile} />
                  <FriendsSection targetUserId={targetUser._id} />
                </div>
                <div className="col-span-8">
                  <ManagePostsForUser targetUserId={targetUser._id} canManage={isOwnProfile} />
                  {!isOwnProfile && <p className="text-muted-foreground mt-2">You are viewing someone else's profile.</p>}
                </div>
              </div>
            ) : isTablet ? (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="md:col-span-2 space-y-4">
                  <AboutCard user={targetUser} isOwnProfile={isOwnProfile} />
                  <FriendsSection targetUserId={targetUser._id} />
                </div>
                <div className="md:col-span-3">
                  <ManagePostsForUser targetUserId={targetUser._id} canManage={isOwnProfile} />
                  {!isOwnProfile && <p className="text-muted-foreground mt-2">You are viewing someone else's profile.</p>}
                </div>
              </div>
            ) : (
              <>
                <AboutCard user={targetUser} isOwnProfile={isOwnProfile} variant="mobile" />
                <FriendsSection targetUserId={targetUser._id} variant="carousel" />
                <ManagePostsForUser targetUserId={targetUser._id} canManage={isOwnProfile} />
                {!isOwnProfile && <p className="text-muted-foreground mt-2">You are viewing someone else's profile.</p>}
              </>
            )}
          </main>
        </div>
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

function AboutCard({
  user,
  isOwnProfile,
  variant,
}: {
  user: any;
  isOwnProfile: boolean;
  variant?: "mobile";
}) {
  return (
    <Card className={variant === "mobile" ? "border-2 border-primary/10" : ""}>
      <CardContent className="p-4 space-y-2">
        <h2 className="font-semibold text-lg">About</h2>
        {user.bio && <p className="text-sm leading-relaxed">{user.bio}</p>}
        <div className="text-sm text-muted-foreground space-y-1">
          {user.username && <div>Username: @{user.username}</div>}
          {user.email && <div>Email: {user.email}</div>}
          {user.location && <div>Location: {user.location}</div>}
          {user.website && (
            <div className="truncate">
              Website:{" "}
              <a href={user.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                {user.website}
              </a>
            </div>
          )}
        </div>
        {isOwnProfile && (
          <p className="text-xs text-muted-foreground pt-1">
            Tip: Use "Edit Profile" to update your name, username, and bio.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function FriendsSection({
  targetUserId,
  variant,
}: {
  targetUserId: Id<"users">;
  variant?: "carousel";
}) {
  const navigate = useNavigate();
  const friends = useQuery(api.friends.getUserFriends, { userId: targetUserId });

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-lg">Friends</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {Array.isArray(friends) ? friends.length : 0} total
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => navigate("/friends")}
            >
              View all
            </Button>
          </div>
        </div>

        {friends === undefined ? (
          <div className="h-16 flex items-center justify-center text-sm text-muted-foreground">Loading...</div>
        ) : friends && friends.length > 0 ? (
          variant === "carousel" ? (
            <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none]">
              {friends.slice(0, 12).map((f) =>
                f ? (
                  <button
                    key={f._id}
                    onClick={() => navigate(`/profile?id=${f._id}`)}
                    className="flex flex-col items-center gap-1 min-w-[72px]"
                    aria-label="Open friend profile"
                  >
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={f.image} />
                      <AvatarFallback className="bg-muted text-xs">{f.name?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs max-w-[72px] truncate">{f.name || "Anonymous"}</span>
                  </button>
                ) : null
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {friends.slice(0, 9).map((f) =>
                f ? (
                  <button
                    key={f._id}
                    onClick={() => navigate(`/profile?id=${f._id}`)}
                    className="flex flex-col items-center gap-1"
                    aria-label="Open friend profile"
                  >
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={f.image} />
                      <AvatarFallback className="bg-muted text-xs">{f.name?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs w-full text-center truncate">{f.name || "Anonymous"}</span>
                  </button>
                ) : null
              )}
            </div>
          )
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">No friends to show.</p>
            <Button size="sm" onClick={() => navigate("/friends")}>
              Find Friends
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}