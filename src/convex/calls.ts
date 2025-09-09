import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";
import { Id } from "./_generated/dataModel";

// Start a call (voice or video) between two participants in a direct conversation.
export const startCall = mutation({
  args: {
    conversationId: v.id("conversations"),
    type: v.union(v.literal("voice"), v.literal("video")),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");
    if (conversation.isGroup) throw new Error("Group calls are not supported yet");

    if (!conversation.participants.includes(user._id)) {
      throw new Error("Not authorized");
    }

    // Determine callee (other participant)
    const others = conversation.participants.filter((u) => u !== user._id);
    if (others.length !== 1) throw new Error("Call requires exactly two participants");
    const calleeId = others[0];

    // End any existing active calls in this conversation for safety
    const existing = await ctx.db
      .query("calls")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();
    for (const c of existing) {
      if (c.status !== "ended") {
        await ctx.db.patch(c._id, { status: "ended", endedAt: Date.now() });
      }
    }

    const callId = await ctx.db.insert("calls", {
      conversationId: args.conversationId,
      callerId: user._id,
      calleeId,
      type: args.type,
      status: "ringing",
      startedAt: Date.now(),
    });

    return callId;
  },
});

// Callee accepts the call
export const acceptCall = mutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const call = await ctx.db.get(args.callId);
    if (!call) throw new Error("Call not found");
    // Make tolerant: if not callee, treat as no-op (idempotent) instead of throwing
    if (call.calleeId !== user._id) {
      return true;
    }

    // Make idempotent and safe: if already accepted, just return
    if (call.status === "accepted") {
      return true;
    }
    if (call.status === "ended") {
      throw new Error("Call already ended");
    }
    if (call.status !== "ringing") {
      // Unknown state but do not hard fail; treat as idempotent success
      return true;
    }

    await ctx.db.patch(args.callId, { status: "accepted", acceptedAt: Date.now() });
    // Also record a signal for caller that call is accepted (optional)
    await ctx.db.insert("call_signals", {
      callId: args.callId,
      toUserId: call.callerId,
      fromUserId: user._id,
      signalType: "accept",
      payload: "",
      createdAt: Date.now(),
    });
    return true;
  },
});

// Either party ends the call
export const endCall = mutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const call = await ctx.db.get(args.callId);
    if (!call) throw new Error("Call not found");
    if (user._id !== call.callerId && user._id !== call.calleeId) {
      throw new Error("Not authorized to end this call");
    }

    if (call.status !== "ended") {
      await ctx.db.patch(args.callId, { status: "ended", endedAt: Date.now() });
      // Notify the other side
      const other =
        user._id === call.callerId ? call.calleeId : call.callerId;
      await ctx.db.insert("call_signals", {
        callId: args.callId,
        toUserId: other,
        fromUserId: user._id,
        signalType: "end",
        payload: "",
        createdAt: Date.now(),
      });
    }
    return true;
  },
});

// Active call for current user in a conversation (to show incoming/ongoing call)
export const getActiveCallForUser = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const call = await ctx.db
      .query("calls")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("desc")
      .first();
    if (!call) return null;

    // Must be a participant and not ended
    if (
      (call.callerId === user._id || call.calleeId === user._id) &&
      call.status !== "ended"
    ) {
      return call;
    }
    return null;
  },
});

// Send a signaling message to the other user
export const sendSignal = mutation({
  args: {
    callId: v.id("calls"),
    toUserId: v.id("users"),
    signalType: v.union(
      v.literal("offer"),
      v.literal("answer"),
      v.literal("candidate"),
      v.literal("accept"),
      v.literal("end")
    ),
    payload: v.string(), // JSON stringified
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const call = await ctx.db.get(args.callId);
    if (!call) throw new Error("Call not found");
    // Only participants can signal
    if (user._id !== call.callerId && user._id !== call.calleeId) {
      throw new Error("Not authorized");
    }

    await ctx.db.insert("call_signals", {
      callId: args.callId,
      toUserId: args.toUserId,
      fromUserId: user._id,
      signalType: args.signalType,
      payload: args.payload,
      createdAt: Date.now(),
    });

    return true;
  },
});

// Get signals for current user for a call (auto-updates via Convex subscription)
export const getSignalsForUser = query({
  args: { callId: v.id("calls") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const signals = await ctx.db
      .query("call_signals")
      .withIndex("by_call_and_to", (q) =>
        q.eq("callId", args.callId).eq("toUserId", user._id)
      )
      .order("desc")
      .take(100);
    // Return newest first is fine; client can process accordingly
    return signals;
  },
});