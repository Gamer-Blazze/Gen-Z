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

// Get user's friends
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

    const friendships = await ctx.db
      .query("friendships")
      .filter((q) => 
        q.and(
          q.or(
            q.eq(q.field("userId1"), targetUserId),
            q.eq(q.field("userId2"), targetUserId)
          ),
          q.eq(q.field("status"), "accepted")
        )
      )
      .collect();

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

// Get pending friend requests
export const getPendingFriendRequests = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return [];
    }

    const requests = await ctx.db
      .query("friendships")
      .filter((q) => 
        q.and(
          q.eq(q.field("userId2"), user._id),
          q.eq(q.field("status"), "pending")
        )
      )
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

// Search users
export const searchUsers = query({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return [];
    }

    if (args.query.length < 2) {
      return [];
    }

    const users = await ctx.db
      .query("users")
      .filter((q) => 
        q.and(
          q.neq(q.field("_id"), user._id),
          q.or(
            q.eq(q.field("name"), args.query),
            q.eq(q.field("email"), args.query)
          )
        )
      )
      .take(10);

    return users;
  },
});

// Get received friend requests (from friend_requests) for the current user
export const getReceivedRequests = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const requests = await ctx.db
      .query("friend_requests")
      .withIndex("by_to", (q) => q.eq("to", user._id))
      .filter((q) => q.eq(q.field("status"), "pending"))
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

// Accept a friend request (friend_requests) and ensure friendship is created/updated
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

    // Update request status
    await ctx.db.patch(args.requestId, { status: "accepted" });

    // Ensure friendship record is accepted (update pending one if exists, else create)
    const maybePending = await ctx.db
      .query("friendships")
      .withIndex("by_user1", (q) => q.eq("userId1", req.from))
      .filter((q) =>
        q.and(
          q.eq(q.field("userId2"), req.to),
          q.eq(q.field("status"), "pending")
        )
      )
      .first();

    if (maybePending) {
      await ctx.db.patch(maybePending._id, { status: "accepted" });
    } else {
      await ctx.db.insert("friendships", {
        userId1: req.from,
        userId2: req.to,
        status: "accepted",
        requesterId: req.from,
      });
    }

    // Notify requester
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

// Reject a friend request (friend_requests) and clean up pending friendship entry if present
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

    // Update request status
    await ctx.db.patch(args.requestId, { status: "rejected" });

    // If there is a pending friendship row created earlier, delete it
    const maybePending = await ctx.db
      .query("friendships")
      .withIndex("by_user1", (q) => q.eq("userId1", req.from))
      .filter((q) =>
        q.and(
          q.eq(q.field("userId2"), req.to),
          q.eq(q.field("status"), "pending")
        )
      )
      .first();

    if (maybePending) {
      await ctx.db.delete(maybePending._id);
    }

    return true;
  },
});