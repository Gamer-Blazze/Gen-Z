import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Phone, Video, MoreVertical, Info, Smile, Images } from "lucide-react";
import { Check, CheckCheck } from "lucide-react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { Paperclip } from "lucide-react";
import { useNavigate } from "react-router";
import CallDialog from "./CallDialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mic, Square } from "lucide-react";

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
  const [incomingOpen, setIncomingOpen] = useState(false);
  const [message, setMessage] = useState("");
  // Add: submission state for sending messages
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const [atBottom, setAtBottom] = useState(true);

  const endCall = useMutation(api.calls.endCall);

  // When there's an incoming ringing call for me, show Accept/Reject prompt; auto-open only if already accepted
  useEffect(() => {
    if (!activeCall || !user) return;
    const isIncoming = activeCall.status === "ringing" && activeCall.calleeId === user._id;
    const isAcceptedOngoing = activeCall.status === "accepted";

    if (isIncoming) {
      // Show incoming prompt instead of auto-opening
      setIncomingOpen(true);
    } else if (isAcceptedOngoing && !callOpen) {
      setCallId(activeCall._id as Id<"calls">);
      setCallType(activeCall.type);
      setCallRole(activeCall.callerId === user._id ? "caller" : "callee");
      setCallOpen(true);
      setIncomingOpen(false);
    }
  }, [activeCall, user, callOpen]);

  // Close incoming prompt if call ends or disappears
  useEffect(() => {
    if (!activeCall || activeCall.status === "ended") {
      setIncomingOpen(false);
    }
  }, [activeCall]);

  // Add: handle scroll state based on container scroll
  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const threshold = 32; // px tolerance
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
    setAtBottom(isNearBottom);
  };

  // Add: helpers to jump
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

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

  // Add: toggle to respect read receipts privacy (disabled if explicitly false)
  const readReceiptsEnabled = user?.settings?.privacy?.readReceipts !== false;

  // NEW: query last-seen/active with privacy applied
  // const lastSeenInfo = useQuery(
  //   api.users.getLastSeen,
  //   otherUser?._id ? { userId: otherUser._id } : "skip"
  // );

  useEffect(() => {
    if (atBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, atBottom]);

  useEffect(() => {
    // Respect privacy: only send read receipts when enabled
    if (readReceiptsEnabled) {
      markAsRead({ conversationId });
    }
  }, [conversationId, markAsRead, readReceiptsEnabled]);

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

  const startRecording = async () => {
    try {
      // Request mic
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Prefer webm/opus; browser picks best available
      const mimeType =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      mr.onstop = async () => {
        try {
          const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || "audio/webm" });
          if (blob.size === 0) {
            setIsRecording(false);
            return;
          }
          // Determine duration by decoding
          const audio = document.createElement("audio");
          const url = URL.createObjectURL(blob);
          const getDuration = () =>
            new Promise<number>((resolve) => {
              audio.onloadedmetadata = () => {
                resolve(isFinite(audio.duration) ? audio.duration : 0);
                URL.revokeObjectURL(url);
              };
              audio.src = url;
            });
          const duration = await getDuration();

          // Upload blob
          setIsUploading(true);
          const uploadUrl = await generateUploadUrl({});
          const buf = await blob.arrayBuffer();
          const res = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": blob.type || "application/octet-stream" },
            body: buf,
          });
          if (!res.ok) throw new Error("Upload failed");
          const { storageId } = await res.json();
          const signedUrl = await getFileUrl({ fileId: storageId });

          // Send audio message
          await sendMessage({
            conversationId,
            content: "",
            messageType: "audio",
            audioUrl: signedUrl,
            audioDuration: Math.round(duration || 0),
          });
        } catch (err) {
          toast.error("Failed to send voice message");
          console.error(err);
        } finally {
          setIsUploading(false);
          setIsRecording(false);
        }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setIsRecording(true);
    } catch (err) {
      toast.error("Microphone permission denied");
      console.error(err);
    }
  };

  const stopRecording = () => {
    try {
      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== "inactive") {
        mr.stop();
      }
      // Stop tracks
      mr?.stream.getTracks().forEach((t) => t.stop());
    } catch (e) {
      // ignore
    }
  };

  const onAudioPlay = async () => {
    try {
      // reinforce seen when the receiver plays audio
      await markAsRead({ conversationId });
    } catch {}
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

  // Simplified: derive header subtext directly from otherUser fields
  const headerSubtext = !conversation?.isGroup
    ? (() => {
        if (!otherUser) return "";
        if (otherUser.isOnline) return "Active now";
        if (otherUser.lastSeen) {
          return `Last seen ${formatDistanceToNow(new Date(otherUser.lastSeen), { addSuffix: true })}`;
        }
        return "";
      })()
    : "";

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
      {/* Keep header visible while scrolling messages on mobile */}
      <div className="p-4 border-b border-border bg-card/90 sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-card/60">
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
              {!conversation.isGroup && otherUser?.isOnline && (
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
                <p className="text-sm text-muted-foreground">
                  {headerSubtext}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Moved call buttons to header */}
            <Button variant="ghost" size="sm" title="Voice call" onClick={() => placeCall("voice")}>
              <Phone className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" title="Video call" onClick={() => placeCall("video")}>
              <Video className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" title="Chat info">
              <Info className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="relative flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain pb-2"
      >
        {messages && messages.length > 0 ? (
          messages.map((msg, index) => {
            const isOwn = msg.senderId === user?._id;
            const showAvatar = index === 0 || messages[index - 1].senderId !== msg.senderId;
            
            // Compute seen status for 1:1 and group
            const otherParticipantIds: Array<string> =
              Array.isArray(conversation?.participants)
                ? (conversation!.participants as any[])
                    .map((p: any) => p._id || p)
                    .filter((pid: string) => pid !== user?._id)
                : (conversation?.otherParticipants?.map((p: any) => p._id) || []);
            const readByUserIds: Array<string> = (msg.readBy || []).map((r: any) => r.userId);
            const seenByOthers = otherParticipantIds.filter((pid) => readByUserIds.includes(pid));

            // For 1:1: seen if the single counterpart has read
            const isSeen = seenByOthers.length > 0;

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
                      <video
                        src={msg.fileUrl}
                        className="max-w-xs rounded-2xl border"
                        controls
                        preload="metadata"
                        playsInline
                      />
                      {msg.fileName && (
                        <div className="text-xs text-muted-foreground mt-1 truncate max-w-xs">{msg.fileName}</div>
                      )}
                    </div>
                  ) : msg.messageType === "audio" && msg.audioUrl ? (
                    // Messenger-like voice message bubble
                    <div className="group max-w-[280px]">
                      <div
                        className={`flex items-center gap-3 px-3 py-2 rounded-2xl shadow-sm border ${
                          isOwn
                            ? "bg-primary text-primary-foreground border-primary/20"
                            : "bg-muted text-foreground border-muted/50"
                        }`}
                      >
                        {/* Circular mic badge to the left, similar to Messenger */}
                        <div
                          className={`size-8 rounded-full flex items-center justify-center ${
                            isOwn ? "bg-white/20 text-primary-foreground" : "bg-background text-muted-foreground"
                          }`}
                          title="Voice message"
                        >
                          <Mic className="w-4 h-4" />
                        </div>

                        {/* Inline player kept simple and compact */}
                        <audio
                          src={msg.audioUrl}
                          controls
                          preload="metadata"
                          onPlay={onAudioPlay}
                          className="w-40"
                        />
                      </div>
                      {typeof msg.audioDuration === "number" && msg.audioDuration > 0 && (
                        <div className={`mt-1 text-[11px] ${isOwn ? "text-primary/80 text-right" : "text-muted-foreground text-left"}`}>
                          {Math.floor(msg.audioDuration / 60)}:{(msg.audioDuration % 60).toString().padStart(2, "0")}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className={`px-4 py-2 rounded-2xl shadow-sm ${
                        isOwn ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    </div>
                  )}

                  {/* NEW: read indicator line (respects read receipts privacy) */}
                  {isOwn && (
                    <div className="flex items-center gap-1 mt-1">
                      {/* 1:1 — show checks; Group — show up to 3 tiny avatars when seen */}
                      {conversation?.isGroup ? (
                        readReceiptsEnabled && seenByOthers.length > 0 ? (
                          <div className="flex -space-x-1">
                            {conversation.otherParticipants
                              .filter((p: any) => seenByOthers.includes(p._id))
                              .slice(0, 3)
                              .map((p: any) => (
                                <Avatar key={p._id} className="w-4 h-4 ring-1 ring-background">
                                  <AvatarImage src={p.image} />
                                  <AvatarFallback className="text-[9px] bg-muted">
                                    {p.name?.charAt(0) || "U"}
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                          </div>
                        ) : (
                          <Check className="w-3 h-3 text-muted-foreground" />
                        )
                      ) : readReceiptsEnabled && isSeen ? (
                        <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </div>
                  )}

                  <span className="text-[10px] text-muted-foreground mt-1">
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
      {/* Respect safe-area inset on mobile devices */}
      <div className="p-4 pb-[env(safe-area-inset-bottom)] border-t border-border bg-card shadow-sm">
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
          <Button type="button" variant="ghost" className="h-10 w-10 p-0 rounded-full" title="Emoji">
            <Smile className="w-4 h-4" />
          </Button>
          <Button type="button" variant="ghost" className="h-10 w-10 p-0 rounded-full" title="GIFs">
            <Images className="w-4 h-4" />
          </Button>
          <Input
            placeholder="Message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="flex-1 rounded-full bg-muted border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
          />
          {inputFocused && (
            isRecording ? (
              <Button
                type="button"
                variant="destructive"
                className="h-10 w-10 p-0 rounded-full"
                title="Stop recording"
                onClick={stopRecording}
                disabled={isUploading}
              >
                <Square className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                className="h-10 w-10 p-0 rounded-full"
                title="Record voice message"
                onClick={startRecording}
                disabled={isUploading}
              >
                <Mic className="w-4 h-4" />
              </Button>
            )
          )}
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

      {/* Incoming Call Prompt */}
      {incomingOpen && activeCall && user && activeCall.calleeId === user._id && (
        <Dialog open={incomingOpen} onOpenChange={setIncomingOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Incoming {activeCall.type === "video" ? "Video" : "Voice"} Call</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                You have an incoming {activeCall.type} call. Do you want to accept?
              </p>
            </div>
            <DialogFooter className="flex gap-2 sm:justify-end">
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    await endCall({ callId: activeCall._id as Id<"calls"> });
                  } catch {
                    // ignore
                  } finally {
                    setIncomingOpen(false);
                  }
                }}
              >
                Reject
              </Button>
              <Button
                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
                onClick={() => {
                  setCallId(activeCall._id as Id<"calls">);
                  setCallType(activeCall.type);
                  setCallRole("callee");
                  setIncomingOpen(false);
                  setCallOpen(true); // CallDialog handles the actual accept flow
                }}
              >
                Accept
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

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