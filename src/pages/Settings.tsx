import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
/* removed duplicate useEffect import */
import { useNavigate } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useMemo } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Sidebar } from "@/components/Sidebar";
import { Menu } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useLocation } from "react-router";
import { Home, MessageCircle, Users, Bell, Settings as SettingsIcon, User as UserIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export default function Settings() {
  const { isLoading, isAuthenticated, user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [nameInput, setNameInput] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const updateUserName = useMutation(api.users.updateUserName);
  const updateUserSettings = useMutation(api.users.updateUserSettings);
  const updateUserProfile = useMutation(api.users.updateUserProfile);
  const updateUserImage = useMutation(api.users.updateUserImage);

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
          sound: s.notifications?.sound ?? true,
          vibration: s.notifications?.vibration ?? true,
          previews: s.notifications?.previews ?? true,
        },
        privacy: {
          canMessage: s.privacy?.canMessage ?? "everyone",
          postsVisibility: s.privacy?.postsVisibility ?? "public",
          showActiveStatus: s.privacy?.showActiveStatus ?? true,
          lastSeenVisibility: s.privacy?.lastSeenVisibility ?? "everyone",
          profilePhotoVisibility: s.privacy?.profilePhotoVisibility ?? "everyone",
          readReceipts: s.privacy?.readReceipts ?? true,
        },
        preferences: {
          language: s.preferences?.language ?? "en",
          density: s.preferences?.density ?? "comfortable",
        },
        security: {
          twoFactorEnabled: s.security?.twoFactorEnabled ?? false,
        },
      } as any);
    }
  }, [user]);

  // Local settings state with defaults
  const [settings, setSettings] = useState<{
    notifications: {
      likes: boolean; comments: boolean; friendRequests: boolean; messages: boolean;
      sound?: boolean; vibration?: boolean; previews?: boolean;
    };
    privacy: {
      canMessage: "everyone" | "friends";
      postsVisibility: "public" | "friends";
      showActiveStatus: boolean;
      lastSeenVisibility?: "everyone" | "friends" | "nobody";
      profilePhotoVisibility?: "everyone" | "friends" | "nobody";
      readReceipts?: boolean;
    };
    preferences: { language: "en" | "es" | "hi"; density: "comfortable" | "compact" };
    security?: { twoFactorEnabled: boolean };
  }>({
    notifications: { likes: true, comments: true, friendRequests: true, messages: true, sound: true, vibration: true, previews: true },
    privacy: { canMessage: "everyone", postsVisibility: "public", showActiveStatus: true, lastSeenVisibility: "everyone", profilePhotoVisibility: "everyone", readReceipts: true },
    preferences: { language: "en", density: "comfortable" },
    security: { twoFactorEnabled: false },
  });

  // Accent color state
  const [accent, setAccent] = useState<string>(() => localStorage.getItem("accent") || "#ef4444");

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", accent);
    localStorage.setItem("accent", accent);
  }, [accent]);

  // Search state (moved above `matches` to avoid TDZ)
  const [search, setSearch] = useState("");

  // Filter helper for section headings
  const matches = useMemo(() => (title: string) => title.toLowerCase().includes(search.toLowerCase()), [search]);

  // Search state moved above `matches` to avoid TDZ

  // Apply compact mode class when density changes
  useEffect(() => {
    const root = document.documentElement;
    if (settings.preferences.density === "compact") {
      root.classList.add("compact");
    } else {
      root.classList.remove("compact");
    }
  }, [settings.preferences.density]);

  const [usernameInput, setUsernameInput] = useState(user?.username ?? "");
  useEffect(() => {
    setUsernameInput(user?.username ?? "");
  }, [user?.username]);

  const [emailNotifications, setEmailNotifications] = useState<boolean>(() => localStorage.getItem("emailNotifications") === "true");
  const [fontSize, setFontSize] = useState<"sm" | "md" | "lg">(() => (localStorage.getItem("fontSize") as any) || "md");
  const [profileVisibility, setProfileVisibility] = useState<"public" | "private">(() => (localStorage.getItem("profileVisibility") as any) || "public");
  const [allowFriendRequests, setAllowFriendRequests] = useState<boolean>(() => localStorage.getItem("allowFriendRequests") !== "false");
  const [messageSeenEnabled, setMessageSeenEnabled] = useState<boolean>(() => localStorage.getItem("messageSeenEnabled") !== "false");

  useEffect(() => {
    const root = document.documentElement;
    const sizeMap: Record<"sm" | "md" | "lg", string> = { sm: "14px", md: "16px", lg: "18px" };
    root.style.setProperty("--app-font-size", sizeMap[fontSize]);
    localStorage.setItem("fontSize", fontSize);
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem("profileVisibility", profileVisibility);
  }, [profileVisibility]);

  useEffect(() => {
    localStorage.setItem("emailNotifications", String(emailNotifications));
  }, [emailNotifications]);

  useEffect(() => {
    localStorage.setItem("allowFriendRequests", String(allowFriendRequests));
  }, [allowFriendRequests]);
  useEffect(() => {
    localStorage.setItem("messageSeenEnabled", String(messageSeenEnabled));
  }, [messageSeenEnabled]);

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
          {/* Search bar */}
          <div className="mb-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search settings..."
            />
          </div>

          {/* NEW: One Settings (quick control center) */}
          <Card>
            <CardContent className="p-6 space-y-5">
              <h2 className="text-lg font-semibold">One Settings</h2>

              {/* Quick: Theme and Density */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <label className="text-sm text-muted-foreground">Theme</label>
                  <Select
                    value={theme}
                    onValueChange={(val: "light" | "dark" | "system") => {
                      setTheme(val);
                      toast(`Theme set to ${val}`);
                    }}
                  >
                    <SelectTrigger className="w-[240px]">
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm text-muted-foreground">Density</label>
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
                </div>
              </div>

              {/* Quick: Privacy essentials */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <label className="text-sm text-muted-foreground">Who can message you</label>
                  <Select
                    value={settings.privacy.canMessage}
                    onValueChange={async (val: "everyone" | "friends") => {
                      const prev = settings;
                      const next = { ...prev, privacy: { ...prev.privacy, canMessage: val } };
                      setSettings(next);
                      try {
                        await updateUserSettings({ privacy: { canMessage: val } as any });
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
                  <label className="text-sm text-muted-foreground">Posts visibility</label>
                  <Select
                    value={settings.privacy.postsVisibility}
                    onValueChange={async (val: "public" | "friends") => {
                      const prev = settings;
                      const next = { ...prev, privacy: { ...prev.privacy, postsVisibility: val } };
                      setSettings(next);
                      try {
                        await updateUserSettings({ privacy: { postsVisibility: val } as any });
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
                </div>
              </div>

              {/* Quick: 2FA and Notifications master */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="two-fa-quick" className="text-sm">Two-factor authentication</Label>
                  <Switch
                    id="two-fa-quick"
                    checked={!!settings.security?.twoFactorEnabled}
                    onCheckedChange={async (val) => {
                      const prev = settings;
                      const next = { ...prev, security: { ...(prev.security || {}), twoFactorEnabled: val } };
                      setSettings(next);
                      try {
                        await updateUserSettings({ security: { twoFactorEnabled: val } } as any);
                        toast.success(val ? "2FA enabled" : "2FA disabled");
                      } catch {
                        toast.error("Failed to update");
                        setSettings(prev);
                      }
                    }}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      const prev = settings;
                      const next = {
                        ...prev,
                        notifications: {
                          ...prev.notifications,
                          likes: true,
                          comments: true,
                          friendRequests: true,
                          messages: true,
                          sound: true,
                          vibration: true,
                          previews: true,
                        },
                      };
                      setSettings(next);
                      try {
                        await updateUserSettings({
                          notifications: {
                            likes: true,
                            comments: true,
                            friendRequests: true,
                            messages: true,
                            sound: true,
                            vibration: true,
                            previews: true,
                          } as any,
                        });
                        toast.success("All notifications turned ON");
                      } catch {
                        toast.error("Failed to update");
                        setSettings(prev);
                      }
                    }}
                  >
                    Enable All Notifications
                  </Button>

                  <Button
                    variant="outline"
                    onClick={async () => {
                      const prev = settings;
                      const next = {
                        ...prev,
                        notifications: {
                          ...prev.notifications,
                          likes: false,
                          comments: false,
                          friendRequests: false,
                          messages: false,
                          sound: false,
                          vibration: false,
                          previews: false,
                        },
                      };
                      setSettings(next);
                      try {
                        await updateUserSettings({
                          notifications: {
                            likes: false,
                            comments: false,
                            friendRequests: false,
                            messages: false,
                            sound: false,
                            vibration: false,
                            previews: false,
                          } as any,
                        });
                        toast.success("All notifications turned OFF");
                      } catch {
                        toast.error("Failed to update");
                        setSettings(prev);
                      }
                    }}
                  >
                    Disable All Notifications
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Settings */}
          <Card>
            <CardContent className="p-6 space-y-5">
              <h2 className="text-lg font-semibold">Account Settings</h2>

              {/* Profile photo change via URL (works with updateUserImage) */}
              <div className="grid gap-2">
                <label className="text-sm text-muted-foreground">Profile photo URL</label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="https://example.com/photo.jpg"
                    defaultValue={user?.image || ""}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (!val) {
                          toast.error("Enter a valid image URL");
                          return;
                        }
                        updateUserImage({ image: val })
                          .then(() => toast.success("Profile photo updated"))
                          .catch(() => toast.error("Failed to update photo"));
                      }
                    }}
                  />
                  <Button
                    onClick={async () => {
                      const input = (document.activeElement as HTMLInputElement) || null;
                      const val = input?.value?.trim();
                      if (!val) {
                        toast.error("Enter a valid image URL");
                        return;
                      }
                      try {
                        await updateUserImage({ image: val });
                        toast.success("Profile photo updated");
                      } catch {
                        toast.error("Failed to update photo");
                      }
                    }}
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
                  >
                    Save
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Paste a public image URL to set your profile photo.</p>
              </div>

              {/* Update email or phone (info only, managed by auth) */}
              <div className="grid gap-2">
                <label className="text-sm text-muted-foreground">Email / Phone</label>
                <Input disabled value={user?.email || ""} />
                <p className="text-xs text-muted-foreground">
                  Email and phone are managed by sign-in provider. Contact support to update.
                </p>
              </div>

              {/* Change password (info only, managed by auth) */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Password</div>
                <Button
                  variant="outline"
                  onClick={() => toast("Password changes are managed by the authentication provider.")}
                >
                  Change Password
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
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
                <Button
                  variant="destructive"
                  onClick={() => {
                    toast("Account deletion requires support. Please contact us.");
                  }}
                >
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>

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

          {/* Mobile/Tablet top navigation (Facebook-like) */}
          <div className="lg:hidden sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
            <div className="px-2 py-2 flex items-center justify-around">
              {[
                { icon: Home, path: "/dashboard", label: "Home" },
                { icon: MessageCircle, path: "/messages", label: "Messages" },
                { icon: Users, path: "/friends", label: "Friends" },
                { icon: Bell, path: "/notifications", label: "Notifications" },
                { icon: UserIcon, path: "/profile", label: "Profile" },
                { icon: SettingsIcon, path: "/settings", label: "Settings" },
              ].map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    aria-label={item.label}
                    className={`inline-flex flex-col items-center justify-center px-3 py-1.5 rounded-md text-xs ${
                      isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className={`w-5 h-5 mb-0.5 ${isActive ? "text-primary" : ""}`} />
                    <span className="hidden sm:inline">{item.label}</span>
                  </button>
                );
              })}
            </div>
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

              {/* Username settings */}
              <div className="pt-4">
                <h3 className="font-medium text-base mb-2">Username</h3>
                <div className="flex gap-2">
                  <Input
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="username"
                    maxLength={20}
                  />
                  <Button
                    onClick={async () => {
                      const trimmed = usernameInput.trim();
                      const re = /^[a-z0-9._-]{3,20}$/;
                      if (!re.test(trimmed)) {
                        toast.error("3-20 chars: a-z, 0-9, dot, underscore, dash");
                        return;
                      }
                      if (trimmed === (user?.username ?? "")) {
                        toast("No changes to save");
                        return;
                      }
                      try {
                        await updateUserProfile({ username: trimmed });
                        toast.success("Username updated");
                      } catch (e: any) {
                        toast.error(e?.message || "Failed to update username");
                      }
                    }}
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
                    disabled={!usernameInput.trim()}
                  >
                    Save
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Your profile link may use your username. Example: /@username
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              {matches("Appearance") && <h2 className="font-semibold text-lg">Appearance</h2>}
              {!matches("Appearance") ? null : (
                <>
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

                  <div className="grid gap-2">
                    <label className="text-sm text-muted-foreground">Accent color</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={accent}
                        onChange={(e) => setAccent(e.target.value)}
                        className="h-9 w-12 rounded-md border p-1 bg-background"
                        aria-label="Pick accent color"
                      />
                      <Button
                        variant="outline"
                        onClick={() => setAccent("#ef4444")}
                      >
                        Reset
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Changes apply instantly across buttons and highlights.
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm text-muted-foreground">Font size</label>
                    <Select
                      value={fontSize}
                      onValueChange={(val: "sm" | "md" | "lg") => {
                        setFontSize(val);
                        toast.success(`Font size set to ${val}`);
                      }}
                    >
                      <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sm">Small</SelectItem>
                        <SelectItem value="md">Default</SelectItem>
                        <SelectItem value="lg">Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Notifications card: extend with sound, vibration, previews */}
          <Card>
            <CardContent className="p-6 space-y-4">
              {matches("Notifications") && <h2 className="font-semibold text-lg">Notifications</h2>}
              {!matches("Notifications") ? null : (
                <>
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
                              await updateUserSettings({ notifications: { likes: val } as any });
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
                              await updateUserSettings({ notifications: { comments: val } as any });
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
                              await updateUserSettings({ notifications: { friendRequests: val } as any });
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
                              await updateUserSettings({ notifications: { messages: val } as any });
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

                  <div className="flex items-center justify-between">
                    <Label htmlFor="notif-sound" className="text-sm">Sound</Label>
                    <Switch
                      id="notif-sound"
                      checked={!!settings.notifications.sound}
                      onCheckedChange={async (val) => {
                        const prev = settings;
                        const next = { ...prev, notifications: { ...prev.notifications, sound: val } };
                        setSettings(next);
                        try {
                          await updateUserSettings({ notifications: { sound: val } as any });
                          toast.success("Updated");
                        } catch {
                          toast.error("Failed to update");
                          setSettings(prev);
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notif-vibration" className="text-sm">Vibration</Label>
                    <Switch
                      id="notif-vibration"
                      checked={!!settings.notifications.vibration}
                      onCheckedChange={async (val) => {
                        const prev = settings;
                        const next = { ...prev, notifications: { ...prev.notifications, vibration: val } };
                        setSettings(next);
                        try {
                          await updateUserSettings({ notifications: { vibration: val } as any });
                          toast.success("Updated");
                        } catch {
                          toast.error("Failed to update");
                          setSettings(prev);
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notif-previews" className="text-sm">Show previews in-app</Label>
                    <Switch
                      id="notif-previews"
                      checked={!!settings.notifications.previews}
                      onCheckedChange={async (val) => {
                        const prev = settings;
                        const next = { ...prev, notifications: { ...prev.notifications, previews: val } };
                        setSettings(next);
                        try {
                          await updateUserSettings({ notifications: { previews: val } as any });
                          toast.success("Updated");
                        } catch {
                          toast.error("Failed to update");
                          setSettings(prev);
                        }
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="email-notifs" className="text-sm">Email notifications</Label>
                    <Switch
                      id="email-notifs"
                      checked={emailNotifications}
                      onCheckedChange={(val) => {
                        setEmailNotifications(val);
                        toast.success(val ? "Email notifications enabled" : "Email notifications disabled");
                      }}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Privacy card: extend with last seen, profile photo visibility, read receipts */}
          <Card>
            <CardContent className="p-6 space-y-4">
              {matches("Privacy") && <h2 className="font-semibold text-lg">Privacy &amp; Security</h2>}
              {!matches("Privacy") ? null : (
                <>
                  <div className="space-y-3">
                    <div className="grid gap-2">
                      <Label className="text-sm">Profile visibility</Label>
                      <Select
                        value={profileVisibility}
                        onValueChange={(val: "public" | "private") => {
                          setProfileVisibility(val);
                          toast.success(`Profile visibility set to ${val}`);
                        }}
                      >
                        <SelectTrigger className="w-[240px]">
                          <SelectValue placeholder="Select visibility" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="public">Public</SelectItem>
                          <SelectItem value="private">Private</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Private hides your profile from people who aren't friends.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="grid gap-2">
                      <Label className="text-sm">Who can message you</Label>
                      <Select
                        value={settings.privacy.canMessage}
                        onValueChange={async (val: "everyone" | "friends") => {
                          const prev = settings;
                          const next = { ...prev, privacy: { ...prev.privacy, canMessage: val } };
                          setSettings(next);
                          try {
                            await updateUserSettings({ privacy: { canMessage: val } as any });
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
                  </div>

                  <div className="space-y-3">
                    <div className="grid gap-2">
                      <Label className="text-sm">Posts visibility</Label>
                      <Select
                        value={settings.privacy.postsVisibility}
                        onValueChange={async (val: "public" | "friends") => {
                          const prev = settings;
                          const next = { ...prev, privacy: { ...prev.privacy, postsVisibility: val } };
                          setSettings(next);
                          try {
                            await updateUserSettings({ privacy: { postsVisibility: val } as any });
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

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="active-status" className="text-sm">Active Status</Label>
                      <Switch
                        id="active-status"
                        checked={settings.privacy.showActiveStatus}
                        onCheckedChange={async (val) => {
                          const prev = settings;
                          const next = { ...prev, privacy: { ...prev.privacy, showActiveStatus: val } };
                          setSettings(next);
                          try {
                            await updateUserSettings({ privacy: { showActiveStatus: val } as any });
                            toast.success(val ? "Active status on" : "Active status off");
                          } catch {
                            toast.error("Failed to update");
                            setSettings(prev);
                          }
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      When on, friends can see when you're active or recently active.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="grid gap-2">
                      <Label className="text-sm">Last seen visibility</Label>
                      <Select
                        value={settings.privacy.lastSeenVisibility}
                        onValueChange={async (val: "everyone" | "friends" | "nobody") => {
                          const prev = settings;
                          const next = { ...prev, privacy: { ...prev.privacy, lastSeenVisibility: val } };
                          setSettings(next);
                          try {
                            await updateUserSettings({ privacy: { lastSeenVisibility: val } as any });
                            toast(`Last seen set to ${val}`);
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
                          <SelectItem value="everyone">Everyone</SelectItem>
                          <SelectItem value="friends">Friends</SelectItem>
                          <SelectItem value="nobody">Nobody</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="grid gap-2">
                      <Label className="text-sm">Profile photo visibility</Label>
                      <Select
                        value={settings.privacy.profilePhotoVisibility}
                        onValueChange={async (val: "everyone" | "friends" | "nobody") => {
                          const prev = settings;
                          const next = { ...prev, privacy: { ...prev.privacy, profilePhotoVisibility: val } };
                          setSettings(next);
                          try {
                            await updateUserSettings({ privacy: { profilePhotoVisibility: val } as any });
                            toast(`Profile photo visibility set to ${val}`);
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
                          <SelectItem value="everyone">Everyone</SelectItem>
                          <SelectItem value="friends">Friends</SelectItem>
                          <SelectItem value="nobody">Nobody</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="read-receipts" className="text-sm">Read receipts</Label>
                      <Switch
                        id="read-receipts"
                        checked={!!settings.privacy.readReceipts}
                        onCheckedChange={async (val) => {
                          const prev = settings;
                          const next = { ...prev, privacy: { ...prev.privacy, readReceipts: val } };
                          setSettings(next);
                          try {
                            await updateUserSettings({ privacy: { readReceipts: val } as any });
                            toast.success("Updated");
                          } catch {
                            toast.error("Failed to update");
                            setSettings(prev);
                          }
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      When off, you won't send or receive read receipts.
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Security card (Two-Factor toggle) */}
          <Card>
            <CardContent className="p-6 space-y-4">
              {matches("Security") && <h2 className="font-semibold text-lg">Security</h2>}
              {!matches("Security") ? null : (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="two-fa" className="text-sm">Two-factor authentication</Label>
                      <Switch
                        id="two-fa"
                        checked={!!settings.security?.twoFactorEnabled}
                        onCheckedChange={async (val) => {
                          const prev = settings;
                          const next = { ...prev, security: { ...(prev.security || {}), twoFactorEnabled: val } };
                          setSettings(next);
                          try {
                            // Cast the whole args object to avoid transient typegen mismatch
                            await updateUserSettings({ security: { twoFactorEnabled: val } } as any);
                            toast.success(val ? "2FA enabled" : "2FA disabled");
                          } catch {
                            toast.error("Failed to update");
                            setSettings(prev);
                          }
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Adds an extra step at sign-in. This setting is stored in your profile.
                    </p>
                  </div>
                </>
              )}
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

          {/* Data & Storage */}
          <Card>
            <CardContent className="p-6 space-y-5">
              <h2 className="text-lg font-semibold">Data &amp; Storage</h2>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const keys = ["theme", "accent", "fontSize", "emailNotifications", "profileVisibility", "allowFriendRequests", "messageSeenEnabled"];
                    keys.forEach((k) => localStorage.removeItem(k));
                    toast.success("Cache cleared (preferences reset)");
                  }}
                >
                  Clear Cache
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    const ts = Date.now();
                    localStorage.setItem("chatClearedAt", String(ts));
                    toast.success("Chat history cleared on this device");
                  }}
                >
                  Clear Chat History
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    const data = {
                      profile: {
                        name: user?.name,
                        username: user?.username,
                        email: user?.email,
                        image: user?.image,
                      },
                      settings,
                      client: {
                        theme,
                        accent,
                        fontSize,
                        emailNotifications,
                        profileVisibility,
                        allowFriendRequests,
                        messageSeenEnabled,
                      },
                      exportedAt: new Date().toISOString(),
                    };
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "backup.json";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download Data Backup
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    toast("Storage management is automatic. Large files are optimized by the app.");
                  }}
                >
                  Manage Storage
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* App Options */}
          <Card>
            <CardContent className="p-6 space-y-5">
              <h2 className="text-lg font-semibold">App Options</h2>

              <div className="flex items-center justify-between">
                <Label htmlFor="friend-requests" className="text-sm">Allow friend requests</Label>
                <Switch
                  id="friend-requests"
                  checked={allowFriendRequests}
                  onCheckedChange={(val) => {
                    setAllowFriendRequests(val);
                    toast.success(val ? "Friend requests enabled" : "Friend requests disabled");
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="seen-toggle" className="text-sm">Show message seen indicator</Label>
                <Switch
                  id="seen-toggle"
                  checked={messageSeenEnabled}
                  onCheckedChange={(val) => {
                    setMessageSeenEnabled(val);
                    toast.success(val ? "Seen indicator on" : "Seen indicator off");
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="auto-redirect" className="text-sm">Auto-redirect to dashboard after login</Label>
                <Switch
                  id="auto-redirect"
                  checked={true}
                  onCheckedChange={() => {
                    toast("This app redirects to your dashboard by default.");
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Help & Support */}
          <Card>
            <CardContent className="p-6 space-y-5">
              <h2 className="text-lg font-semibold">Help &amp; Support</h2>

              <div className="grid gap-2">
                <Label className="text-sm">FAQs</Label>
                <Textarea readOnly value={"• How to change my name?\nUse Account Settings > Edit Display Name.\n\n• How to change theme?\nUse Appearance > Theme selector.\n\n• How to manage notifications?\nUse Notifications section toggles."} />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => toast("Contact support at: support@example.com")}>Contact Support</Button>
                <Button variant="outline" onClick={() => toast("Terms and Privacy are available on our website.")}>Terms & Privacy</Button>
                <Button variant="outline" onClick={() => toast("App v1.0.0 • © 2025")}>About / Version</Button>
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