import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";
import { withErrorLogging } from "./utils/errors";

// Send friend request
export const sendFriendRequest = mutation({
  args: {
    toUserId: v.optional(v.id("users")),
    userId: v.optional(v.id("users")),
  },
  handler: withErrorLogging("friends.sendFriendRequest", async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const toUserId = args.toUserId ?? args.userId;
    if (!toUserId) {
      throw new Error("Missing recipient user id");
    }

    if (user._id === toUserId) {
      throw new Error("Cannot send friend request to yourself");
    }

    // Single-table behavior using friend_requests only:
    // 1) If already friends (accepted in either direction) => prevent sending
    const acceptedOutgoing = await ctx.db
      .query("friend_requests")
      .withIndex("by_from_and_to", (q: any) => q.eq("from", user._id).eq("to", toUserId))
      .first();
    if (acceptedOutgoing && acceptedOutgoing.status === "accepted") {
      throw new Error("Already friends");
    }

    const acceptedIncoming = await ctx.db
      .query("friend_requests")
      .withIndex("by_from_and_to", (q: any) => q.eq("from", toUserId).eq("to", user._id))
      .first();
    if (acceptedIncoming && acceptedIncoming.status === "accepted") {
      throw new Error("Already friends");
    }

    // 2) If a pending outgoing request already exists, be idempotent
    if (acceptedOutgoing && acceptedOutgoing.status === "pending") {
      return { friendRequestId: acceptedOutgoing._id };
    }

    // 3) If a pending incoming request exists from the other user, do not auto-accept here.
    // Return the existing incoming request so UIs can prompt "Respond".
    if (acceptedIncoming && acceptedIncoming.status === "pending") {
      return { friendRequestId: acceptedIncoming._id };
    }

    // 4) Create a new pending friend request
    const frId = await ctx.db.insert("friend_requests", {
      from: user._id,
      to: toUserId,
      status: "pending",
    });

    // No friendships or mirror rows; single-table behavior only
    return { friendRequestId: frId };
  }),
});

// Accept using friend_requests (keep signature but operate on friend_requests)
export const acceptFriendRequest = mutation({
  args: {
    friendshipId: v.id("friend_requests"),
  },
  handler: withErrorLogging("friends.acceptFriendRequest", async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const req = await ctx.db.get(args.friendshipId);
    if (!req) {
      throw new Error("Friend request not found");
    }
    if (req.to !== user._id) {
      throw new Error("Not authorized");
    }
    if (req.status !== "pending") {
      return true;
    }

    await ctx.db.patch(args.friendshipId, { status: "accepted" });

    // Optional: notification (kept to avoid breaking other screens)
    await ctx.db.insert("notifications", {
      userId: req.from,
      type: "friend_accepted",
      fromUserId: user._id,
      isRead: false,
      content: `${user.name || "Someone"} accepted your friend request`,
    });

    return true;
  }),
});

// Decline using friend_requests (keep signature but operate on friend_requests)
export const declineFriendRequest = mutation({
  args: {
    friendshipId: v.id("friend_requests"),
  },
  handler: withErrorLogging("friends.declineFriendRequest", async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const req = await ctx.db.get(args.friendshipId);
    if (!req) {
      throw new Error("Friend request not found");
    }

    if (req.to !== user._id || req.status !== "pending") {
      throw new Error("Not authorized");
    }

    // Single-table behavior: delete the pending request
    await ctx.db.delete(args.friendshipId);
    return true;
  }),
});

export const getUserFriends = query({
  args: {
    userId: v.optional(v.id("users")),
  },
  handler: withErrorLogging("friends.getUserFriends", async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return [];
    }
    const targetUserId = args.userId || user._id;

    // Accepted outgoing -> friends are "to"
    const acceptedOutgoing = await ctx.db
      .query("friend_requests")
      .withIndex("by_from_and_to", (q: any) => q.eq("from", targetUserId).gt("to", "")) // small slice
      .take(500);

    // FIX: use index by_to_and_status to keep index field order correct
    const acceptedIncoming = await ctx.db
      .query("friend_requests")
      .withIndex("by_to_and_status", (q: any) => q.eq("to", targetUserId).eq("status", "accepted"))
      .collect();

    const friendsIds: Set<string> = new Set();

    for (const row of acceptedOutgoing) {
      if (row.status === "accepted") {
        friendsIds.add(row.to as unknown as string);
      }
    }
    for (const row of acceptedIncoming) {
      // already filtered to accepted via the index
      friendsIds.add(row.from as unknown as string);
    }

    const results: any[] = [];
    for (const id of friendsIds) {
      const u = await ctx.db.get(id as any);
      if (u) results.push(u);
    }
    return results;
  }),
});

export const getPendingFriendRequests = query({
  args: {},
  handler: withErrorLogging("friends.getPendingFriendRequests", async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return [];
    }

    // Receiver's pending requests
    const requests = await ctx.db
      .query("friend_requests")
      .withIndex("by_to_and_status", (q: any) => q.eq("to", user._id).eq("status", "pending"))
      .collect();

    const requestsWithUsers = await Promise.all(
      requests.map(async (req: any) => {
        const requester = await ctx.db.get(req.from);
        return {
          ...req,
          requester,
        };
      })
    );

    return requestsWithUsers;
  }),
});

export const getReceivedRequests = query({
  args: {},
  handler: withErrorLogging("friends.getReceivedRequests", async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const requests = await ctx.db
      .query("friend_requests")
      .withIndex("by_to_and_status", (q: any) => q.eq("to", user._id).eq("status", "pending"))
      .collect();

    const withRequester = await Promise.all(
      requests.map(async (req: any) => {
        const requester = await ctx.db.get(req.from);
        return { ...req, requester };
      })
    );

    return withRequester;
  }),
});

export const acceptRequest = mutation({
  args: {
    requestId: v.id("friend_requests"),
  },
  handler: withErrorLogging("friends.acceptRequest", async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const req = await ctx.db.get(args.requestId);
    if (!req) throw new Error("Request not found");
    if (req.to !== user._id) throw new Error("Not authorized");
    if (req.status !== "pending") return true;

    await ctx.db.patch(args.requestId, { status: "accepted" });

    await ctx.db.insert("notifications", {
      userId: req.from,
      type: "friend_accepted",
      fromUserId: user._id,
      isRead: false,
      content: `${user.name || "Someone"} accepted your friend request`,
    });

    return true;
  }),
});

export const rejectRequest = mutation({
  args: {
    requestId: v.id("friend_requests"),
  },
  handler: withErrorLogging("friends.rejectRequest", async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const req = await ctx.db.get(args.requestId);
    if (!req) throw new Error("Request not found");
    if (req.to !== user._id) throw new Error("Not authorized");
    if (req.status !== "pending") return true;

    // Delete pending for immediate disappearance
    await ctx.db.delete(args.requestId);

    return true;
  }),
});

export const getRelationshipStatus = query({
  args: { otherUserId: v.id("users") },
  handler: withErrorLogging("friends.getRelationshipStatus", async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) return "none" as const;

    if (me._id === args.otherUserId) {
      return "self" as const;
    }

    // Consider accepted = friends (either direction)
    const out = await ctx.db
      .query("friend_requests")
      .withIndex("by_from_and_to", (q: any) => q.eq("from", me._id).eq("to", args.otherUserId))
      .first();

    if (out && out.status === "accepted") return "friends" as const;
    if (out && out.status === "pending") return "outgoing_request" as const;

    const inc = await ctx.db
      .query("friend_requests")
      .withIndex("by_from_and_to", (q: any) => q.eq("from", args.otherUserId).eq("to", me._id))
      .first();

    if (inc && inc.status === "accepted") return "friends" as const;
    if (inc && inc.status === "pending") return "incoming_request" as const;

    return "none" as const;
  }),
});

export const cancelOutgoingRequest = mutation({
  args: {
    otherUserId: v.id("users"),
  },
  handler: withErrorLogging("friends.cancelOutgoingRequest", async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");

    // Find the outgoing pending friend request (me -> other)
    const req = await ctx.db
      .query("friend_requests")
      .withIndex("by_from_and_to", (q: any) => q.eq("from", me._id).eq("to", args.otherUserId))
      .first();

    // Safe no-op if not pending
    if (!req || req.status !== "pending") {
      return { ok: true, changed: false };
    }

    // Delete to ensure it disappears from receiver immediately
    await ctx.db.delete(req._id);

    return { ok: true, changed: true };
  }),
});

export const unfriend = mutation({
  args: {
    otherUserId: v.id("users"),
  },
  handler: withErrorLogging("friends.unfriend", async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");

    // Find accepted relationship in either direction and delete it
    const out = await ctx.db
      .query("friend_requests")
      .withIndex("by_from_and_to", (q: any) => q.eq("from", me._id).eq("to", args.otherUserId))
      .first();

    let removed = false;
    if (out && out.status === "accepted") {
      await ctx.db.delete(out._id);
      removed = true;
    }

    const inc = await ctx.db
      .query("friend_requests")
      .withIndex("by_from_and_to", (q: any) => q.eq("from", args.otherUserId).eq("to", me._id))
      .first();

    if (inc && inc.status === "accepted") {
      await ctx.db.delete(inc._id);
      removed = true;
    }

    if (!removed) {
      throw new Error("Not friends");
    }

    return true;
  }),
});

export const getOnlineFriends = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: withErrorLogging("friends.getOnlineFriends", async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) return [];

    // Gather accepted friendships in both directions via indexes
    const asUser1 = await ctx.db
      .query("friendships")
      .withIndex("by_user1_and_status", (q: any) =>
        q.eq("userId1", me._id).eq("status", "accepted")
      )
      .collect();

    const asUser2 = await ctx.db
      .query("friendships")
      .withIndex("by_user2_and_status", (q: any) =>
        q.eq("userId2", me._id).eq("status", "accepted")
      )
      .collect();

    const friendIds = new Set<string>(
      [...asUser1, ...asUser2].map((f: any) =>
        (f.userId1 === me._id ? f.userId2 : f.userId1) as unknown as string
      )
    );

    const cap = Math.max(1, Math.min(args.limit ?? 20, 100));
    const online: any[] = [];
    for (const idStr of friendIds) {
      const u = await ctx.db.get(idStr as any);
      if (u && (u as any).isOnline) {
        online.push(u);
        if (online.length >= cap) break;
      }
    }

    return online;
  }),
});

// Search users by name, username, or email using index ranges. Case-insensitive-ish with prefix ranges.
export const searchUsers = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
    excludeIds: v.optional(v.array(v.id("users"))),
  },
  handler: withErrorLogging("friends.searchUsers", async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    const raw = args.query.trim();
    if (raw.length < 2) return [];

    const lower = raw.toLowerCase();
    const limit = Math.max(1, Math.min(args.limit ?? 20, 50));
    const exclude: Set<string> = new Set();
    if (me) exclude.add(me._id as unknown as string);
    for (const id of args.excludeIds ?? []) exclude.add(id as unknown as string);

    const results = new Map<string, any>();

    // Helper to collect into results map
    const add = (docs: any[]) => {
      for (const u of docs) {
        if (!u) continue;
        const id = u._id as unknown as string;
        if (exclude.has(id)) continue;
        results.set(id, u);
        if (results.size >= limit * 3) break; // early cap to avoid overfetch
      }
    };

    // Try username (stored lowercase in many flows)
    try {
      const byUsername = await ctx.db
        .query("users")
        .withIndex("by_username", (q: any) =>
          q.gte("username", lower).lt("username", lower + "\uffff")
        )
        .take(limit * 2);
      add(byUsername);
    } catch {
      // ignore
    }

    // Try name with two casing prefixes to better match typical capitalization
    const namePrefixes: Array<string> = [];
    namePrefixes.push(lower);
    if (raw.length > 0) {
      namePrefixes.push(raw[0].toUpperCase() + raw.slice(1));
    }

    for (const p of namePrefixes) {
      try {
        const byName = await ctx.db
          .query("users")
          .withIndex("by_name", (q: any) =>
            q.gte("name", p).lt("name", p + "\uffff")
          )
          .take(limit * 2);
        add(byName);
      } catch {
        // ignore
      }
      if (results.size >= limit * 3) break;
    }

    // Try email prefix
    try {
      const byEmail = await ctx.db
        .query("users")
        .withIndex("email", (q: any) =>
          q.gte("email", lower).lt("email", lower + "\uffff")
        )
        .take(limit * 2);
      add(byEmail);
    } catch {
      // ignore
    }

    // Final refine: ensure the query appears in at least one of name/email/username
    const refined: any[] = [];
    for (const u of results.values()) {
      const name = (u.name ?? "").toLowerCase();
      const email = (u.email ?? "").toLowerCase();
      const username = (u.username ?? "").toLowerCase();
      if (
        name.includes(lower) ||
        email.includes(lower) ||
        username.includes(lower)
      ) {
        refined.push(u);
      }
      if (refined.length >= limit) break;
    }

    return refined;
  }),
});

// Get people you may know: excludes me, existing friends (accepted), and pending requests (both directions).
export const getSuggestions = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: withErrorLogging("friends.getSuggestions", async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) return [];
    const cap = Math.max(1, Math.min(args.limit ?? 12, 36));

    const exclude = new Set<string>([me._id as unknown as string]);

    // Outgoing (me -> others)
    const out = await ctx.db
      .query("friend_requests")
      .withIndex("by_from_and_to", (q: any) => q.eq("from", me._id).gt("to", ""))
      .take(1000);

    for (const r of out) {
      const toId = r.to as unknown as string;
      if (r.status === "accepted" || r.status === "pending") exclude.add(toId);
    }

    // Incoming (others -> me)
    const inc = await ctx.db
      .query("friend_requests")
      // FIX: use index starting with "to" to satisfy field order and fetch all rows to me
      .withIndex("by_to", (q: any) => q.eq("to", me._id))
      .take(1000);

    for (const r of inc) {
      const fromId = r.from as unknown as string;
      if (r.status === "accepted" || r.status === "pending") exclude.add(fromId);
    }

    const suggestions: any[] = [];
    const seen = new Set<string>();

    // Prefer online users first
    const online = await ctx.db
      .query("users")
      .withIndex("by_isOnline", (q: any) => q.eq("isOnline", true))
      .take(cap * 3);

    for (const u of online) {
      const id = u._id as unknown as string;
      if (exclude.has(id) || seen.has(id)) continue;
      seen.add(id);
      suggestions.push(u);
      if (suggestions.length >= cap) return suggestions;
    }

    // Fill with general users by name order
    const byName = await ctx.db
      .query("users")
      .withIndex("by_name", (q: any) => q.gt("name", ""))
      .take(cap * 5);

    for (const u of byName) {
      const id = u._id as unknown as string;
      if (exclude.has(id) || seen.has(id)) continue;
      seen.add(id);
      suggestions.push(u);
      if (suggestions.length >= cap) break;
    }

    return suggestions.slice(0, cap);
  }),
});