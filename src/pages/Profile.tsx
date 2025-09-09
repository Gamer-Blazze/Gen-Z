import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Sidebar } from "@/components/Sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
 
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";

export default function Profile() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [nameInput, setNameInput] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const updateUserName = useMutation(api.users.updateUserName);

  useEffect(() => {
    setNameInput(user?.name ?? "");
  }, [user?.name]);

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
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold text-lg">Edit Display Name</h2>
              <div className="flex gap-2">
                <Input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Enter your name"
                  maxLength={50}
                />
                <Button
                  onClick={async () => {
                    const trimmed = nameInput.trim();
                    if (!trimmed) {
                      toast.error("Name cannot be empty");
                      return;
                    }
                    if (trimmed === (user.name ?? "")) {
                      toast.message("No changes to save");
                      return;
                    }
                    setSaving(true);
                    try {
                      await updateUserName({ name: trimmed });
                      toast.success("Name updated");
                    } catch (err) {
                      toast.error("Failed to update name");
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving || !nameInput.trim()}
                  className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
                >
                  {saving ? (
                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Your display name will appear on your posts, messages, and profile.
              </p>
            </CardContent>
          </Card>
          <p className="text-muted-foreground">More profile details and settings coming soon.</p>
        </main>
      </div>
    </motion.div>
  );
}