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
import { Menu } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useDevice } from "@/hooks/use-device";
import { MobileTopNav } from "@/components/MobileTopNav";

export default function Messages() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [selectedConversationId, setSelectedConversationId] = useState<Id<"conversations"> | null>(null);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const device = useDevice();

  const pageBg =
    device === "mobile"
      ? "bg-gradient-to-b from-background to-muted/40"
      : device === "tablet"
      ? "bg-[radial-gradient(60rem_60rem_at_0%_0%,theme(colors.muted/40),transparent)]"
      : "bg-[radial-gradient(80rem_80rem_at_100%_0%,theme(colors.muted/35),transparent)]";

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
      className={`min-h-screen ${pageBg}`}
    >
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

        {/* Main container - force remount on device change to avoid DOM reconciliation issues */}
        <main key={device} className="flex-1 mx-auto px-0 lg:px-4 py-0 lg:py-6 h-screen lg:h-[calc(100vh)]">
          {/* Top bar with hamburger + quick action */}
          <div className="p-2 lg:p-0 flex items-center justify-between">
            <button
              className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-md hover:bg-muted"
              aria-label="Open navigation"
              onClick={() => setShowMobileNav(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex-1" />
            <Button variant="secondary" size="sm" onClick={() => navigate("/dashboard")}>
              Dashboard
            </Button>
          </div>

          {/* Global mobile nav bar */}
          <MobileTopNav />

          {/* Render device layouts explicitly by detection with stable keys */}
          {device === "mobile" && (
            <div key="mobile" className="h-full flex flex-col">
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
          )}

          {device === "tablet" && (
            <div key="tablet" className="h-[calc(100vh)]">
              <div className="flex h-full border rounded-xl overflow-hidden bg-card/30 backdrop-blur-sm">
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
              <aside className="w-[360px] border-r rounded-xl overflow-hidden bg-card/50 backdrop-blur-sm">
                <ConversationsList
                  selectedConversationId={selectedConversationId}
                  onSelectConversation={(id) => setSelectedConversationId(id)}
                />
              </aside>

              {/* Chat pane */}
              <section className="flex-1 min-w-0 rounded-xl border bg-card/40 backdrop-blur-sm">
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
          )}
        </main>
      </div>
    </motion.div>
  );
}