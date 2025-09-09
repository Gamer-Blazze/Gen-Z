import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Id } from "@/convex/_generated/dataModel";

interface ConversationsListProps {
  selectedConversationId: Id<"conversations"> | null;
  onSelectConversation: (id: Id<"conversations">) => void;
}

export function ConversationsList({ selectedConversationId, onSelectConversation }: ConversationsListProps) {
  const conversations = useQuery(api.messages.getUserConversations, {});

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Messages</h2>
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            New
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search conversations..." className="pl-9" />
        </div>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto">
        {conversations && conversations.length > 0 ? (
          <div className="space-y-1 p-2">
            {conversations.map((conversation) => {
              const isSelected = selectedConversationId === conversation._id;
              const otherUser = conversation.otherParticipants[0];
              const displayName = conversation.isGroup 
                ? conversation.groupName 
                : otherUser?.name || "Unknown User";
              const displayImage = conversation.isGroup 
                ? conversation.groupImage 
                : otherUser?.image;

              return (
                <motion.div
                  key={conversation._id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    variant={isSelected ? "secondary" : "ghost"}
                    className="w-full h-auto p-3 justify-start"
                    onClick={() => onSelectConversation(conversation._id)}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="relative">
                        <Avatar>
                          <AvatarImage src={displayImage} />
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {displayName?.charAt(0) || "U"}
                          </AvatarFallback>
                        </Avatar>
                        {!conversation.isGroup && (
                          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-background rounded-full"></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="font-medium truncate">{displayName}</p>
                        {conversation.lastMessage && (
                          <div className="flex items-center gap-1">
                            <p className="text-sm text-muted-foreground truncate">
                              {conversation.lastMessage.sender?.name === conversation.lastMessage.sender?.name ? "You: " : ""}
                              {conversation.lastMessage.content}
                            </p>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              · {formatDistanceToNow(new Date(conversation.lastMessage._creationTime), { addSuffix: true })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Button>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <h3 className="font-semibold mb-2">No conversations yet</h3>
              <p className="text-sm">Start a new conversation to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}