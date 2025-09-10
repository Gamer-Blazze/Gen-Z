import { getAuthUserId } from "@convex-dev/auth/server";
import { query, QueryCtx, MutationCtx } from "./_generated/server";
import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 * Usage: const signedInUser = await ctx.runQuery(api.authHelpers.currentUser);
 * THIS FUNCTION IS READ-ONLY. DO NOT MODIFY.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    if (user === null) {
      return null;
    }

    return user;
  },
});

/**
 * Use this function internally to get the current user data. Remember to handle the null user case.
 * @param ctx
 * @returns
 */
export const getCurrentUser = async (ctx: QueryCtx | MutationCtx) => {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }
  return await ctx.db.get(userId);
};

export const updateUserName = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const name = args.name.trim();
    if (name.length === 0) {
      throw new Error("Name cannot be empty");
    }
    await ctx.db.patch(user._id, { name });
    return true;
  },
});

export const updateUserImage = mutation({
  args: { image: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    await ctx.db.patch(user._id, { image: args.image });
    return true;
  },
});

export const getUserById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user ?? null;
  },
});

export const getUserCounts = query({
  args: {},
  handler: async (ctx) => {
    // Count total users
    let totalUsers = 0;
    for await (const _ of ctx.db.query("users")) {
      totalUsers++;
    }

    // Count users marked online using the index
    let onlineUsers = 0;
    for await (const _ of ctx.db
      .query("users")
      .withIndex("by_isOnline", (q) => q.eq("isOnline", true))) {
      onlineUsers++;
    }

    return { totalUsers, onlineUsers };
  },
});

// Fetch user by username
export const getUserByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const uname = args.username.trim().toLowerCase();
    if (!uname) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", uname))
      .unique();

    return user ?? null;
  },
});

// Update multiple user profile fields with basic validation and username uniqueness
export const updateUserProfile = mutation({
  args: {
    name: v.optional(v.string()),
    bio: v.optional(v.string()),
    coverImage: v.optional(v.string()),
    username: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const patch: Record<string, any> = {};

    if (typeof args.name === "string") {
      const name = args.name.trim();
      if (name.length === 0) throw new Error("Name cannot be empty");
      patch.name = name;
    }

    if (typeof args.bio === "string") {
      patch.bio = args.bio.trim();
    }

    if (typeof args.coverImage === "string") {
      patch.coverImage = args.coverImage;
    }

    if (typeof args.username === "string") {
      const uname = args.username.trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,20}$/.test(uname)) {
        throw new Error("Username must be 3-20 chars (a-z, 0-9, ., _, -)");
      }
      // ensure not taken by someone else
      const existing = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", uname))
        .unique()
        .catch(() => null);

      if (existing && existing._id !== user._id) {
        throw new Error("Username already taken");
      }
      patch.username = uname;
    }

    if (Object.keys(patch).length === 0) return true;

    await ctx.db.patch(user._id, patch);
    return true;
  },
});

export const updateUserSettings = mutation({
  args: {
    notifications: v.optional(
      v.object({
        likes: v.optional(v.boolean()),
        comments: v.optional(v.boolean()),
        friendRequests: v.optional(v.boolean()),
        messages: v.optional(v.boolean()),
      })
    ),
    privacy: v.optional(
      v.object({
        canMessage: v.optional(v.union(v.literal("everyone"), v.literal("friends"))),
        postsVisibility: v.optional(v.union(v.literal("public"), v.literal("friends"))),
        // Add: active status toggle
        showActiveStatus: v.optional(v.boolean()),
      })
    ),
    // ADD: preferences updates (language + density)
    preferences: v.optional(
      v.object({
        language: v.optional(v.union(v.literal("en"), v.literal("es"), v.literal("hi"))),
        density: v.optional(v.union(v.literal("comfortable"), v.literal("compact"))),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const existing = (user as any).settings || {
      notifications: { likes: true, comments: true, friendRequests: true, messages: true },
      privacy: { canMessage: "everyone", postsVisibility: "public", showActiveStatus: true }, // default include active status
      preferences: { language: "en", density: "comfortable" }, // default preferences
    };

    const merged = {
      notifications: {
        ...existing.notifications,
        ...(args.notifications || {}),
      },
      privacy: {
        ...existing.privacy,
        ...(args.privacy || {}),
      },
      preferences: {
        ...existing.preferences,
        ...(args.preferences || {}),
      },
    };

    await ctx.db.patch(user._id, { settings: merged });
    return true;
  },
});