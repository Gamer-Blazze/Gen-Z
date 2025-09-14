import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Paperclip, Image as ImageIcon, Video, File, Check, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import ProgressiveImage from "./ProgressiveImage";
import ProgressiveVideo from "./ProgressiveVideo";
import { onUserInteractionUnlock } from "@/lib/autoplaySound";
import { cacheMessages, getCachedMessages } from "@/lib/idb";

interface ChatWindowProps {
  conversationId: Id<"conversations"> | null;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export default function ChatWindow({ conversationId }: ChatWindowProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const conversations = useQuery(api.messages.getUserConversations, {});
  const conversation = conversations?.find((c: any) => c._id === conversationId) || null;

  const messagesQuery = useQuery(
    api.messages.getMessages,
    conversationId ? { 
      conversationId, 
      paginationOpts: { numItems: 50, cursor: null } 
    } : "skip"
  );

  const typingUsers = useQuery(
    api.messages.getTyping,
    conversationId ? { conversationId } : "skip"
  );

  const sendMessageMutation = useMutation(api.messages.sendMessage);
  const markSeenMutation = useMutation(api.messages.markSeen);
  const setTypingMutation = useMutation(api.messages.setTyping);
  const generateUploadUrl = useAction(api.files.generateUploadUrl);

  // Cache messages for offline viewing
  useEffect(() => {
    if (messagesQuery?.page && conversationId) {
      cacheMessages(conversationId, messagesQuery.page);
    }
  }, [messagesQuery?.page, conversationId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messagesQuery?.page]);

  // Mark messages as seen when conversation is active
  useEffect(() => {
    if (conversationId && messagesQuery?.page?.length) {
      markSeenMutation({ conversationId });
    }
  }, [conversationId, messagesQuery?.page?.length, markSeenMutation]);

  // Sound notification for new messages
  useEffect(() => {
    if (messagesQuery?.page?.length && conversationId) {
      const latestMessage = messagesQuery.page[0];
      if (latestMessage?.senderId !== user?._id && document.hidden) {
        onUserInteractionUnlock(() => {
          try {
            new Audio("/notification.mp3").play().catch(() => {});
          } catch {}
        });
      }
    }
  }, [messagesQuery?.page, user?._id, conversationId]);

  // Typing indicator logic
  const handleTyping = useCallback(() => {
    if (!conversationId) return;
    
    const now = Date.now();
    if (now - lastTypingRef.current > 2000) { // Throttle to every 2 seconds
      setTypingMutation({ conversationId, isTyping: true });
      lastTypingRef.current = now;
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      setTypingMutation({ conversationId, isTyping: false });
    }, 3000);
  }, [conversationId, setTypingMutation]);

  const handleSendMessage = async () => {
    if (!conversationId || (!message.trim() && !uploading)) return;

    const content = message.trim();
    setMessage("");
    
    // Stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setTypingMutation({ conversationId, isTyping: false });

    try {
      await sendMessageMutation({
        conversationId,
        content,
        type: "text",
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to send message");
      setMessage(content); // Restore message on error
    }
  };

  const handleFileUpload = async (files: FileList) => {
    if (!conversationId || files.length === 0) return;

    const validFiles = Array.from(files).filter(file => {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} is too large (max 25MB)`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setUploading(true);
    const uploadedFiles: { type: "image" | "video" | "file"; storageId: string }[] = [];

    try {
      for (const file of validFiles) {
        const uploadUrl = await generateUploadUrl();
        
        // Upload with progress tracking
        const xhr = new XMLHttpRequest();
        const uploadPromise = new Promise<string>((resolve, reject) => {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const progress = (e.loaded / e.total) * 100;
              setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
            }
          };

          xhr.onload = () => {
            if (xhr.status === 200) {
              const result = JSON.parse(xhr.responseText);
              resolve(result.storageId);
            } else {
              reject(new Error(`Upload failed: ${xhr.statusText}`));
            }
          };

          xhr.onerror = () => reject(new Error("Upload failed"));
        });

        xhr.open("POST", uploadUrl);
        xhr.send(file);

        const storageId = await uploadPromise;
        
        // Determine file type
        let fileType: "image" | "video" | "file" = "file";
        if (file.type.startsWith("image/")) fileType = "image";
        else if (file.type.startsWith("video/")) fileType = "video";

        uploadedFiles.push({ type: fileType, storageId });

        // Store file metadata
        await fetch("/api/files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storageId,
            name: file.name,
            type: file.type,
            size: file.size,
          }),
        });
      }

      // Group by type
      const images = uploadedFiles.filter(f => f.type === "image").map(f => f.storageId);
      const videos = uploadedFiles.filter(f => f.type === "video").map(f => f.storageId);
      const files = uploadedFiles.filter(f => f.type === "file").map(f => f.storageId);

      // Send message with media
      await sendMessageMutation({
        conversationId,
        type: images.length > 0 ? "image" : videos.length > 0 ? "video" : "file",
        images: images.length > 0 ? images : undefined,
        videos: videos.length > 0 ? videos : undefined,
        files: files.length > 0 ? files : undefined,
      });

      toast.success("Media sent successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to upload media");
    } finally {
      setUploading(false);
      setUploadProgress({});
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!conversationId) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Select a conversation</h3>
          <p className="text-sm">Choose a chat to start messaging</p>
        </div>
      </div>
    );
  }

  const otherUser = !conversation?.isGroup ? conversation?.otherParticipants?.[0] : null;
  const displayName = conversation?.isGroup ? conversation?.groupName : otherUser?.name || "Unknown";
  const isOnline = !conversation?.isGroup && otherUser?.isOnline;

  return (
    <div className="h-full flex flex-col">
      {/* Chat Header */}
      <div className="p-4 border-b flex items-center gap-3">
        <Avatar>
          <AvatarImage src={conversation?.isGroup ? conversation?.groupImage : otherUser?.image} />
          <AvatarFallback className="bg-muted">
            {displayName?.charAt(0) || "U"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h3 className="font-semibold">{displayName}</h3>
          {!conversation?.isGroup && (
            <p className="text-xs text-muted-foreground">
              {isOnline ? (
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Active now
                </span>
              ) : otherUser?.lastSeenAt ? (
                `Last seen ${formatDistanceToNow(new Date(otherUser.lastSeenAt), { addSuffix: true })}`
              ) : (
                "Offline"
              )}
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messagesQuery?.page?.map((msg: any) => {
            const isMe = msg.senderId === user?._id;
            const sender = isMe ? user : (conversation?.otherParticipants?.find((p: any) => p._id === msg.senderId) || { name: "Unknown" });
            
            // Check if message is seen by all other participants
            const otherParticipantIds = conversation?.participants?.filter((id: string) => id !== user?._id) || [];
            const allSeen = otherParticipantIds.every((id: string) => msg.seenBy?.[id]);

            return (
              <motion.div
                key={msg._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[70%] ${isMe ? "order-2" : "order-1"}`}>
                  {!isMe && conversation?.isGroup && (
                    <p className="text-xs text-muted-foreground mb-1 px-3">
                      {sender?.name || "Unknown"}
                    </p>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-2 ${
                      isMe
                        ? "bg-primary text-primary-foreground ml-auto"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {/* Text content */}
                    {msg.content && (
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    )}

                    {/* Images */}
                    {msg.imageUrls?.map((url: string, idx: number) => (
                      <div key={idx} className="mt-2 rounded-lg overflow-hidden">
                        <ProgressiveImage
                          src={url}
                          alt="Shared image"
                          className="max-w-full h-auto rounded-lg"
                        />
                      </div>
                    ))}

                    {/* Videos */}
                    {msg.videoUrls?.map((url: string, idx: number) => (
                      <div key={idx} className="mt-2 rounded-lg overflow-hidden">
                        <ProgressiveVideo
                          src={url}
                          className="max-w-full h-auto rounded-lg"
                          mode="preview"
                        />
                      </div>
                    ))}

                    {/* Files */}
                    {msg.fileUrls?.map((file: any, idx: number) => (
                      <div key={idx} className="mt-2 flex items-center gap-2 p-2 bg-background/10 rounded-lg">
                        <File className="w-4 h-4" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          {file.size && (
                            <p className="text-xs opacity-70">
                              {(file.size / 1024 / 1024).toFixed(1)} MB
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(file.url, "_blank")}
                        >
                          Download
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className={`flex items-center gap-1 mt-1 text-xs text-muted-foreground ${isMe ? "justify-end" : "justify-start"}`}>
                    <span>
                      {formatDistanceToNow(new Date(msg._creationTime), { addSuffix: true })}
                    </span>
                    {isMe && (
                      <span className="ml-1">
                        {allSeen ? (
                          <CheckCheck className="w-3 h-3 text-blue-500" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* Typing indicator */}
          <AnimatePresence>
            {typingUsers && typingUsers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex justify-start"
              >
                <div className="bg-muted text-foreground rounded-2xl px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-sm">
                      {typingUsers.map((u: any) => u.name).join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* Upload Progress */}
      {Object.keys(uploadProgress).length > 0 && (
        <div className="px-4 py-2 border-t bg-muted/50">
          {Object.entries(uploadProgress).map(([filename, progress]) => (
            <div key={filename} className="flex items-center gap-2 text-sm">
              <span className="truncate flex-1">{filename}</span>
              <span>{Math.round(progress)}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Message Composer */}
      <div className="p-4 border-t">
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,*/*"
            className="hidden"
            onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
          />
          
          <Button
            size="sm"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Paperclip className="w-4 h-4" />
          </Button>

          <div className="flex-1">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                if (e.target.value.trim()) {
                  handleTyping();
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="min-h-[40px] max-h-32 resize-none"
              disabled={uploading}
            />
          </div>

          <Button
            onClick={handleSendMessage}
            disabled={!message.trim() || uploading}
            size="sm"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}