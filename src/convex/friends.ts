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
    // Require authentication via ctx.auth.getUserIdentity()
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

    // Add: Block sending a request if users are already friends (either direction)
    const acceptedForward = await ctx.db
      .query("friendships")
      .withIndex("by_user1_and_user2", (q: any) =>
        q.eq("userId1", user._id).eq("userId2", toUserId)
      )
      .first();
    if (acceptedForward && acceptedForward.status === "accepted") {
      throw new Error("Already friends");
    }

    const acceptedReverse = await ctx.db
      .query("friendships")
      .withIndex("by_user2_and_user1", (q: any) =>
        q.eq("userId2", user._id).eq("userId1", toUserId)
      )
      .first();
    if (acceptedReverse && acceptedReverse.status === "accepted") {
      throw new Error("Already friends");
    }

    // Prevent duplicate requests in either direction using composite index
    const existing = await ctx.db
      .query("friend_requests")
      .withIndex("by_from_and_to", (q: any) => q.eq("from", user._id).eq("to", toUserId))
      .first();
    if (existing) {
      // Make operation idempotent: ensure mirrored friendship exists, return existing ids
      let existingFriendship = await ctx.db
        .query("friendships")
        .withIndex("by_user1_and_user2", (q: any) => q.eq("userId1", user._id).eq("userId2", toUserId))
        .first();

      if (!existingFriendship) {
        existingFriendship = await ctx.db.insert("friendships", {
          userId1: user._id,
          userId2: toUserId,
          status: existing.status === "accepted" ? "accepted" : "pending",
          requesterId: user._id,
        }) as any;
      }

      return {
        friendRequestId: existing._id,
        friendshipId: (existingFriendship as any)._id ?? existingFriendship,
      };
    }

    const reverse = await ctx.db
      .query("friend_requests")
      .withIndex("by_from_and_to", (q: any) => q.eq("from", toUserId).eq("to", user._id))
      .first();
    if (reverse) {
      // If the other user already sent a request, don't throw. Mirror the friendship and return.
      let reverseFriendship = await ctx.db
        .query("friendships")
        .withIndex("by_user1_and_user2", (q: any) => q.eq("userId1", toUserId).eq("userId2", user._id))
        .first();

      if (!reverseFriendship) {
        reverseFriendship = await ctx.db.insert("friendships", {
          userId1: toUserId,
          userId2: user._id,
          status: reverse.status === "accepted" ? "accepted" : "pending",
          requesterId: toUserId,
        }) as any;
      }

      return {
        friendRequestId: reverse._id,
        friendshipId: (reverseFriendship as any)._id ?? reverseFriendship,
      };
    }

    // Insert into friend_requests as requested
    const frId = await ctx.db.insert("friend_requests", {
      from: user._id,
      to: toUserId,
      status: "pending",
    });

    // Keep existing behavior for the rest of the app: create a mirrored entry in friendships and a notification
    // (Do not remove to avoid breaking current UIs listing pending requests)
    const friendshipId = await ctx.db.insert("friendships", {
      userId1: user._id,
      userId2: toUserId,
      status: "pending",
      requesterId: user._id,
    });

    await ctx.db.insert("notifications", {
      userId: toUserId,
      type: "friend_request",
      fromUserId: user._id,
      isRead: false,
      content: `${user.name || "Someone"} sent you a friend request`,
    });

    return { friendRequestId: frId, friendshipId };
  }),
});

export const acceptFriendRequest = mutation({
  args: {
    friendshipId: v.id("friendships"),
  },
  handler: withErrorLogging("friends.acceptFriendRequest", async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const friendship = await ctx.db.get(args.friendshipId);
    if (!friendship) {
      throw new Error("Friend request not found");
    }

    if (friendship.userId2 !== user._id) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(args.friendshipId, {
      status: "accepted",
    });

    // Create notification for requester
    await ctx.db.insert("notifications", {
      userId: friendship.requesterId,
      type: "friend_accepted",
      fromUserId: user._id,
      isRead: false,
      content: `${user.name || "Someone"} accepted your friend request`,
    });

    return true;
  }),
});

export const declineFriendRequest = mutation({
  args: {
    friendshipId: v.id("friendships"),
  },
  handler: withErrorLogging("friends.declineFriendRequest", async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const friendship = await ctx.db.get(args.friendshipId);
    if (!friendship) {
      throw new Error("Friend request not found");
    }

    // Only the recipient can decline a pending request
    if (friendship.userId2 !== user._id || friendship.status !== "pending") {
      throw new Error("Not authorized");
    }

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

    const asUser1 = await ctx.db
      .query("friendships")
      .withIndex("by_user1_and_status", (q: any) => q.eq("userId1", targetUserId).eq("status", "accepted"))
      .collect();

    const asUser2 = await ctx.db
      .query("friendships")
      .withIndex("by_user2_and_status", (q: any) => q.eq("userId2", targetUserId).eq("status", "accepted"))
      .collect();

    const friendships = [...asUser1, ...asUser2];

    const friends = await Promise.all(
      friendships.map(async (friendship) => {
        const friendId = friendship.userId1 === targetUserId ? friendship.userId2 : friendship.userId1;
        const friend = await ctx.db.get(friendId);
        return friend;
      })
    );

    return friends.filter(Boolean);
  }),
});

export const getPendingFriendRequests = query({
  args: {},
  handler: withErrorLogging("friends.getPendingFriendRequests", async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return [];
    }

    const requests = await ctx.db
      .query("friendships")
      .withIndex("by_user2_and_status", (q: any) => q.eq("userId2", user._id).eq("status", "pending"))
      .collect();

    const requestsWithUsers = await Promise.all(
      requests.map(async (request: any) => {
        const requester = await ctx.db.get(request.requesterId);
        return {
          ...request,
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
    if (req.status !== "pending") throw new Error("Request is not pending");

    await ctx.db.patch(args.requestId, { status: "accepted" });

    const maybeExisting = await ctx.db
      .query("friendships")
      .withIndex("by_user1_and_user2", (q: any) => q.eq("userId1", req.from).eq("userId2", req.to))
      .first();

    if (maybeExisting) {
      if (maybeExisting.status === "pending") {
        await ctx.db.patch(maybeExisting._id, { status: "accepted" });
      }
      // if already accepted, nothing to do
    } else {
      await ctx.db.insert("friendships", {
        userId1: req.from,
        userId2: req.to,
        status: "accepted",
        requesterId: req.from,
      });
    }

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
    if (req.status !== "pending") throw new Error("Request is not pending");

    await ctx.db.patch(args.requestId, { status: "rejected" });

    const maybeExisting = await ctx.db
      .query("friendships")
      .withIndex("by_user1_and_user2", (q: any) => q.eq("userId1", req.from).eq("userId2", req.to))
      .first();

    if (maybeExisting && maybeExisting.status === "pending") {
      await ctx.db.delete(maybeExisting._id);
    }

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

    const doc1 = await ctx.db
      .query("friendships")
      .withIndex("by_user1_and_user2", (q: any) => q.eq("userId1", me._id).eq("userId2", args.otherUserId))
      .first();

    if (doc1 && doc1.status === "accepted") return "friends" as const;

    const doc2 = await ctx.db
      .query("friendships")
      .withIndex("by_user2_and_user1", (q: any) => q.eq("userId2", me._id).eq("userId1", args.otherUserId))
      .first();

    if (doc2 && doc2.status === "accepted") return "friends" as const;

    const outgoing = await ctx.db
      .query("friend_requests")
      .withIndex("by_from_and_to", (q: any) => q.eq("from", me._id).eq("to", args.otherUserId))
      .first();

    if (outgoing && outgoing.status === "pending") {
      return "outgoing_request" as const;
    }

    const incoming = await ctx.db
      .query("friend_requests")
      .withIndex("by_from_and_to", (q: any) => q.eq("from", args.otherUserId).eq("to", me._id))
      .first();

    if (incoming && incoming.status === "pending") {
      return "incoming_request" as const;
    }

    return "none" as const;
  }),
});

export const searchUsers = query({
  args: {
    query: v.string(),
  },
  handler: withErrorLogging("friends.searchUsers", async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) {
      return [];
    }

    const raw = args.query.trim();
    if (raw.length < 2) {
      return [];
    }

    const qLower = raw.toLowerCase();

    // 1) Pull a small batch by name using the by_name index (prefix/range), then do local contains-match.
    // We purposely cap results to avoid scanning the whole table.
    const nameBatch = await ctx.db
      .query("users")
      .withIndex("by_name", (qi: any) => qi.gt("name", "")) // get a reasonable slice
      .take(200);

    // 2) Pull email batch using the email index. Try exact first, then small range.
    const exactEmail = await ctx.db
      .query("users")
      .withIndex("email", (qi: any) => qi.eq("email", raw))
      .take(10);

    const emailBatch = await ctx.db
      .query("users")
      .withIndex("email", (qi: any) => qi.gt("email", "")) // small slice to locally filter
      .take(200);

    // Combine and locally filter to simulate "contains" behavior while leveraging indexes to avoid full scans.
    const combined = [...nameBatch, ...exactEmail, ...emailBatch].filter((u) => u._id !== me._id);

    const matches = combined.filter((u) => {
      const name = (u.name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      return name.includes(qLower) || email.includes(qLower);
    });

    // Rank: prioritize startsWith over contains, name over email
    const startsWithScore = (text: string, query: string) =>
      text.startsWith(query) ? 2 : text.includes(query) ? 1 : 0;

    const scored = matches
      .map((u) => {
        const name = (u.name || "").toLowerCase();
        const email = (u.email || "").toLowerCase();
        const score = startsWithScore(name, qLower) * 3 + startsWithScore(email, qLower);
        return { u, score };
      })
      .sort((a, b) => b.score - a.score);

    // De-duplicate by _id, keep best score
    const dedupMap = new Map<string, any>();
    for (const { u } of scored) {
      if (!dedupMap.has(u._id as unknown as string)) dedupMap.set(u._id as unknown as string, u);
    }

    // Cap results
    const result = Array.from(dedupMap.values()).slice(0, 20);

    return result;
  }),
});

export const getSuggestions = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: withErrorLogging("friends.getSuggestions", async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) return [];

    // Collect friend ids (accepted)
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
      [...asUser1, ...asUser2].map((f) =>
        (f.userId1 === me._id ? f.userId2 : f.userId1) as unknown as string
      )
    );

    // Pull a batch of users by a known index and filter locally (mocked suggestions)
    const batch = await ctx.db
      .query("users")
      .withIndex("by_name", (q: any) => q.gt("name", ""))
      .take(100);

    const filtered = batch
      .filter((u: any) => u._id !== me._id && !friendIds.has(u._id as unknown as string))
      .slice(0, Math.max(1, Math.min(args.limit ?? 12, 50)));

    return filtered;
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

    // If no pending request, return safe response (no error)
    if (!req || req.status !== "pending") {
      return { ok: true, changed: false };
    }

    // Mark the request as rejected
    await ctx.db.patch(req._id, { status: "rejected" });

    // If a mirrored pending friendship exists, remove it
    const maybeFriendship = await ctx.db
      .query("friendships")
      .withIndex("by_user1_and_user2", (q: any) => q.eq("userId1", me._id).eq("userId2", args.otherUserId))
      .first();

    if (maybeFriendship && maybeFriendship.status === "pending") {
      await ctx.db.delete(maybeFriendship._id);
    }

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

    // Check both directions for accepted friendship and delete
    const dir1 = await ctx.db
      .query("friendships")
      .withIndex("by_user1_and_user2", (q: any) =>
        q.eq("userId1", me._id).eq("userId2", args.otherUserId)
      )
      .first();

    let removed = false;
    if (dir1 && dir1.status === "accepted") {
      await ctx.db.delete(dir1._id);
      removed = true;
    }

    const dir2 = await ctx.db
      .query("friendships")
      .withIndex("by_user2_and_user1", (q: any) =>
        q.eq("userId2", me._id).eq("userId1", args.otherUserId)
      )
      .first();

    if (dir2 && dir2.status === "accepted") {
      await ctx.db.delete(dir2._id);
      removed = true;
    }

    // Add: clear error when there is no accepted friendship to remove
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