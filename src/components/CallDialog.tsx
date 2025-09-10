import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

type CallType = "voice" | "video";
type Role = "caller" | "callee";

interface CallDialogProps {
  callId: Id<"calls">;
  conversationId: Id<"conversations">;
  type: CallType;
  role: Role;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function CallDialog({
  callId,
  conversationId,
  type,
  role,
  open,
  onOpenChange,
}: CallDialogProps) {
  const { user } = useAuth();
  const sendSignal = useMutation(api.calls.sendSignal);
  const endCall = useMutation(api.calls.endCall);
  const acceptCall = useMutation(api.calls.acceptCall);
  const activeCall = useQuery(api.calls.getActiveCallForUser, { conversationId });
  const signals = useQuery(api.calls.getSignalsForUser, { callId });

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [isAccepted, setIsAccepted] = useState(role === "caller"); // caller proceeds immediately

  // Add: track processed signals and prevent duplicate accept/answer
  const processedSignalIdsRef = useRef<Set<string>>(new Set());
  const acceptSentRef = useRef<boolean>(false);
  // NEW: ensure we only ever create/send one answer
  const answeredOnceRef = useRef<boolean>(false);

  const safeIceServers = useMemo<RTCConfiguration>(
    () => ({
      iceServers: [
        // Twilio STUN (valid format, no query params)
        { urls: "stun:global.stun.twilio.com:3478" },
        // Google STUN backups
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
      ],
    }),
    []
  );

  // Setup peer connection
  useEffect(() => {
    if (!open) return;

    let pc: RTCPeerConnection | null = null;
    try {
      // First try with our strictly-allowed Google STUN list
      pc = new RTCPeerConnection(safeIceServers);
    } catch (err: any) {
      // If any invalid URL slipped in or the environment rejects it, retry with empty config
      try {
        pc = new RTCPeerConnection({});
        toast.message("Using fallback WebRTC configuration (no STUN). Connectivity may be limited.");
      } catch {
        toast.error("Failed to initialize call. Please refresh and try again.");
        onOpenChange(false);
        return;
      }
    }

    pcRef.current = pc;

    pc.ontrack = (e) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    };

    pc.onicecandidate = async (ev) => {
      if (ev.candidate && activeCall && user) {
        const toUserId =
          user._id === activeCall.callerId ? activeCall.calleeId : activeCall.callerId;
        try {
          await sendSignal({
            callId,
            toUserId,
            signalType: "candidate",
            payload: JSON.stringify(ev.candidate),
          });
        } catch {
          // ignore transient errors
        }
      }
    };

    (async () => {
      try {
        const constraints: MediaStreamConstraints =
          type === "video"
            ? { audio: true, video: { width: { ideal: 1280 }, height: { ideal: 720 } } }
            : { audio: true, video: false };

        const local = await navigator.mediaDevices.getUserMedia(constraints);
        localStreamRef.current = local;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = local;
        }

        local.getTracks().forEach((t) => pc!.addTrack(t, local));

        if (role === "caller" && activeCall && user) {
          const offer = await pc!.createOffer();
          await pc!.setLocalDescription(offer);
          const toUserId = activeCall.calleeId;
          await sendSignal({
            callId,
            toUserId,
            signalType: "offer",
            payload: JSON.stringify(offer),
          });
        }
      } catch (err: any) {
        toast.error(err?.message || "Failed to access media devices");
        onOpenChange(false);
      }
    })();

    return () => {
      pc!.getSenders().forEach((s) => s.track?.stop());
      pc!.close();
      pcRef.current = null;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    };
  }, [open, safeIceServers, activeCall, user, sendSignal, callId, type, role, onOpenChange]);

  // Process incoming signals
  useEffect(() => {
    (async () => {
      const pc = pcRef.current;
      if (!pc || !signals || !activeCall || !user) return;

      // Process oldest-first to preserve ordering
      const ordered = [...signals].reverse();
      for (const s of ordered) {
        const sid = String(s._id);
        if (processedSignalIdsRef.current.has(sid)) continue;

        try {
          if (s.signalType === "offer" && role === "callee") {
            const offer = JSON.parse(s.payload);

            // 1) Ensure remote description is set first
            if (!pc.currentRemoteDescription) {
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(offer));
              } catch {
                // Defer retry on next signal tick
                continue;
              }
            }

            // 2) Ensure server state is accepted before creating the answer (debounced once)
            if (!acceptSentRef.current) {
              acceptSentRef.current = true;
              try {
                const res = await acceptCall({ callId });
                if (!res || !("success" in res) || !res.success) {
                  // Server did not accept; don't continue to createAnswer
                  acceptSentRef.current = true; // keep debounced, but stop flow
                  continue;
                }
                setIsAccepted(true);
              } catch {
                // If server accept fails, do not proceed to create an answer
                continue;
              }
            }

            // 3) Create one answer only when we're exactly in have-remote-offer
            if (!answeredOnceRef.current && pc.signalingState === "have-remote-offer") {
              try {
                answeredOnceRef.current = true;
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await sendSignal({
                  callId,
                  toUserId: activeCall.callerId,
                  signalType: "answer",
                  payload: JSON.stringify(answer),
                });
              } catch {
                // Allow retry on next processing tick only if we failed before setting the guard
                answeredOnceRef.current = false;
              }
            }
          } else if (s.signalType === "answer" && role === "caller") {
            const answer = JSON.parse(s.payload);
            const canApplyAnswer =
              pc.signalingState === "have-local-offer" &&
              !!pc.localDescription &&
              !pc.currentRemoteDescription;

            if (canApplyAnswer) {
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
              } catch {
                // Ignore transient/wrong-state errors; duplicates or late answers can safely be skipped
              }
            } else {
              // Skip duplicate/late answers (already stable or remote already set)
            }
          } else if (s.signalType === "candidate") {
            const candidate = JSON.parse(s.payload);
            if (pc.localDescription || pc.remoteDescription) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } catch {
                // ignore bad candidates
              }
            }
          } else if (s.signalType === "end") {
            onOpenChange(false);
            toast.message("Call ended");
          }
        } finally {
          processedSignalIdsRef.current.add(sid);
        }
      }
    })();
  }, [signals, role, callId, sendSignal, acceptCall, onOpenChange, activeCall, user]);

  const handleEnd = async () => {
    try {
      await endCall({ callId });
    } catch {
      // ignore
    } finally {
      onOpenChange(false);
    }
  };

  const isVideo = type === "video";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Make the dialog full-screen for a Messenger-like experience */}
      <DialogContent className="sm:max-w-none w-screen h-screen max-h-screen p-0 rounded-none">
        <div className="flex flex-col h-full">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-background/90 backdrop-blur">
            <div className="font-semibold">
              {isVideo ? "Video Call" : "Voice Call"} {isAccepted ? "" : "(Connecting...)"}
            </div>
            <Button variant="destructive" onClick={handleEnd}>
              End
            </Button>
          </div>

          {/* Main content area */}
          <div className={`flex-1 p-4 ${isVideo ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "grid grid-cols-1"}`}>
            <div className="relative w-full h-full rounded-xl overflow-hidden bg-black">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {!isVideo && (
                <div className="absolute inset-0 flex items-center justify-center text-white/70">
                  Your microphone is live
                </div>
              )}
            </div>

            {isVideo ? (
              <div className="relative w-full h-full rounded-xl overflow-hidden bg-black">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="relative w-full h-full rounded-xl overflow-hidden bg-muted flex items-center justify-center">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="hidden"
                />
                <div className="text-sm text-muted-foreground">Connected</div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}