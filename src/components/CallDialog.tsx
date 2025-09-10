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

  // Add: reconnection guard to prevent rapid loops
  const reconnectingRef = useRef<boolean>(false);

  // Add: helper to close and cleanup current RTCPeerConnection
  const closePeerConnection = () => {
    const pc = pcRef.current;
    try {
      pc?.getSenders().forEach((s) => s.track?.stop());
      pc?.close();
    } catch {}
    pcRef.current = null;
  };

  // Add: createPeerConnection() with event listeners and safe ICE config
  const createPeerConnection = () => {
    let pc: RTCPeerConnection | null = null;
    try {
      pc = new RTCPeerConnection(safeIceServers);
    } catch (err) {
      try {
        pc = new RTCPeerConnection({});
        toast.message("Using fallback WebRTC configuration (no STUN). Connectivity may be limited.");
      } catch {
        toast.error("Failed to initialize call. Please refresh and try again.");
        onOpenChange(false);
        return null;
      }
    }

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

    // Add: onconnectionstatechange -> log and auto recover
    pc.onconnectionstatechange = async () => {
      const state = pc?.connectionState;
      console.log("PeerConnection state:", state);
      if (!state) return;

      if ((state === "failed" || state === "closed" || state === "disconnected") && !reconnectingRef.current) {
        reconnectingRef.current = true;
        try {
          // Dispose old
          closePeerConnection();

          // Create new
          const newPc = createPeerConnection();
          if (!newPc) return;
          pcRef.current = newPc;

          // Retry adding local tracks
          if (localStreamRef.current) {
            await addLocalTracks(localStreamRef.current);
          }

          // If we are the caller, re-offer to recover
          if (role === "caller" && activeCall && user && newPc.signalingState !== "closed") {
            try {
              const offer = await newPc.createOffer();
              await newPc.setLocalDescription(offer);
              await sendSignal({
                callId,
                toUserId: activeCall.calleeId,
                signalType: "offer",
                payload: JSON.stringify(offer),
              });
            } catch {
              // ignore
            }
          }
        } finally {
          // Slight delay to avoid flapping reconnections
          setTimeout(() => {
            reconnectingRef.current = false;
          }, 1000);
        }
      }
    };

    return pc;
  };

  // Add: addLocalTracks(stream) that ensures PC is open and retries on closed
  const addLocalTracks = async (stream: MediaStream) => {
    let pc = pcRef.current;
    if (!pc || pc.signalingState === "closed") {
      // Auto recreate
      pc = createPeerConnection();
      if (!pc) throw new Error("Failed to create RTCPeerConnection");
      pcRef.current = pc;
    }
    // Only add tracks if not closed
    if (pc.signalingState !== "closed") {
      stream.getTracks().forEach((t) => {
        try {
          pc!.addTrack(t, stream);
        } catch {
          // if addTrack throws (rare), try recreation once
          if (pc!.signalingState === "closed") {
            const fresh = createPeerConnection();
            if (!fresh) return;
            pcRef.current = fresh;
            stream.getTracks().forEach((tt) => {
              try {
                fresh.addTrack(tt, stream);
              } catch {}
            });
          }
        }
      });
    }
  };

  // Add: handleOffer/handleAnswer/handleCandidate helpers
  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    const pc = pcRef.current || createPeerConnection();
    if (!pc) return;
    pcRef.current = pc;

    if (!pc.currentRemoteDescription) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
      } catch {
        // will retry on next tick via signals effect
        return;
      }
    }

    if (!acceptSentRef.current) {
      acceptSentRef.current = true;
      try {
        const res = await acceptCall({ callId });
        if (!res || !("success" in res) || !res.success) return;
        setIsAccepted(true);
      } catch {
        return;
      }
    }

    if (!answeredOnceRef.current && pc.signalingState === "have-remote-offer") {
      try {
        answeredOnceRef.current = true;
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal({
          callId,
          toUserId: activeCall!.callerId,
          signalType: "answer",
          payload: JSON.stringify(answer),
        });
      } catch {
        answeredOnceRef.current = false;
      }
    }
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    const pc = pcRef.current;
    if (!pc) return;

    const canApplyAnswer =
      pc.signalingState === "have-local-offer" &&
      !!pc.localDescription &&
      !pc.currentRemoteDescription;

    if (canApplyAnswer) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch {
        // ignore transient errors
      }
    }
  };

  const handleCandidate = async (candidateInit: RTCIceCandidateInit) => {
    const pc = pcRef.current || createPeerConnection();
    if (!pc) return;
    pcRef.current = pc;

    if (pc.localDescription || pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
      } catch {
        // ignore bad candidates
      }
    }
  };

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

    // Create PC via helper
    const pc = createPeerConnection();
    if (!pc) return;
    pcRef.current = pc;

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

        // Replace: ensure tracks only added when PC is live, with auto-recreate
        await addLocalTracks(local);

        // Update: guard pcRef.current before creating offer to satisfy TS and runtime
        if (role === "caller" && activeCall && user) {
          const pcNow = pcRef.current;
          if (pcNow && pcNow.signalingState !== "closed") {
            const offer = await pcNow.createOffer();
            await pcNow.setLocalDescription(offer);
            const toUserId = activeCall.calleeId;
            await sendSignal({
              callId,
              toUserId,
              signalType: "offer",
              payload: JSON.stringify(offer),
            });
          }
        }
      } catch (err: any) {
        toast.error(err?.message || "Failed to access media devices");
        onOpenChange(false);
      }
    })();

    return () => {
      closePeerConnection();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    };
  }, [open, safeIceServers, activeCall, user, sendSignal, callId, type, role, onOpenChange]);

  // Process incoming signals using helpers
  useEffect(() => {
    (async () => {
      const pc = pcRef.current;
      if (!pc || !signals || !activeCall || !user) return;

      const ordered = [...signals].reverse();
      for (const s of ordered) {
        const sid = String(s._id);
        if (processedSignalIdsRef.current.has(sid)) continue;

        try {
          if (s.signalType === "offer" && role === "callee") {
            const offer = JSON.parse(s.payload);
            await handleOffer(offer);
          } else if (s.signalType === "answer" && role === "caller") {
            const answer = JSON.parse(s.payload);
            await handleAnswer(answer);
          } else if (s.signalType === "candidate") {
            const candidate = JSON.parse(s.payload);
            await handleCandidate(candidate);
          } else if (s.signalType === "end") {
            onOpenChange(false);
            toast.message("Call ended");
          }
        } finally {
          processedSignalIdsRef.current.add(sid);
        }
      }
    })();
  }, [signals, role, callId, acceptCall, onOpenChange, activeCall, user]);

  // Replace handleEnd to ensure proper cleanup
  const handleEnd = async () => {
    try {
      await endCall({ callId });
    } catch {
      // ignore
    } finally {
      closePeerConnection();
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