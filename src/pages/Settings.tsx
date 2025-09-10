import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
/* removed duplicate useEffect import */
import { useNavigate } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Sidebar } from "@/components/Sidebar";
import { Menu } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function Settings() {
  const { isLoading, isAuthenticated, user, signOut } = useAuth();
  const navigate = useNavigate();

  const [nameInput, setNameInput] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const updateUserName = useMutation(api.users.updateUserName);
  const updateUserSettings = useMutation(api.users.updateUserSettings);

  // Theme state (light | dark | system)
  const [theme, setTheme] = useState<"light" | "dark" | "system">(
    () => (localStorage.getItem("theme") as "light" | "dark" | "system") || "system"
  );

  // Helper to compute system theme
  const getSystemTheme = () =>
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

  // Apply theme when changed
  useEffect(() => {
    const root = document.documentElement;
    const effective = theme === "system" ? getSystemTheme() : theme;
    if (effective === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Listen to system changes only when theme === "system"
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const root = document.documentElement;
      if (mq.matches) root.classList.add("dark");
      else root.classList.remove("dark");
    };
    mq.addEventListener?.("change", handler);
    // Fallback for older browsers
    mq.addListener?.(handler);
    return () => {
      mq.removeEventListener?.("change", handler);
      mq.removeListener?.(handler);
    };
  }, [theme]);

  // Initialize from user document if available
  useEffect(() => {
    const s = (user as any)?.settings;
    if (s) {
      setSettings({
        notifications: {
          likes: s.notifications?.likes ?? true,
          comments: s.notifications?.comments ?? true,
          friendRequests: s.notifications?.friendRequests ?? true,
          messages: s.notifications?.messages ?? true,
        },
        privacy: {
          canMessage: s.privacy?.canMessage ?? "everyone",
          postsVisibility: s.privacy?.postsVisibility ?? "public",
        },
        preferences: {
          language: s.preferences?.language ?? "en",
          density: s.preferences?.density ?? "comfortable",
        },
      });
    }
  }, [user]);

  // Local settings state with defaults
  const [settings, setSettings] = useState<{
    notifications: { likes: boolean; comments: boolean; friendRequests: boolean; messages: boolean };
    privacy: { canMessage: "everyone" | "friends"; postsVisibility: "public" | "friends" };
    preferences: { language: "en" | "es" | "hi"; density: "comfortable" | "compact" };
  }>({
    notifications: { likes: true, comments: true, friendRequests: true, messages: true },
    privacy: { canMessage: "everyone", postsVisibility: "public" },
    preferences: { language: "en", density: "comfortable" },
  });

  // Apply compact mode class when density changes
  useEffect(() => {
    const root = document.documentElement;
    if (settings.preferences.density === "compact") {
      root.classList.add("compact");
    } else {
      root.classList.remove("compact");
    }
  }, [settings.preferences.density]);

  useEffect(() => {
    setNameInput(user?.name ?? "");
  }, [user?.name]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
  }, [isLoading, isAuthenticated, navigate]);

  const [showMobileNav, setShowMobileNav] = useState(false);

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
      {/* Mobile/Tablet sheet container for Sidebar */}
      <Sheet open={showMobileNav} onOpenChange={setShowMobileNav}>
        <SheetContent side="left" className="p-0 w-[85vw] sm:w-[380px]">
          <Sidebar />
        </SheetContent>
      </Sheet>

      {/* Desktop-like Facebook layout: persistent left sidebar (lg+) + content on the right */}
      <div className="flex min-h-screen">
        {/* Left app navigation (desktop) */}
        <aside className="hidden lg:block w-64 border-r bg-card/50">
          <Sidebar />
        </aside>

        {/* Content area */}
        <main className="flex-1 mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
          {/* Top bar with hamburger to open navigation on mobile */}
          <div className="p-2 flex items-center">
            <button
              className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-md hover:bg-muted"
              aria-label="Open navigation"
              onClick={() => setShowMobileNav(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          <h1 className="text-2xl font-bold">Settings</h1>
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
                    if (trimmed === (user?.name ?? "")) {
                      toast("No changes to save");
                      return;
                    }
                    setSaving(true);
                    try {
                      await updateUserName({ name: trimmed });
                      toast.success("Name updated");
                    } catch {
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

          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold text-lg">Appearance</h2>
              <div className="grid gap-2">
                <label className="text-sm text-muted-foreground">Theme</label>
                <Select
                  value={theme}
                  onValueChange={(val: "light" | "dark" | "system") => {
                    setTheme(val);
                    toast(`Theme set to ${val}`);
                  }}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose Light or Dark, or follow your device's appearance.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold text-lg">Notifications & Privacy</h2>

              {/* Notifications */}
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">Notifications</div>
                <div className="grid gap-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notif-likes" className="text-sm">Likes</Label>
                    <Switch
                      id="notif-likes"
                      checked={settings.notifications.likes}
                      onCheckedChange={async (val) => {
                        const next = {
                          ...settings,
                          notifications: { ...settings.notifications, likes: val },
                        };
                        setSettings(next);
                        try {
                          await updateUserSettings({ notifications: { likes: val } });
                          toast.success("Updated");
                        } catch {
                          toast.error("Failed to update");
                          setSettings(settings); // revert
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notif-comments" className="text-sm">Comments</Label>
                    <Switch
                      id="notif-comments"
                      checked={settings.notifications.comments}
                      onCheckedChange={async (val) => {
                        const prev = settings;
                        const next = {
                          ...prev,
                          notifications: { ...prev.notifications, comments: val },
                        };
                        setSettings(next);
                        try {
                          await updateUserSettings({ notifications: { comments: val } });
                          toast.success("Updated");
                        } catch {
                          toast.error("Failed to update");
                          setSettings(prev);
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notif-requests" className="text-sm">Friend Requests</Label>
                    <Switch
                      id="notif-requests"
                      checked={settings.notifications.friendRequests}
                      onCheckedChange={async (val) => {
                        const prev = settings;
                        const next = {
                          ...prev,
                          notifications: { ...prev.notifications, friendRequests: val },
                        };
                        setSettings(next);
                        try {
                          await updateUserSettings({ notifications: { friendRequests: val } });
                          toast.success("Updated");
                        } catch {
                          toast.error("Failed to update");
                          setSettings(prev);
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notif-messages" className="text-sm">Messages</Label>
                    <Switch
                      id="notif-messages"
                      checked={settings.notifications.messages}
                      onCheckedChange={async (val) => {
                        const prev = settings;
                        const next = {
                          ...prev,
                          notifications: { ...prev.notifications, messages: val },
                        };
                        setSettings(next);
                        try {
                          await updateUserSettings({ notifications: { messages: val } });
                          toast.success("Updated");
                        } catch {
                          toast.error("Failed to update");
                          setSettings(prev);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Privacy */}
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">Privacy</div>

                <div className="grid gap-2">
                  <Label className="text-sm">Who can message you</Label>
                  <Select
                    value={settings.privacy.canMessage}
                    onValueChange={async (val: "everyone" | "friends") => {
                      const prev = settings;
                      const next = { ...prev, privacy: { ...prev.privacy, canMessage: val } };
                      setSettings(next);
                      try {
                        await updateUserSettings({ privacy: { canMessage: val } });
                        toast(`Messaging set to ${val}`);
                      } catch {
                        toast.error("Failed to update");
                        setSettings(prev);
                      }
                    }}
                  >
                    <SelectTrigger className="w-[240px]">
                      <SelectValue placeholder="Select option" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="everyone">Everyone</SelectItem>
                      <SelectItem value="friends">Friends only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label className="text-sm">Posts visibility</Label>
                  <Select
                    value={settings.privacy.postsVisibility}
                    onValueChange={async (val: "public" | "friends") => {
                      const prev = settings;
                      const next = { ...prev, privacy: { ...prev.privacy, postsVisibility: val } };
                      setSettings(next);
                      try {
                        await updateUserSettings({ privacy: { postsVisibility: val } });
                        toast(`Posts visibility set to ${val}`);
                      } catch {
                        toast.error("Failed to update");
                        setSettings(prev);
                      }
                    }}
                  >
                    <SelectTrigger className="w-[240px]">
                      <SelectValue placeholder="Select visibility" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="friends">Friends</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Note: Existing posts keep their own visibility; this sets the default for new content.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold text-lg">Preferences</h2>

              {/* Language */}
              <div className="grid gap-2">
                <Label className="text-sm">Language</Label>
                <Select
                  value={settings.preferences.language}
                  onValueChange={async (val: "en" | "es" | "hi") => {
                    const prev = settings;
                    const next = { ...prev, preferences: { ...prev.preferences, language: val } };
                    setSettings(next);
                    try {
                      await updateUserSettings({ preferences: { language: val } });
                      toast.success("Language updated");
                    } catch {
                      toast.error("Failed to update");
                      setSettings(prev);
                    }
                  }}
                >
                  <SelectTrigger className="w-[240px]">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="hi">हिन्दी</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Density */}
              <div className="grid gap-2">
                <Label className="text-sm">Density</Label>
                <Select
                  value={settings.preferences.density}
                  onValueChange={async (val: "comfortable" | "compact") => {
                    const prev = settings;
                    const next = { ...prev, preferences: { ...prev.preferences, density: val } };
                    setSettings(next);
                    try {
                      await updateUserSettings({ preferences: { density: val } });
                      toast(`Density set to ${val}`);
                    } catch {
                      toast.error("Failed to update");
                      setSettings(prev);
                    }
                  }}
                >
                  <SelectTrigger className="w-[240px]">
                    <SelectValue placeholder="Select density" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comfortable">Comfortable</SelectItem>
                    <SelectItem value="compact">Compact</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Compact mode tightens spacing across the interface.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold text-lg">Account</h2>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Sign out of your account on this device.
                </div>
                <Button
                  variant="destructive"
                  onClick={() => {
                    try {
                      signOut();
                    } catch {
                      toast.error("Failed to sign out");
                    }
                  }}
                >
                  Log Out
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </motion.div>
  );
}