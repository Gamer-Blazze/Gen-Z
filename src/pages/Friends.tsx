import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Sidebar } from "@/components/Sidebar";
import { ConversationsList } from "@/components/ConversationsList";
import { ChatWindow } from "@/components/ChatWindow";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Home, MessageCircle, Users, Bell, Settings, User } from "lucide-react";
import { useLocation } from "react-router";
import { toast } from "sonner";

export default function Friends() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [selectedConversationId, setSelectedConversationId] = useState<Id<"conversations"> | null>(null);
  const location = useLocation();

  const [showMobileNav, setShowMobileNav] = useState(false);
  const [userIdSearch, setUserIdSearch] = useState("");

  const userById = useQuery(
    api.users.getUserByRawId,
    userIdSearch.trim().length > 0 ? { rawId: userIdSearch.trim() } : "skip"
  );

  type UserDoc = import("@/convex/_generated/dataModel").Doc<"users">;
  const userByIdUser: UserDoc | null =
    userById && typeof userById === "object" && "email" in (userById as any)
      ? (userById as UserDoc)
      : null;

  const receivedRequests = useQuery(api.friends.getPendingFriendRequests, {});
  const acceptRequest = useMutation(api.friends.acceptFriendRequest);
  const rejectRequest = useMutation(api.friends.declineFriendRequest);

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
      {/* Mobile/Tablet sheet container for Sidebar */}
      <Sheet open={showMobileNav} onOpenChange={setShowMobileNav}>
        <SheetContent side="left" className="p-0 w-[85vw] sm:w-[380px]">
          <Sidebar />
        </SheetContent>
      </Sheet>

      <div className="flex">
        {/* Left app navigation (desktop) */}
        <aside className="hidden lg:block w-64 border-r bg-card/50">
          <Sidebar />
        </aside>

        <main className="flex-1 mx-auto px-0 lg:px-4 py-0 lg:py-6 h-screen lg:h-[calc(100vh)]">
          {/* Mobile & Tablet Top Navigation (Facebook-like) */}
          <div className="lg:hidden sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
            <div className="px-2 py-2 flex items-center justify-around">
              {[
                { icon: Home, path: "/dashboard", label: "Home" },
                { icon: MessageCircle, path: "/messages", label: "Messages" },
                { icon: Users, path: "/friends", label: "Friends" },
                { icon: Bell, path: "/notifications", label: "Notifications" },
                { icon: User, path: "/profile", label: "Profile" },
                { icon: Settings, path: "/settings", label: "Settings" },
              ].map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    aria-label={item.label}
                    className={`inline-flex flex-col items-center justify-center px-3 py-1.5 rounded-md text-xs ${
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className={`w-5 h-5 mb-0.5 ${isActive ? "text-primary" : ""}`} />
                    <span className="hidden sm:inline">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Top action bar with hamburger + Add Friend + User ID search (moved here) */}
          <div className="px-2 py-2 lg:px-0 lg:py-0">
            <div className="flex items-center justify-between gap-2">
              <button
                className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-md hover:bg-muted"
                aria-label="Open navigation"
                onClick={() => setShowMobileNav(true)}
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="ml-auto flex items-center gap-2 w-full max-w-[720px]">
                {/* Moved friend search to sidebar (desktop & mobile sections) */}
                {/* User ID quick search moved from top bar to sidebar */}
                <div className="hidden" />
              </div>
            </div>
          </div>

          {/* Friend Requests list (incoming) */}
          {receivedRequests && receivedRequests.length > 0 && (
            <div className="px-2 lg:px-0 mb-3">
              <div className="rounded-xl border bg-card">
                <div className="p-3 border-b">
                  <h3 className="font-semibold">Friend Requests</h3>
                </div>
                <div className="p-2 space-y-2 max-h-72 overflow-y-auto">
                  {receivedRequests.map((req: any) => (
                    <div
                      key={req._id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                    >
                      <button
                        onClick={() => req.requester?._id && navigate(`/profile?id=${req.requester._id}`)}
                        className="shrink-0"
                        aria-label="View profile"
                      >
                        <img
                          src={req.requester?.image}
                          alt={req.requester?.name || "User"}
                          className="w-10 h-10 rounded-full object-cover border"
                        />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p
                          className="font-medium text-sm truncate cursor-pointer hover:underline"
                          onClick={() => req.requester?._id && navigate(`/profile?id=${req.requester._id}`)}
                        >
                          {req.requester?.name || "Anonymous"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {req.requester?.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="h-7 px-3"
                          onClick={async () => {
                            try {
                              await acceptRequest({ requestId: req._id });
                              toast.success("Friend request accepted");
                            } catch (e: any) {
                              toast.error(e?.message || "Failed to accept");
                            }
                          }}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 px-3"
                          onClick={async () => {
                            try {
                              await rejectRequest({ requestId: req._id });
                              toast.success("Friend request rejected");
                            } catch (e: any) {
                              toast.error(e?.message || "Failed to reject");
                            }
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Mobile view: show either list or chat with a top bar */}
          <div className="lg:hidden h-full flex flex-col">
            {/* Top bar when in chat view */}
            {selectedConversationId && (
              <div className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
                <div className="h-14 flex items-center px-2">
                  <Button variant="ghost" size="icon" onClick={() => setSelectedConversationId(null)}>
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <div className="ml-2 font-semibold">Chat</div>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-hidden">
                {!selectedConversationId ? (
                  <div className="h-full">
                    <ConversationsList
                      selectedConversationId={selectedConversationId}
                      onSelectConversation={(id) => setSelectedConversationId(id)}
                    />
                  </div>
                ) : (
                <div className="h-[calc(100vh-56px)]">
                  <ChatWindow conversationId={selectedConversationId} />
                </div>
              )}
            </div>
          </div>

          {/* Desktop view: split layout */}
          <div className="hidden lg:flex h-[calc(100vh)] gap-0 lg:gap-4">
            {/* Conversations list pane */}
            <aside className="w-[360px] border-r">
              <ConversationsList
                selectedConversationId={selectedConversationId}
                onSelectConversation={(id) => setSelectedConversationId(id)}
              />
            </aside>

            {/* Chat pane */}
            <section className="flex-1 min-w-0">
              {selectedConversationId ? (
                <div className="h-full">
                  <ChatWindow conversationId={selectedConversationId} />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground px-4">
                  <div className="text-center">
                    <h3 className="font-semibold mb-2">Select a conversation</h3>
                    <p className="text-sm">Choose a chat from the left to start messaging</p>
                  </div>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </motion.div>
  );
}