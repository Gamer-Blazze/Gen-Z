import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";

// Send friend request
export const sendFriendRequest = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Additional auth check via ctx.auth.getUserIdentity() as requested
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    if (user._id === args.userId) {
      throw new Error("Cannot send friend request to yourself");
    }

    // Check if friendship already exists
    const existingFriendship = await ctx.db
      .query("friendships")
      .filter((q) =>
        q.or(
          q.and(q.eq(q.field("userId1"), user._id), q.eq(q.field("userId2"), args.userId)),
          q.and(q.eq(q.field("userId1"), args.userId), q.eq(q.field("userId2"), user._id))
        )
      )
      .first();

    if (existingFriendship) {
      throw new Error("Friendship request already exists");
    }

    const friendshipId = await ctx.db.insert("friendships", {
      userId1: user._id,
      userId2: args.userId,
      status: "pending",
      requesterId: user._id,
    });

    // Also insert into friend_requests as requested (from, to, status)
    await ctx.db.insert("friend_requests", {
      from: user._id,
      to: args.userId,
      status: "pending",
    });

    // Create notification
    await ctx.db.insert("notifications", {
      userId: args.userId,
      type: "friend_request",
      fromUserId: user._id,
      isRead: false,
      content: `${user.name || "Someone"} sent you a friend request`,
    });

    return friendshipId;
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