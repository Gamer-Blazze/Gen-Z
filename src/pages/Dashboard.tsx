import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Sidebar } from "@/components/Sidebar";
import { Feed } from "@/components/Feed";
import { CreatePost } from "@/components/CreatePost";
import { FriendsSidebar } from "@/components/FriendsSidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Settings as SettingsIcon, LogOut, User as UserIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";

export default function Dashboard() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const updateUserProfile = useMutation(api.users.updateUserProfile);
  const updateUserImage = useMutation(api.users.updateUserImage);

  const [bio, setBio] = useState(user?.bio ?? "");
  const [imageUrl, setImageUrl] = useState(user?.image ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(user?.coverImage ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    setBio(user?.bio ?? "");
    setImageUrl(user?.image ?? "");
    setCoverImageUrl(user?.coverImage ?? "");
  }, [user?.bio, user?.image, user?.coverImage]);

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

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-background"
    >
      {/* Mobile Top Bar with Hamburger (hidden on lg and above) */}
      <div className="lg:hidden sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 items-center justify-between px-4">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[280px]">
              {/* Reuse existing Sidebar inside the sheet for mobile */}
              <Sidebar />
            </SheetContent>
          </Sheet>
          {/* Make title clickable to go to Profile */}
          <button
            className="font-semibold hover:underline"
            onClick={() => navigate("/profile")}
            aria-label="Go to Profile"
          >
            Gen-Z Nepal
          </button>
          <div className="w-9" />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        {/* Main Content */}
        <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-6">
          <Card className="mb-6">
            <CardContent className="p-4 sm:p-6 space-y-4">
              <h2 className="font-semibold text-lg">Profile</h2>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <label className="text-sm text-muted-foreground">Avatar URL</label>
                  <Input
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                  />
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt="avatar preview"
                      className="h-16 w-16 rounded-full border object-cover"
                    />
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <label className="text-sm text-muted-foreground">Cover Image URL</label>
                  <Input
                    value={coverImageUrl}
                    onChange={(e) => setCoverImageUrl(e.target.value)}
                    placeholder="https://example.com/cover.jpg"
                  />
                  {coverImageUrl ? (
                    <img
                      src={coverImageUrl}
                      alt="cover preview"
                      className="h-24 w-full rounded-md border object-cover"
                    />
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <label className="text-sm text-muted-foreground">Bio</label>
                  <Textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Write a short bio..."
                    maxLength={300}
                  />
                  <div className="text-xs text-muted-foreground">{bio.length}/300</div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={async () => {
                      if (!user) return;
                      setSavingProfile(true);
                      try {
                        const profilePatch: { bio?: string; coverImage?: string } = {};
                        profilePatch.bio = bio ?? "";
                        profilePatch.coverImage = coverImageUrl ?? "";

                        const ops: Array<Promise<any>> = [];
                        ops.push(updateUserProfile(profilePatch));
                        if ((imageUrl ?? "") !== (user.image ?? "")) {
                          ops.push(updateUserImage({ image: imageUrl ?? "" }));
                        }
                        await Promise.all(ops);
                        toast.success("Profile updated");
                      } catch (e: any) {
                        toast.error(e?.message || "Failed to update profile");
                      } finally {
                        setSavingProfile(false);
                      }
                    }}
                    disabled={savingProfile}
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
                  >
                    {savingProfile ? (
                      <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <CreatePost />
          <Feed />
        </main>

        {/* Right Sidebar (only on xl and up) */}
        <div className="hidden xl:block">
          <FriendsSidebar />
        </div>
      </div>
    </motion.div>
  );
}