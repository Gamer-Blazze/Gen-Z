import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Id } from "@/convex/_generated/dataModel";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ConversationsListProps {
  selectedConversationId: Id<"conversations"> | null;
  onSelectConversation: (id: Id<"conversations">) => void;
}

export function ConversationsList({ selectedConversationId, onSelectConversation }: ConversationsListProps) {
  const conversations = useQuery(api.messages.getUserConversations, {});
  const [openNewDialog, setOpenNewDialog] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "unread" | "groups" | "communities">("all");
  const { user } = useAuth();

  const searchResults = useQuery(
    api.friends.searchUsers,
    search.trim().length >= 2 ? { query: search.trim() } : "skip"
  );

  const getOrCreateConversation = useMutation(api.messages.getOrCreateConversation);

  const navigate = useNavigate();

  const filtered = useMemo(() => {
    if (!conversations) return [];
    switch (tab) {
      case "unread":
        return conversations.filter((conversation: any) => {
          const last = conversation.lastMessage;
          const currentUserId = user?._id;
          const hasUserReadLast =
            !!last && Array.isArray(last.readBy) && last.readBy.some((rb: { userId: any }) => rb.userId === currentUserId);
          const sentByMe = last?.senderId === currentUserId;
          const isUnread = !!last && !sentByMe && !hasUserReadLast;
          return isUnread;
        });
      case "groups":
        return conversations.filter((c: any) => c.isGroup);
      case "communities":
        // Placeholder filter; if communities are a special subtype, adjust accordingly
        return conversations.filter((c: any) => c.isGroup && c.groupType === "community");
      case "all":
      default:
        return conversations;
    }
  }, [conversations, tab, user?._id]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      {/* Make header sticky on mobile for better UX */}
      <div className="p-4 border-b border-border sticky top-0 z-10 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Chats</h2>
          <Dialog open={openNewDialog} onOpenChange={setOpenNewDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                New Message
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Message</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email"
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="max-h-80 overflow-y-auto space-y-2">
                  {search.trim().length >= 2 ? (
                    <>
                      {searchResults && searchResults.length > 0 ? (
                        searchResults.map((u) => (
                          <button
                            key={u._id}
                            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 text-left"
                            onClick={async () => {
                              try {
                                const convId = await getOrCreateConversation({
                                  participantIds: [u._id],
                                  isGroup: false,
                                });
                                // Select the conversation and close the dialog
                                onSelectConversation(convId);
                                setOpenNewDialog(false);
                                setSearch("");
                              } catch (e: any) {
                                toast.error(e?.message || "Failed to start conversation");
                              }
                            }}
                          >
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={u.image} />
                              <AvatarFallback className="bg-muted text-xs">
                                {u.name?.charAt(0) || "U"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{u.name || "Anonymous"}</p>
                              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="text-sm text-muted-foreground px-1">No results</div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground px-1">
                      Type at least 2 characters to search
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search" className="pl-9 rounded-full" />
        </div>
        {/* New: Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
            <TabsTrigger value="groups">Groups</TabsTrigger>
            <TabsTrigger value="communities">Communities</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto">
        {filtered && filtered.length > 0 ? (
          <div className="space-y-1 p-2">
            {filtered.map((conversation: any) => {
              const isSelected = selectedConversationId === conversation._id;
              const otherUser = conversation.otherParticipants[0];
              const displayName = conversation.isGroup 
                ? conversation.groupName 
                : otherUser?.name || "Unknown User";
              const displayImage = conversation.isGroup 
                ? conversation.groupImage 
                : otherUser?.image;

              const last = conversation.lastMessage;
              const currentUserId = user?._id;
              const hasUserReadLast =
                !!last &&
                Array.isArray(last.readBy) &&
                last.readBy.some((rb: { userId: any }) => rb.userId === currentUserId);
              const sentByMe = last?.senderId === currentUserId;
              const isUnread = !!last && !sentByMe && !hasUserReadLast;

              const lastPreviewPrefix = sentByMe ? "You: " : "";

              return (
                <motion.div
                  key={conversation._id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    variant="ghost"
                    className={`w-full h-auto p-3 justify-start rounded-xl transition-colors ${
                      isSelected ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/60"
                    }`}
                    onClick={() => onSelectConversation(conversation._id)}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!conversation.isGroup && otherUser?._id) {
                              navigate(`/profile?id=${otherUser._id}`);
                            }
                          }}
                          className="shrink-0"
                          aria-label="View profile"
                        >
                          <Avatar>
                            <AvatarImage src={displayImage} />
                            <AvatarFallback className="bg-primary text-primary-foreground">
                              {displayName?.charAt(0) || "U"}
                            </AvatarFallback>
                          </Avatar>
                        </button>
                        {!conversation.isGroup && otherUser?.isOnline && (
                          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-background rounded-full"></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p
                          className="font-medium truncate cursor-pointer hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!conversation.isGroup && otherUser?._id) {
                              navigate(`/profile?id=${otherUser._id}`);
                            }
                          }}
                        >
                          {displayName}
                        </p>
                        {last && (
                          <div className="flex items-center gap-1">
                            <p
                              className={`text-sm truncate ${
                                isUnread ? "font-semibold text-foreground" : "text-muted-foreground"
                              }`}
                            >
                              {lastPreviewPrefix}
                              {last.content}
                            </p>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              · {formatDistanceToNow(new Date(last._creationTime), { addSuffix: true })}
                            </span>
                          </div>
                        )}
                      </div>
                      {isUnread && <span className="w-2 h-2 rounded-full bg-blue-600" />}
                    </div>
                  </Button>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <h3 className="font-semibold mb-2">No conversations</h3>
              <p className="text-sm">Try another tab or start a new conversation</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}