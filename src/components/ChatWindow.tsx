import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Phone, Video, MoreVertical } from "lucide-react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";

interface ChatWindowProps {
  conversationId: Id<"conversations">;
}

export function ChatWindow({ conversationId }: ChatWindowProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = useQuery(api.messages.getConversationMessages, { conversationId });
  const sendMessage = useMutation(api.messages.sendMessage);
  const markAsRead = useMutation(api.messages.markMessagesAsRead);

  // Get conversation details
  const conversations = useQuery(api.messages.getUserConversations, {});
  const conversation = conversations?.find(c => c._id === conversationId);
  const otherUser = conversation?.otherParticipants[0];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    // Mark messages as read when conversation is opened
    markAsRead({ conversationId });
  }, [conversationId, markAsRead]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    try {
      await sendMessage({
        conversationId,
        content: message.trim(),
        messageType: "text",
      });
      setMessage("");
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!conversation) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const displayName = conversation.isGroup 
    ? conversation.groupName 
    : otherUser?.name || "Unknown User";
  const displayImage = conversation.isGroup 
    ? conversation.groupImage 
    : otherUser?.image;

  return (
    <div className="h-full flex flex-col">
      {/* Chat Header */}
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
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
            <div>
              <h3 className="font-semibold">{displayName}</h3>
              {!conversation.isGroup && (
                <p className="text-sm text-muted-foreground">Active now</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              <Phone className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Video className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages && messages.length > 0 ? (
          messages.map((msg, index) => {
            const isOwn = msg.senderId === user?._id;
            const showAvatar = index === 0 || messages[index - 1].senderId !== msg.senderId;
            
            return (
              <motion.div
                key={msg._id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className={`flex gap-2 ${isOwn ? "flex-row-reverse" : ""}`}
              >
                <div className="w-8">
                  {showAvatar && !isOwn && (
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={msg.sender?.image} />
                      <AvatarFallback className="bg-muted text-xs">
                        {msg.sender?.name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
                <div className={`flex flex-col max-w-xs ${isOwn ? "items-end" : ""}`}>
                  <div
                    className={`px-3 py-2 rounded-2xl ${
                      isOwn
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm">{msg.content}</p>
                  </div>
                  <span className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(msg._creationTime), { addSuffix: true })}
                  </span>
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <h3 className="font-semibold mb-2">Start the conversation</h3>
              <p className="text-sm">Send a message to get started</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-border bg-card">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            placeholder="Type a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="flex-1"
            maxLength={500}
          />
          <Button
            type="submit"
            disabled={!message.trim() || isSubmitting}
            className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}