import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Sidebar } from "@/components/Sidebar";
import { ConversationsList } from "@/components/ConversationsList";
import { ChatWindow } from "@/components/ChatWindow";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ArrowLeft, Menu } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useLocation } from "react-router";
import { MobileTopNav } from "@/components/MobileTopNav";

export default function Friends() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [selectedConversationId, setSelectedConversationId] = useState<Id<"conversations"> | null>(null);
  const location = useLocation();

  const [showMobileNav, setShowMobileNav] = useState(false);

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

        <main className="flex-1 mx-auto px-0 lg:px-4 py-0 lg:py-6 h-screen lg:h-[calc(100vh)]" key={selectedConversationId ? "chat" : "list"}>
          {/* Mobile & Tablet Top Navigation (Facebook-like) */}
          <MobileTopNav />

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
                <div className="h-full" key="mobile-list">
                  <ConversationsList
                    selectedConversationId={selectedConversationId}
                    onSelectConversation={(id) => setSelectedConversationId(id)}
                  />
                </div>
              ) : (
                <div className="h-[calc(100vh-56px)]" key="mobile-chat">
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
                <div className="h-full" key="desktop-chat">
                  <ChatWindow conversationId={selectedConversationId} />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground px-4" key="desktop-empty">
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