import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Sidebar } from "@/components/Sidebar";
import { ConversationsList } from "@/components/ConversationsList";
import { ChatWindow } from "@/components/ChatWindow";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
/* removed unused Menu import */
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useDevice } from "@/hooks/use-device";
import ChatInfoSidebar from "@/components/ChatInfoSidebar";
import FriendsOnlineSidebar from "@/components/FriendsOnlineSidebar";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Phone, Video } from "lucide-react";
import { toast } from "sonner";
import { MobileTopNav } from "@/components/MobileTopNav";

export default function Messages() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [selectedConversationId, setSelectedConversationId] = useState<Id<"conversations"> | null>(null);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const device = useDevice();

  const pageBg =
    device === "mobile"
      ? "bg-gradient-to-b from-white to-muted/20"
      : device === "tablet"
      ? "bg-[radial-gradient(60rem_60rem_at_0%_0%,theme(colors.muted/20),transparent)]"
      : "bg-[radial-gradient(80rem_80rem_at_100%_0%,theme(colors.muted/15),transparent)]";

  const conversations = useQuery(api.messages.getUserConversations, {});
  const conversation = conversations?.find((c: any) => c._id === selectedConversationId);
  const otherUser = conversation?.otherParticipants?.[0];
  const displayName =
    conversation?.isGroup
      ? conversation?.groupName
      : otherUser?.name || "Chat";

  const startCall = useMutation(api.calls.startCall);
  const updateStatus = useMutation(api.users.updateStatus);

  // NEW: Robust presence handling across devices + heartbeat
  useEffect(() => {
    const goOnline = () => {
      updateStatus({ isOnline: true }).catch(() => {});
    };
    const goOffline = () => {
      updateStatus({ isOnline: false }).catch(() => {});
    };

    // Network changes
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    // Tab/window focus changes
    window.addEventListener("focus", goOnline);

    // When the page is about to be hidden or closed (mobile app switch, browser back, etc.)
    window.addEventListener("pagehide", goOffline);

    // Heartbeat: keep presence fresh while user is active (helps across tabs/devices)
    const heartbeat = setInterval(goOnline, 45000);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("focus", goOnline);
      window.removeEventListener("pagehide", goOffline);
      clearInterval(heartbeat);
    };
  }, [updateStatus]);

  useEffect(() => {
    // Go online on mount
    updateStatus({ isOnline: true }).catch(() => {});
    const onVisibility = () => {
      updateStatus({ isOnline: !document.hidden }).catch(() => {});
    };
    window.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("visibilitychange", onVisibility);
      // Best-effort: mark offline on unmount
      updateStatus({ isOnline: false }).catch(() => {});
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
      className={`h-screen overflow-hidden ${pageBg}`}
    >
      {/* Old mobile navigation bar under TopNav (mobile only) */}
      <MobileTopNav />
      {/* Top navigation bar */}
      <div className="flex">
        {/* Left Sidebar remains desktop-only; mobile/tablet use the sheet */}
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        {/* Mobile/Tablet sheet container for Sidebar */}
        <Sheet open={showMobileNav} onOpenChange={setShowMobileNav}>
          <SheetContent side="left" className="p-0 w-[85vw] sm:w-[380px]">
            <Sidebar />
          </SheetContent>
        </Sheet>

        {/* Main container - remove outer paddings, lock to viewport */}
        <main key={device} className="flex-1 mx-auto px-0 py-0 h-screen">
          {device === "mobile" && (
            <div key="mobile" className="h-full flex flex-col">
              {/* Top bar when in chat view */}
              {selectedConversationId && (
                <div className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
                  <div className="h-14 flex items-center px-2 justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Button variant="ghost" size="icon" onClick={() => setSelectedConversationId(null)}>
                        <ArrowLeft className="w-5 h-5" />
                      </Button>
                      <div className="ml-1 font-semibold truncate">{displayName}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Voice call"
                        onClick={async () => {
                          try {
                            if (!selectedConversationId) return;
                            await startCall({ conversationId: selectedConversationId, type: "voice" });
                          } catch (e: any) {
                            toast.error(e?.message || "Failed to start call");
                          }
                        }}
                      >
                        <Phone className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Video call"
                        onClick={async () => {
                          try {
                            if (!selectedConversationId) return;
                            await startCall({ conversationId: selectedConversationId, type: "video" });
                          } catch (e: any) {
                            toast.error(e?.message || "Failed to start call");
                          }
                        }}
                      >
                        <Video className="w-4 h-4" />
                      </Button>
                    </div>
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
          )}

          {device === "tablet" && (
            <div key="tablet" className="h-[calc(100vh)]">
              <div className="flex h-full border rounded-xl overflow-hidden bg-white/80 backdrop-blur-sm">
                {/* Conversations list pane */}
                <aside className="w-1/2 border-r">
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
            </div>
          )}

          {device === "desktop" && (
            <div key="desktop" className="h-[calc(100vh)] gap-4 hidden lg:flex">
              {/* Conversations list pane */}
              <aside className="w-[360px] border-r rounded-xl overflow-hidden bg-white/90 backdrop-blur-sm">
                <ConversationsList
                  selectedConversationId={selectedConversationId}
                  onSelectConversation={(id) => setSelectedConversationId(id)}
                />
              </aside>

              {/* Chat pane */}
              <section className="flex-1 min-w-0 rounded-xl border bg-white/90 backdrop-blur-sm">
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

              {/* Right info sidebar */}
              <aside className="w-[340px] border rounded-xl overflow-hidden bg-white/90 backdrop-blur-sm hidden xl:block">
                <FriendsOnlineSidebar conversationId={selectedConversationId} />
              </aside>
            </div>
          )}
        </main>
      </div>
    </motion.div>
  );
}