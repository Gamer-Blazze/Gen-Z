import * as React from "react";
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
import { Search, Bell, MessageCircle, Moon, MessageSquare, Heart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LogoDropdown } from "@/components/LogoDropdown";
import { Stories } from "@/components/Stories";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UserPlus } from "lucide-react";
import FriendsOnlineSidebar from "@/components/FriendsOnlineSidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Image as ImageIcon, Video as VideoIcon, Clapperboard } from "lucide-react";
import { CreatePost } from "@/components/CreatePost";

// Add: Small ErrorBoundary to catch UI errors from API-driven sections
type ErrorBoundaryProps = {
  name?: string;
  renderFallback?: () => any;
  children: React.ReactNode;
};
type ErrorBoundaryState = { hasError: boolean };

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  static displayed: Set<string> = new Set();

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: unknown): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: any, info: any) {
    const tag = this.props.name || "Section";
    if (!ErrorBoundary.displayed.has(tag)) {
      ErrorBoundary.displayed.add(tag);
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { toast } = require("sonner");
        toast.error(`${tag} failed to load. Please try again.`);
      } catch {
        // no-op
      }
    }
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary:${tag}]`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.renderFallback ? this.props.renderFallback() : null;
    }
    return this.props.children;
  }
}

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
      {/* Removed NotificationWatcher */}

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
            <ErrorBoundary
              name="Notifications"
              renderFallback={() => (
                <button
                  className="relative h-9 w-9 rounded-full bg-muted grid place-items-center opacity-60 cursor-not-allowed"
                  title="Notifications unavailable"
                  aria-disabled="true"
                >
                  <Bell className="h-4 w-4" />
                </button>
              )}
            >
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
            </ErrorBoundary>
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
        <main className="flex-1 w-full max-w-xl mx-auto px-2 sm:px-3 py-2 sm:py-4 space-y-2 sm:space-y-3 pb-16">
          {/* Add: Create Post box above Stories, Facebook-style */}
          <CreatePost />

          {/* Stories row */}
          <div className="rounded-2xl bg-card/60 border border-border/60 p-1.5 sm:p-2">
            <Stories />
          </div>

          {/* Feed remains real-time and functional */}
          <ErrorBoundary name="Feed">
            <Feed />
          </ErrorBoundary>
        </main>

        {/* Right Sidebar */}
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