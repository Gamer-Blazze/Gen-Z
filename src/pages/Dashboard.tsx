import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Sidebar } from "@/components/Sidebar";
import { Feed } from "@/components/Feed";
import { FriendsSidebar } from "@/components/FriendsSidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { MobileTopNav } from "@/components/MobileTopNav";
import { Search, Bell, MessageCircle, Moon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LogoDropdown } from "@/components/LogoDropdown";
import { Stories } from "@/components/Stories";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UserPlus } from "lucide-react";
import FriendsOnlineSidebar from "@/components/FriendsOnlineSidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Image as ImageIcon, Video as VideoIcon, Clapperboard } from "lucide-react";
import { CreatePost } from "@/components/CreatePost";
import { Heart, MessageSquare } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { isLoading, isAuthenticated, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [showComingSoon, setShowComingSoon] = useState<boolean>(() => {
    try {
      return localStorage.getItem("hideComingSoon") !== "1";
    } catch {
      return true;
    }
  });
  const [isMobileView, setIsMobileView] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.matchMedia("(max-width: 767px)").matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobileView(e.matches);
    try {
      mql.addEventListener("change", handler);
    } catch {
      // Safari fallback
      // @ts-ignore
      mql.addListener(handler);
    }
    // Sync once on mount
    setIsMobileView(mql.matches);
    return () => {
      try {
        mql.removeEventListener("change", handler);
      } catch {
        // Safari fallback
        // @ts-ignore
        mql.removeListener(handler);
      }
    };
  }, []);

  useEffect(() => {
    // Sync in case of SSR hydration or storage changes
    try {
      const hidden = localStorage.getItem("hideComingSoon") === "1";
      if (hidden && showComingSoon) setShowComingSoon(false);
    } catch {
      // no-op
    }
  }, []);

  // Background watcher for notifications: plays tones + toasts for calls/messages
  function NotificationWatcher({ enabled = true }: { enabled?: boolean }) {
    if (!enabled) return null;
    const { isAuthenticated, user } = useAuth();
    const notifPrefs = ((user as any)?.settings?.notifications) || {};
    const enableSound = notifPrefs.sound !== false;
    const enableVibration = notifPrefs.vibration !== false;

    const unread = useQuery(
      api.notifications.getMyNotifications,
      isAuthenticated && user ? { limit: 20, unreadOnly: true } : "skip"
    );

    const seenRef = useRef<Set<string>>(new Set());

    // Simple tones using Web Audio API (autoplay policies may still require a user gesture)
    const playTone = (kind: "message" | "call") => {
      if (!enableSound) return;
      try {
        const AudioCtx =
          (window as any).AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";

        if (kind === "message") {
          // Short ping
          osc.frequency.value = 800;
          gain.gain.value = 0.0001;
          osc.start();
          gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
          osc.stop(ctx.currentTime + 0.35);
        } else {
          // Brief ring burst
          osc.frequency.value = 440;
          gain.gain.value = 0.0001;
          osc.start();
          gain.gain.exponentialRampToValueAtTime(0.28, ctx.currentTime + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
          osc.stop(ctx.currentTime + 1.25);
        }
      } catch {
        // Ignore audio errors (e.g., autoplay blocked)
      }
    };

    const vibrate = (pattern: number[]) => {
      if (enableVibration && typeof navigator.vibrate === "function") {
        navigator.vibrate(pattern);
      }
    };

    const handleIncoming = (n: any) => {
      const sender = n.fromUser?.name || "Someone";
      if (n.type === "message") {
        playTone("message");
        vibrate([30]);
        toast(`${sender} sent a message`, {
          action: {
            label: "Open",
            onClick: () => {
              window.location.href = "/messages";
            },
          },
        });
      } else if (n.type === "voice_call" || n.type === "video_call" || n.type === "call") {
        playTone("call");
        vibrate([120, 60, 120]);
        toast(`${sender} is calling…`, {
          action: {
            label: "Answer",
            onClick: () => {
              window.location.href = "/friends";
            },
          },
        });
      // Add: like and comment notifications
      } else if (n.type === "like") {
        playTone("message");
        vibrate([20]);
        toast(`${sender} liked your post`, {
          action: {
            label: "View",
            onClick: () => window.location.assign("/dashboard"),
          },
        });
      } else if (n.type === "comment") {
        playTone("message");
        vibrate([30, 30]);
        toast(`${sender} commented on your post`, {
          action: {
            label: "View",
            onClick: () => window.location.assign("/dashboard"),
          },
        });
      }
    };

    useEffect(() => {
      if (!Array.isArray(unread)) return;
      for (const n of unread) {
        const id = n._id as unknown as string;
        if (!seenRef.current.has(id)) {
          handleIncoming(n);
          seenRef.current.add(id);
          // Trim memory
          if (seenRef.current.size > 200) {
            seenRef.current = new Set(Array.from(seenRef.current).slice(-100));
          }
        }
      }
    }, [unread]);

    return null;
  }

  // Add: real-time unread notifications count
  const unreadCount = useQuery(
    api.notifications.getUnreadCount,
    isAuthenticated && user ? {} : "skip"
  );

  // Add: live notifications list for dropdown panel
  const myNotifications = useQuery(
    api.notifications.getMyNotifications,
    isAuthenticated && user ? { limit: 10 } : "skip"
  );
  const markAll = useMutation(api.notifications.markAllAsRead);

  // Add: real-time presence updates (same robust handling as Messages)
  const updateStatus = useMutation(api.users.updateStatus);

  // Add: resilient presence update helper with offline check + throttled error toast
  const presenceErrorAtRef = useRef<number>(0);
  const safeUpdatePresence = async (isOnline: boolean) => {
    // Avoid attempting "online" while the browser is offline
    if (typeof navigator !== "undefined" && !navigator.onLine && isOnline) return;
    try {
      await updateStatus({ isOnline });
    } catch (e: any) {
      const now = Date.now();
      if (now - (presenceErrorAtRef.current || 0) > 30000) {
        presenceErrorAtRef.current = now;
        toast.error("Failed to update your presence. We'll retry automatically.");
      }
    }
  };

  useEffect(() => {
    const goOnline = () => {
      safeUpdatePresence(true);
    };
    const goOffline = () => {
      safeUpdatePresence(false);
    };

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener("focus", goOnline);
    window.addEventListener("pagehide", goOffline);

    // Heartbeat to keep presence fresh
    const heartbeat = setInterval(() => safeUpdatePresence(true), 45000);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("focus", goOnline);
      window.removeEventListener("pagehide", goOffline);
      clearInterval(heartbeat);
    };
  }, [updateStatus]);

  useEffect(() => {
    // Mark online on mount
    safeUpdatePresence(true);
    const onVisibility = () => {
      safeUpdatePresence(!document.hidden);
    };
    window.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("visibilitychange", onVisibility);
      // Best-effort set offline on unmount
      safeUpdatePresence(false);
    };
  }, [updateStatus]);

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
      className="min-h-screen bg-background overflow-x-hidden"
    >
      {/* Mount watcher only on mobile to avoid desktop popups/sounds */}
      <NotificationWatcher enabled={isMobileView} />
      {/* Desktop Top Navigation (sticky) */}
      <div className="hidden md:block sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl px-4 h-14 flex items-center gap-4">
          {/* Left: Logo */}
          <div className="flex items-center">
            <LogoDropdown />
          </div>
          {/* Center: Search */}
          <div className="flex-1 max-w-xl">
            <div className="relative">
              <Input
                placeholder="Search Gen-Z"
                className="pl-9"
              />
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          {/* Right: Icons + Profile */}
          <div className="flex items-center gap-2">
            {/* Friend Requests */}
            <button className="h-9 w-9 rounded-full bg-muted grid place-items-center" title="Friend requests">
              <UserPlus className="h-4 w-4" />
            </button>
            {/* Messages */}
            <button className="h-9 w-9 rounded-full bg-muted grid place-items-center" title="Messages">
              <MessageCircle className="h-4 w-4" />
            </button>
            {/* Reels */}
            <button
              className="h-9 w-9 rounded-full bg-muted grid place-items-center"
              title="Reels"
              onClick={() => navigate("/reels")}
            >
              <Clapperboard className="h-4 w-4" />
            </button>
            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="relative h-9 w-9 rounded-full bg-muted grid place-items-center"
                  title="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount && typeof unreadCount.count === "number" && unreadCount.count > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[11px] leading-[18px] text-white grid place-items-center">
                      {unreadCount.count > 9 ? "9+" : unreadCount.count}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between px-3 py-2 border-b">
                  <span className="text-sm font-medium">Notifications</span>
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={async () => {
                      try {
                        await markAll({});
                        toast("All notifications marked as read");
                      } catch {
                        toast("Failed to mark as read");
                      }
                    }}
                  >
                    Mark all as read
                  </button>
                </div>
                <div className="max-h-80 overflow-auto">
                  {!Array.isArray(myNotifications) ? (
                    <div className="px-3 py-4 text-sm text-muted-foreground">Loading…</div>
                  ) : myNotifications.length === 0 ? (
                    <div className="px-3 py-6 text-sm text-muted-foreground text-center">
                      You're all caught up!
                    </div>
                  ) : (
                    myNotifications.map((n: any) => {
                      const isUnread = n.isRead === false;
                      const icon =
                        n.type === "message" ? (
                          <MessageSquare className="h-4 w-4 text-blue-500" />
                        ) : n.type === "like" ? (
                          <Heart className="h-4 w-4 text-rose-500" />
                        ) : n.type === "comment" ? (
                          <MessageSquare className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Bell className="h-4 w-4 text-muted-foreground" />
                        );
                      return (
                        <div
                          key={n._id as unknown as string}
                          className={`flex items-start gap-3 px-3 py-2 ${isUnread ? "bg-muted/50" : ""}`}
                        >
                          <div className="mt-1">{icon}</div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm leading-5">
                              {n.content || "You have a new notification"}
                            </p>
                          </div>
                          {isUnread && <span className="mt-1 h-2 w-2 rounded-full bg-primary" />}
                        </div>
                      );
                    })
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Dark/Light */}
            <button className="h-9 w-9 rounded-full bg-muted grid place-items-center" title="Theme">
              <Moon className="h-4 w-4" />
            </button>
            {/* Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-1 rounded-full focus:outline-none ring-0">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user?.image} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {user?.name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => window.location.assign("/profile")}>
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.location.assign("/settings")}>
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    try {
                      await signOut();
                      window.location.assign("/auth");
                    } catch {
                      // no-op
                    }
                  }}
                >
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Mobile Top Navigation */}
      <MobileTopNav />

      <div className="flex flex-col lg:flex-row">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        {/* Main Content */}
        <main className="flex-1 w-full max-w-2xl mx-auto px-2 sm:px-4 py-3 sm:py-6 space-y-3 sm:space-y-4 pb-16">
          {/* Stories row with tighter mobile padding */}
          <div className="rounded-2xl bg-card/60 border border-border/60 p-2 sm:p-3">
            <Stories />
          </div>
          {/* Feed remains real-time and functional */}
          <Feed />
        </main>

        {/* Right Sidebar (only on xl and up) */}
        <div className="hidden xl:block">
          <div className="w-80 space-y-4 pr-2">
            <FriendsSidebar />
            <FriendsOnlineSidebar />
          </div>
        </div>
      </div>
    </motion.div>
  );
}