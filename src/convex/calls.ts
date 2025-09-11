import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";
import { Id } from "./_generated/dataModel";
import { withErrorLogging } from "./utils/errors";

// Start a call (voice or video) between two participants in a direct conversation.
export const startCall = mutation({
  args: {
    conversationId: v.id("conversations"),
    type: v.union(v.literal("voice"), v.literal("video")),
  },
  handler: withErrorLogging("calls.startCall", async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");
    if (conversation.isGroup) throw new Error("Group calls are not supported yet");

    if (!conversation.participants.includes(user._id)) {
      throw new Error("Not authorized");
    }

    // Determine callee (other participant)
    const others = conversation.participants.filter((u: any) => u !== user._id);
    if (others.length !== 1) throw new Error("Call requires exactly two participants");
    const calleeId = others[0];

    // End any existing active calls in this conversation for safety
    const existing = await ctx.db
      .query("calls")
      .withIndex("by_conversation", (q: any) => q.eq("conversationId", args.conversationId))
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
  }),
});

// Callee accepts the call
export const acceptCall = mutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, args) => {
    try {
      // Validate auth
      const user = await getCurrentUser(ctx);
      if (!user) {
        return { success: false, error: "Not authenticated" };
      }

      // Validate arg presence (extra defensive even though v.id enforces it)
      if (!args.callId) {
        return { success: false, error: "Missing callId" };
      }

      // Ensure call exists
      const call = await ctx.db.get(args.callId);
      if (!call) {
        return { success: false, error: "Call not found" };
      }

      // Only callee should accept; callers / others are no-ops
      if (call.calleeId !== user._id) {
        return { success: true, callId: args.callId };
      }

      // State checks
      if (call.status === "ended") {
        return { success: false, error: "Call already ended" };
      }
      if (call.status === "accepted") {
        return { success: true, callId: args.callId };
      }
      if (call.status !== "ringing") {
        return { success: false, error: "Call cannot be accepted in current state" };
      }

      // Accept the call
      await ctx.db.patch(args.callId, { status: "accepted", acceptedAt: Date.now() });

      // Notify caller (best-effort)
      try {
        await ctx.db.insert("call_signals", {
          callId: args.callId,
          toUserId: call.callerId,
          fromUserId: user._id,
          signalType: "accept",
          payload: "",
          createdAt: Date.now(),
        });
      } catch {
        // non-fatal
      }

      return { success: true, callId: args.callId };
    } catch (err: any) {
      console.error("acceptCall error:", err?.message || err);
      return { success: false, error: err?.message || "Unknown error" };
    }
  },
});

// Either party ends the call
export const endCall = mutation({
  args: { callId: v.id("calls") },
  handler: withErrorLogging("calls.endCall", async (ctx, args) => {
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
  }),
});

// Active call for current user in a conversation (to show incoming/ongoing call)
export const getActiveCallForUser = query({
  args: { conversationId: v.id("conversations") },
  handler: withErrorLogging("calls.getActiveCallForUser", async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const call = await ctx.db
      .query("calls")
      .withIndex("by_conversation", (q: any) => q.eq("conversationId", args.conversationId))
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
  }),
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
  handler: withErrorLogging("calls.sendSignal", async (ctx, args) => {
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
  }),
});

// Get signals for current user for a call (auto-updates via Convex subscription)
export const getSignalsForUser = query({
  args: { callId: v.id("calls") },
  handler: withErrorLogging("calls.getSignalsForUser", async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const signals = await ctx.db
      .query("call_signals")
      .withIndex("by_call_and_to", (q: any) =>
        q.eq("callId", args.callId).eq("toUserId", user._id)
      )
      .order("desc")
      .take(100);
    return signals;
  }),
});