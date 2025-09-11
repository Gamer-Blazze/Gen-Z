import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bell, MessageCircle, Heart, MessageSquareText, UserPlus, CheckCircle2 } from "lucide-react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MobileTopNav } from "@/components/MobileTopNav";

export default function Notifications() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  // Add loading states
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [loadingItemIds, setLoadingItemIds] = useState<Set<string>>(new Set());
  const startLoading = (id: string) => setLoadingItemIds((prev) => new Set(prev).add(id));
  const stopLoading = (id: string) =>
    setLoadingItemIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  // Initialize hooks before any early returns to keep hook order stable
  const notifications = useQuery(
    api.notifications.getMyNotifications,
    isAuthenticated && user ? { limit: 50 } : "skip"
  );
  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);

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
    // Minimal, safe navigation targets
    switch (n.type) {
      case "message":
        // Takes the user to chats
        return "/friends";
      case "friend_request":
      case "friend_accepted":
        // Takes the user to the sender's profile
        return n.fromUserId ? `/profile?id=${n.fromUserId}` : "/friends";
      case "like":
      case "comment":
      default:
        // Takes the user to the feed for now
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
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-background">
      <div className="flex">
        <main className="flex-1 w-full mx-auto px-4 py-6 h-[calc(100vh)]">
          {/* Top navigation bar */}
          <MobileTopNav showOnDesktop />

          {/* Make the page header sticky at the top */}
          <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
            <div className="flex items-center justify-between px-0 py-3">
              <h1 className="text-2xl font-bold">Notifications</h1>
              <Button
                variant="outline"
                size="sm"
                disabled={isMarkingAll}
                onClick={async () => {
                  try {
                    setIsMarkingAll(true);
                    await markAllAsRead({});
                    toast.success("All notifications marked as read");
                  } catch (e) {
                    toast.error("Failed to mark all as read");
                  } finally {
                    setIsMarkingAll(false);
                  }
                }}
                aria-busy={isMarkingAll}
              >
                {isMarkingAll ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Marking…
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
                              disabled={loadingItemIds.has(n._id as unknown as string)}
                              onClick={async () => {
                                const idStr = n._id as unknown as string;
                                try {
                                  startLoading(idStr);
                                  await markAsRead({ notificationId: n._id });
                                } catch {
                                  toast.error("Failed to mark as read");
                                } finally {
                                  stopLoading(idStr);
                                }
                              }}
                              aria-busy={loadingItemIds.has(n._id as unknown as string)}
                            >
                              {loadingItemIds.has(n._id as unknown as string) ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  Marking…
                                </span>
                              ) : (
                                "Mark as read"
                              )}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            className="h-7 px-3"
                            disabled={loadingItemIds.has(n._id as unknown as string)}
                            onClick={async () => {
                              const idStr = n._id as unknown as string;
                              try {
                                startLoading(idStr);
                                if (!n.isRead) {
                                  await markAsRead({ notificationId: n._id });
                                }
                              } catch {
                                // non-blocking
                              } finally {
                                stopLoading(idStr);
                                const to = navigateToTarget(n);
                                window.location.href = to;
                              }
                            }}
                            aria-busy={loadingItemIds.has(n._id as unknown as string)}
                          >
                            {loadingItemIds.has(n._id as unknown as string) ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Opening…
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