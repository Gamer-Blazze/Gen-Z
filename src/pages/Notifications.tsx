import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bell, MessageCircle, Heart, MessageSquareText, UserPlus, CheckCircle2, Phone, Video, PhoneOff, VideoOff } from "lucide-react";
import { toast } from "sonner";
import { TopNav } from "@/components/TopNav";

export default function Notifications() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  // Initialize hooks before any early returns to keep hook order stable
  const notifications = useQuery(
    api.notifications.getMyNotifications,
    isAuthenticated && user ? { limit: 50 } : "skip"
  );
  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);

  const [isMarkAllLoading, setIsMarkAllLoading] = useState(false);
  const [markingIds, setMarkingIds] = useState<Set<string>>(new Set());
  const [viewingIds, setViewingIds] = useState<Set<string>>(new Set());

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

  const navigateToTarget = (n: any) => {
    switch (n.type) {
      case "message":
        return "/friends";
      case "voice_call":
      case "video_call":
      case "missed_call":
      case "call":
        return "/friends";
      case "friend_request":
      case "friend_accepted":
        return n.fromUserId ? `/profile?id=${n.fromUserId}` : "/friends";
      case "like":
      case "comment":
      default:
        return "/dashboard";
    }
  };

  const typeIcon = (t: any) => {
    switch (t) {
      case "message":
        return <MessageCircle className="w-4 h-4" />;
      case "like":
        return <Heart className="w-4 h-4" />;
      case "comment":
        return <MessageSquareText className="w-4 h-4" />;
      case "friend_request":
        return <UserPlus className="w-4 h-4" />;
      case "friend_accepted":
        return <CheckCircle2 className="w-4 h-4" />;
      // Call-style notifications
      case "voice_call":
      case "call":
        return <Phone className="w-4 h-4" />;
      case "video_call":
        return <Video className="w-4 h-4" />;
      case "missed_call":
        return <PhoneOff className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-background">
      <div className="flex">
        <main className="flex-1 w-full mx-auto px-4 py-6 h-[calc(100vh)]">
          {/* Global Top Navigation */}
          <TopNav />

          {/* Make the page header sticky at the top */}
          <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
            <div className="flex items-center justify-between px-0 py-3">
              <h1 className="text-2xl font-bold">Notifications</h1>
              <Button
                variant="outline"
                size="sm"
                disabled={isMarkAllLoading}
                onClick={async () => {
                  try {
                    setIsMarkAllLoading(true);
                    await markAllAsRead({});
                    toast.success("All notifications marked as read");
                  } catch (e) {
                    toast.error("Failed to mark all as read");
                  } finally {
                    setIsMarkAllLoading(false);
                  }
                }}
              >
                {isMarkAllLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Marking...
                  </span>
                ) : (
                  "Mark all as read"
                )}
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {notifications === undefined ? (
                <div className="p-6 text-sm text-muted-foreground">Loading...</div>
              ) : notifications && notifications.length > 0 ? (
                <ul className="divide-y">
                  {notifications.map((n: any) => (
                    <li
                      key={n._id}
                      className={`p-4 flex items-start gap-3 ${n.isRead ? "bg-transparent" : "bg-primary/5"}`}
                    >
                      <div
                        className={`mt-1 inline-flex items-center justify-center w-8 h-8 rounded-full ${
                          n.type === "like"
                            ? "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400"
                            : n.type === "comment"
                            ? "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
                            : n.type === "message"
                            ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
                            : n.type === "friend_request" || n.type === "friend_accepted"
                            ? "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400"
                            : n.type === "voice_call" || n.type === "call"
                            ? "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
                            : n.type === "video_call"
                            ? "bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400"
                            : n.type === "missed_call"
                            ? "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400"
                            : "bg-muted text-foreground"
                        }`}
                        aria-hidden
                      >
                        {typeIcon(n.type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <button
                            className="shrink-0"
                            onClick={() => n.fromUserId && (window.location.href = `/profile?id=${n.fromUserId}`)}
                            aria-label="Open sender profile"
                          >
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={n.fromUser?.image} />
                              <AvatarFallback>{n.fromUser?.name?.charAt(0) || "U"}</AvatarFallback>
                            </Avatar>
                          </button>
                          <p className="text-sm leading-snug">
                            <span className="font-medium">{n.fromUser?.name || "Someone"}</span>{" "}
                            <span className="text-muted-foreground">{n.content}</span>
                          </p>
                        </div>

                        <div className="mt-2 flex items-center gap-2">
                          {!n.isRead && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-7 px-2"
                              disabled={markingIds.has(n._id as string)}
                              onClick={async () => {
                                try {
                                  setMarkingIds((s) => new Set(s).add(n._id as string));
                                  await markAsRead({ notificationId: n._id });
                                } catch {
                                  toast.error("Failed to mark as read");
                                } finally {
                                  setMarkingIds((s) => {
                                    const next = new Set(s);
                                    next.delete(n._id as string);
                                    return next;
                                  });
                                }
                              }}
                            >
                              {markingIds.has(n._id as string) ? (
                                <span className="inline-flex items-center gap-2">
                                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-foreground/60 border-t-transparent" />
                                  Marking...
                                </span>
                              ) : (
                                "Mark as read"
                              )}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            className="h-7 px-3"
                            disabled={viewingIds.has(n._id as string)}
                            onClick={async () => {
                              try {
                                setViewingIds((s) => new Set(s).add(n._id as string));
                                if (!n.isRead) {
                                  await markAsRead({ notificationId: n._id });
                                }
                              } catch {
                                // non-blocking
                              } finally {
                                const to = navigateToTarget(n);
                                window.location.href = to;
                                setViewingIds((s) => {
                                  const next = new Set(s);
                                  next.delete(n._id as string);
                                  return next;
                                });
                              }
                            }}
                          >
                            {viewingIds.has(n._id as string) ? (
                              <span className="inline-flex items-center gap-2">
                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/60 border-t-transparent" />
                                Opening...
                              </span>
                            ) : (
                              "View"
                            )}
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-6 text-sm text-muted-foreground">No notifications yet.</div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </motion.div>
  );
}