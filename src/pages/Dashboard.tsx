import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { Sidebar } from "@/components/Sidebar";
import { Feed } from "@/components/Feed";
import { CreatePost } from "@/components/CreatePost";
import { FriendsSidebar } from "@/components/FriendsSidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";

/* removed MobileTopNav on dashboard */

export default function Dashboard() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  // Background watcher for notifications: plays tones + toasts for calls/messages
  function NotificationWatcher() {
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
      {/* Global mobile nav bar removed on Dashboard */}
      {/* Add top navigation bar */}
      <TopNav />

      {/* Background notifications watcher */}
      <NotificationWatcher />

      {/* Removed Profile Quick Switch Bar */}
      <div className="flex flex-col lg:flex-row">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        {/* Main Content */}
        <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-6">
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