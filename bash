echo '
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Sidebar } from "@/components/Sidebar";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChatBubbleBottomCenterIcon } from "@heroicons/react/24/outline";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { HamburgerMenuIcon } from "@radix-ui/react-icons";

export default function Messages() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const conversations = useQuery(api.messages.getMyConversations, {
    userId: user?._id ?? null,
  });

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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-background"
    >
      <div className="flex flex-col lg:flex-row h-screen">
        {/* Mobile/Tablet Sidebar (Top Navigation) */}
        <header className="lg:hidden bg-card border-b p-4 flex items-center justify-between">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <HamburgerMenuIcon className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 pt-8">
              <Sidebar />
            </SheetContent>
          </Sheet>
          <h1 className="text-xl font-bold">Messages</h1>
          {/* Placeholder for potential right-aligned actions */}
          <div></div>
        </header>

        {/* Desktop Sidebar (Left Navigation) */}
        <aside className="hidden lg:block w-64 border-r bg-card/50">
          <Sidebar />
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Search Bar */}
          <div className="p-4 border-b">
            <Input type="search" placeholder="Search messages..." />
          </div>

          {/* Conversations List */}
          <ScrollArea className="flex-1">
            {conversations === undefined ? (
              <div className="p-6 text-sm text-muted-foreground">Loading...</div>
            ) : conversations && conversations.length > 0 ? (
              <ul className="divide-y">
                {conversations.map((c: any) => (
                  <li
                    key={c._id}
                    className="p-4 flex items-center gap-3 hover:bg-secondary/50 cursor-pointer transition-colors"
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={c.user.image} />
                      <AvatarFallback>
                        {c.user.name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{c.user.name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {c.lastMessage?.content || "No messages yet"}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.lastMessage?.createdAt
                        ? new Date(c.lastMessage.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-6 text-sm text-muted-foreground">
                No conversations yet. Start by adding friends!
              </div>
            )}
          </ScrollArea>
        </main>

        {/* Chat Window - Placeholder for actual chat interface */}
        <section className="hidden lg:flex flex-1 flex-col bg-card border-l">
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <ChatBubbleBottomCenterIcon className="h-16 w-16" />
              <h2 className="text-xl font-semibold">Select a conversation</h2>
              <p className="text-sm">Choose from your existing conversations or start a new one.</p>
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  );
}

' > src/pages/Messages.tsx
