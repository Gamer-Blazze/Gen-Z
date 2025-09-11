import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";

// Send friend request
export const sendFriendRequest = mutation({
  args: {
    toUserId: v.optional(v.id("users")),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
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

    // Prevent duplicate requests in either direction using composite index
    const existing = await ctx.db
      .query("friend_requests")
      .withIndex("by_from_and_to", (q) => q.eq("from", user._id).eq("to", toUserId))
      .first();
    if (existing) {
      throw new Error("Friend request already sent");
    }

    const reverse = await ctx.db
      .query("friend_requests")
      .withIndex("by_from_and_to", (q) => q.eq("from", toUserId).eq("to", user._id))
      .first();
    if (reverse) {
      throw new Error("A pending request from this user already exists");
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
  },
});

// Accept friend request
export const acceptFriendRequest = mutation({
  args: {
    friendshipId: v.id("friendships"),
  },
  handler: async (ctx, args) => {
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
  },
});

// Decline friend request
export const declineFriendRequest = mutation({
  args: {
    friendshipId: v.id("friendships"),
  },
  handler: async (ctx, args) => {
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
  },
});

// Replace getUserFriends to use composite indexes (no filters)
export const getUserFriends = query({
  args: {
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return [];
    }

    const targetUserId = args.userId || user._id;

    const asUser1 = await ctx.db
      .query("friendships")
      .withIndex("by_user1_and_status", (q) => q.eq("userId1", targetUserId).eq("status", "accepted"))
      .collect();

    const asUser2 = await ctx.db
      .query("friendships")
      .withIndex("by_user2_and_status", (q) => q.eq("userId2", targetUserId).eq("status", "accepted"))
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
  },
});

// Replace getPendingFriendRequests to use an index (no filters)
export const getPendingFriendRequests = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return [];
    }

    const requests = await ctx.db
      .query("friendships")
      .withIndex("by_user2_and_status", (q) => q.eq("userId2", user._id).eq("status", "pending"))
      .collect();

    const requestsWithUsers = await Promise.all(
      requests.map(async (request) => {
        const requester = await ctx.db.get(request.requesterId);
        return {
          ...request,
          requester,
        };
      })
    );

    return requestsWithUsers;
  },
});

// Replace getReceivedRequests to a composite index
export const getReceivedRequests = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const requests = await ctx.db
      .query("friend_requests")
      .withIndex("by_to_and_status", (q) => q.eq("to", user._id).eq("status", "pending"))
      .collect();

    const withRequester = await Promise.all(
      requests.map(async (req) => {
        const requester = await ctx.db.get(req.from);
        return { ...req, requester };
      })
    );

    return withRequester;
  },
});

// Update acceptRequest to remove filter-based scan
export const acceptRequest = mutation({
  args: {
    requestId: v.id("friend_requests"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const req = await ctx.db.get(args.requestId);
    if (!req) throw new Error("Request not found");
    if (req.to !== user._id) throw new Error("Not authorized");
    if (req.status !== "pending") throw new Error("Request is not pending");

    await ctx.db.patch(args.requestId, { status: "accepted" });

    const maybeExisting = await ctx.db
      .query("friendships")
      .withIndex("by_user1_and_user2", (q) => q.eq("userId1", req.from).eq("userId2", req.to))
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
  },
});

// Update rejectRequest to remove filter-based scan
export const rejectRequest = mutation({
  args: {
    requestId: v.id("friend_requests"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const req = await ctx.db.get(args.requestId);
    if (!req) throw new Error("Request not found");
    if (req.to !== user._id) throw new Error("Not authorized");
    if (req.status !== "pending") throw new Error("Request is not pending");

    await ctx.db.patch(args.requestId, { status: "rejected" });

    const maybeExisting = await ctx.db
      .query("friendships")
      .withIndex("by_user1_and_user2", (q) => q.eq("userId1", req.from).eq("userId2", req.to))
      .first();

    if (maybeExisting && maybeExisting.status === "pending") {
      await ctx.db.delete(maybeExisting._id);
    }

    return true;
  },
});

// Replace getRelationshipStatus to use composite indexes
export const getRelationshipStatus = query({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) return "none" as const;

    if (me._id === args.otherUserId) {
      return "self" as const;
    }

    const doc1 = await ctx.db
      .query("friendships")
      .withIndex("by_user1_and_user2", (q) => q.eq("userId1", me._id).eq("userId2", args.otherUserId))
      .first();

    if (doc1 && doc1.status === "accepted") return "friends" as const;

    const doc2 = await ctx.db
      .query("friendships")
      .withIndex("by_user2_and_user1", (q) => q.eq("userId2", me._id).eq("userId1", args.otherUserId))
      .first();

    if (doc2 && doc2.status === "accepted") return "friends" as const;

    const outgoing = await ctx.db
      .query("friend_requests")
      .withIndex("by_from_and_to", (q) => q.eq("from", me._id).eq("to", args.otherUserId))
      .first();

    if (outgoing && outgoing.status === "pending") {
      return "outgoing_request" as const;
    }

    const incoming = await ctx.db
      .query("friend_requests")
      .withIndex("by_from_and_to", (q) => q.eq("from", args.otherUserId).eq("to", me._id))
      .first();

    if (incoming && incoming.status === "pending") {
      return "incoming_request" as const;
    }

    return "none" as const;
  },
});

// Search users (optimize to use indexes instead of full scans)
export const searchUsers = query({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) {
      return [];
    }

    const q = args.query.trim();
    if (q.length < 2) {
      return [];
    }

    // Search by exact email via email index
    const byEmail = await ctx.db
      .query("users")
      .withIndex("email", (qi) => qi.eq("email", q))
      .take(10);

    // Search by exact name via by_name index
    const byName = await ctx.db
      .query("users")
      .withIndex("by_name", (qi) => qi.eq("name", q))
      .take(10);

    // Combine results, remove self, and de-duplicate by _id
    const combined = [...byName, ...byEmail].filter((u) => u._id !== me._id);
    const dedup = Array.from(new Map(combined.map((u) => [u._id, u])).values());

    return dedup;
  },
});

export const getSuggestions = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) return [];

    // Collect friend ids (accepted)
    const asUser1 = await ctx.db
      .query("friendships")
      .withIndex("by_user1_and_status", (q) =>
        q.eq("userId1", me._id).eq("status", "accepted")
      )
      .collect();

    const asUser2 = await ctx.db
      .query("friendships")
      .withIndex("by_user2_and_status", (q) =>
        q.eq("userId2", me._id).eq("status", "accepted")
      )
      .collect();

    const friendIds = new Set<string>(
      [...asUser1, ...asUser2].map((f) =>
        (f.userId1 === me._id ? f.userId2 : f.userId1) as unknown as string
      )
    );

    // Pull a batch of users by a known index and filter locally (mocked suggestions)
    // Note: Using by_name as a stable index; adjust if needed.
    const batch = await ctx.db
      .query("users")
      .withIndex("by_name", (q) => q.gt("name", ""))
      .take(100);

    const filtered = batch
      .filter((u) => u._id !== me._id && !friendIds.has(u._id as unknown as string))
      .slice(0, Math.max(1, Math.min(args.limit ?? 12, 50)));

    return filtered;
  },
});

export const cancelOutgoingRequest = mutation({
  args: {
    otherUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");

    // Find the outgoing pending friend request (me -> other)
    const req = await ctx.db
      .query("friend_requests")
      .withIndex("by_from_and_to", (q) => q.eq("from", me._id).eq("to", args.otherUserId))
      .first();

    if (!req || req.status !== "pending") {
      throw new Error("No pending outgoing request to cancel");
    }

    // Mark the request as rejected
    await ctx.db.patch(req._id, { status: "rejected" });

    // If a mirrored pending friendship exists, remove it
    const maybeFriendship = await ctx.db
      .query("friendships")
      .withIndex("by_user1_and_user2", (q) => q.eq("userId1", me._id).eq("userId2", args.otherUserId))
      .first();

    if (maybeFriendship && maybeFriendship.status === "pending") {
      await ctx.db.delete(maybeFriendship._id);
    }

    return true;
  },
});

export const unfriend = mutation({
  args: {
    otherUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");

    // Check both directions for accepted friendship and delete
    const dir1 = await ctx.db
      .query("friendships")
      .withIndex("by_user1_and_user2", (q) => q.eq("userId1", me._id).eq("userId2", args.otherUserId))
      .first();

    if (dir1 && dir1.status === "accepted") {
      await ctx.db.delete(dir1._id);
    }

    const dir2 = await ctx.db
      .query("friendships")
      .withIndex("by_user2_and_user1", (q) => q.eq("userId2", me._id).eq("userId1", args.otherUserId))
      .first();

    if (dir2 && dir2.status === "accepted") {
      await ctx.db.delete(dir2._id);
    }

    return true;
  },
});