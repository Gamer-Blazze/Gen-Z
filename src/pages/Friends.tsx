import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { useEffect, useState, useMemo } from "react";
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
/* removed duplicate imports */
import { api } from "@/convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

export default function Friends() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [selectedConversationId, setSelectedConversationId] = useState<Id<"conversations"> | null>(null);
  const location = useLocation();

  const [showMobileNav, setShowMobileNav] = useState(false);

  const [tab, setTab] = useState<"friends" | "suggestions">("friends");
  const [search, setSearch] = useState("");
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  // Data
  const friends = useQuery(api.friends.getUserFriends, {});
  const suggestions = useQuery(api.friends.getSuggestions, { limit: 12 });
  const searchResults = useQuery(
    api.friends.searchUsers,
    search.trim().length >= 2 ? { query: search.trim() } : "skip"
  );
  const sendFriend = useMutation(api.friends.sendFriendRequest);

  const onHide = (id: string) => {
    setHidden((prev) => new Set([...prev, id]));
  };

  const visibleSuggestions = useMemo(() => {
    const list = search.trim().length >= 2 ? (searchResults || []) : (suggestions || []);
    return list.filter((u) => !hidden.has(u._id as unknown as string));
  }, [search, searchResults, suggestions, hidden]);

  const handleAddFriend = async (id: string) => {
    try {
      await sendFriend({ userId: id as any });
      toast.success("Friend request sent");
      onHide(id);
    } catch (e: any) {
      toast.error(e?.message || "Failed to send request");
    }
  };

  // Mock mutual friends count (stable-ish hash)
  const mutualCount = (id: string) => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return (h % 4) + 1; // 1..4
  };

  // Skeleton card
  const SuggestionSkeleton = () => (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-20" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-6">
        {/* Top bar */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">Friends</h1>
          <div className="w-full sm:w-80">
            <Input
              placeholder="Search for people"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="friends">Your Friends</TabsTrigger>
            <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
          </TabsList>

          {/* Your Friends */}
          <TabsContent value="friends" className="mt-4">
            <div className="space-y-3">
              {!friends ? (
                // Loading skeletons for friend rows
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-9 w-24" />
                  </div>
                ))
              ) : friends.length === 0 ? (
                <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
                  You don't have any friends yet.
                </div>
              ) : (
                friends.map((friend) => {
                  if (!friend) return null;
                  return (
                    <div
                      key={friend._id}
                      className="flex items-center gap-3 rounded-lg border bg-card p-3"
                    >
                      <button
                        className="shrink-0"
                        onClick={() => navigate(`/profile?id=${friend._id}`)}
                        aria-label="View profile"
                      >
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={friend.image} />
                          <AvatarFallback className="bg-muted">
                            {friend.name?.charAt(0) || "U"}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate font-medium hover:underline cursor-pointer"
                          onClick={() => navigate(`/profile?id=${friend._id}`)}
                        >
                          {friend.name || "Anonymous"}
                        </p>
                        <p className="text-xs text-muted-foreground">Friend</p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => navigate(`/messages?user=${friend._id}`)}
                        className="gap-2"
                      >
                        <MessageCircle className="h-4 w-4" />
                        Message
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>

          {/* Suggestions */}
          <TabsContent value="suggestions" className="mt-4">
            {!suggestions && search.trim().length < 2 ? (
              // Grid skeleton while initial suggestions load
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SuggestionSkeleton key={i} />
                ))}
              </div>
            ) : visibleSuggestions.length === 0 ? (
              <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
                {search.trim().length >= 2
                  ? "No people found."
                  : "No suggestions right now. Try searching for people."}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleSuggestions.map((u) => {
                  const id = u._id as unknown as string;
                  return (
                    <div key={id} className="rounded-lg border bg-card p-4">
                      <div className="flex items-center gap-3">
                        <button
                          className="shrink-0"
                          onClick={() => navigate(`/profile?id=${id}`)}
                          aria-label="View profile"
                        >
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={u.image} />
                            <AvatarFallback className="bg-muted">
                              {u.name?.charAt(0) || "U"}
                            </AvatarFallback>
                          </Avatar>
                        </button>
                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate font-medium hover:underline cursor-pointer"
                            onClick={() => navigate(`/profile?id=${id}`)}
                          >
                            {u.name || "Anonymous"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {mutualCount(id)} mutual friends
                          </p>
                        </div>
                        <button
                          aria-label="Hide suggestion"
                          className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                          onClick={() => onHide(id)}
                          title="Hide"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <Button
                          className="flex-1 bg-[#1877F2] hover:bg-[#166FE5] text-white"
                          onClick={() => handleAddFriend(id)}
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          Add Friend
                        </Button>
                        <Button variant="outline" onClick={() => onHide(id)}>
                          Hide
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}