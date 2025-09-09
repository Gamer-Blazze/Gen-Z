import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
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
import { Paperclip } from "lucide-react";
import { useNavigate } from "react-router";
import CallDialog from "./CallDialog";

interface ChatWindowProps {
  conversationId: Id<"conversations">;
}

export function ChatWindow({ conversationId }: ChatWindowProps) {
  const startCall = useMutation(api.calls.startCall);
  const activeCall = useQuery(api.calls.getActiveCallForUser, { conversationId });
  const { user } = useAuth();

  const [callOpen, setCallOpen] = useState(false);
  const [callId, setCallId] = useState<Id<"calls"> | null>(null);
  const [callType, setCallType] = useState<"voice" | "video">("voice");
  const [callRole, setCallRole] = useState<"caller" | "callee">("caller");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // When there's an incoming ringing call for me, prompt to accept
  useEffect(() => {
    if (!activeCall || !user) return;
    const isIncoming = activeCall.status === "ringing" && activeCall.calleeId === user._id;
    const isAcceptedOngoing = activeCall.status === "accepted";
    if ((isIncoming || isAcceptedOngoing) && !callOpen) {
      setCallId(activeCall._id as Id<"calls">);
      setCallType(activeCall.type);
      setCallRole(isIncoming ? "callee" : activeCall.callerId === user._id ? "caller" : "callee");
      setCallOpen(true);
    }
  }, [activeCall, user, callOpen]);

  const placeCall = async (type: "voice" | "video") => {
    if (!conversation) return;
    try {
      const id = await startCall({ conversationId, type });
      setCallId(id);
      setCallType(type);
      setCallRole("caller");
      setCallOpen(true);
    } catch (e: any) {
      toast.error(e?.message || "Failed to start call");
    }
  };

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

  const generateUploadUrl = useAction(api.files.generateUploadUrl);
  const getFileUrl = useAction(api.files.getFileUrl);
  const navigate = useNavigate();

  const onPickFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsUploading(true);
    try {
      const files = Array.from(fileList);

      for (const file of files) {
        // 1) Get signed upload URL
        const uploadUrl = await generateUploadUrl({});

        // 2) Upload bytes
        const buf = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = reject;
          reader.readAsArrayBuffer(file);
        });

        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: buf,
        });
        if (!res.ok) throw new Error("Upload failed");
        const { storageId } = await res.json();

        // 3) Resolve a signed URL for the uploaded file
        const signedUrl = await getFileUrl({ fileId: storageId });

        // 4) Send message depending on type
        if (file.type.startsWith("image/")) {
          await sendMessage({
            conversationId,
            content: "", // no text when sending just media
            messageType: "image",
            imageUrl: signedUrl,
          });
        } else {
          await sendMessage({
            conversationId,
            content: "",
            messageType: "file",
            fileUrl: signedUrl,
            fileName: file.name,
          });
        }
      }
    } catch (err) {
      toast.error("Failed to upload and send files");
      console.error(err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => onPickFiles(e.target.files)}
      />

      {/* Chat Header */}
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => {
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
              {!conversation.isGroup && (
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-background rounded-full"></div>
              )}
            </div>
            <div>
              <h3
                className={`font-semibold ${!conversation.isGroup && otherUser?._id ? "cursor-pointer hover:underline" : ""}`}
                onClick={() => {
                  if (!conversation.isGroup && otherUser?._id) {
                    navigate(`/profile?id=${otherUser._id}`);
                  }
                }}
              >
                {displayName}
              </h3>
              {!conversation.isGroup && (
                <p className="text-sm text-muted-foreground">Active now</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => placeCall("voice")}>
              <Phone className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => placeCall("video")}>
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
                  {msg.messageType === "image" && msg.imageUrl ? (
                    <div className={`${isOwn ? "" : ""}`}>
                      <img
                        src={msg.imageUrl}
                        alt={msg.fileName || "image"}
                        className="max-w-xs rounded-2xl border"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  ) : msg.messageType === "file" && msg.fileUrl ? (
                    <div className="w-full">
                      {/* Try to show video if browser can play it */}
                      <video
                        src={msg.fileUrl}
                        className="max-w-xs rounded-2xl border"
                        controls
                        preload="metadata"
                        playsInline
                      />
                      {msg.fileName && (
                        <div className="text-xs text-muted-foreground mt-1 truncate max-w-xs">
                          {msg.fileName}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className={`px-3 py-2 rounded-2xl ${
                        isOwn ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    </div>
                  )}
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
        <form onSubmit={handleSendMessage} className="flex gap-2 items-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="h-10 w-10 p-0 rounded-full"
            title="Attach photo/video"
          >
            {isUploading ? (
              <div className="w-4 h-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <Paperclip className="w-4 h-4" />
            )}
          </Button>
          <Input
            placeholder="Message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="flex-1 rounded-full bg-muted border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <Button
            type="submit"
            disabled={!message.trim() || isSubmitting}
            className="h-10 w-10 p-0 rounded-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
            aria-label="Send"
            title="Send"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
      </div>

      {callOpen && callId && (
        <CallDialog
          callId={callId}
          conversationId={conversationId}
          type={callType}
          role={callRole}
          open={callOpen}
          onOpenChange={(v) => setCallOpen(v)}
        />
      )}
    </div>
  );
}