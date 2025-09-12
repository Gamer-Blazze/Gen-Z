import { getAuthUserId } from "@convex-dev/auth/server";
import { query, QueryCtx, MutationCtx } from "./_generated/server";
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { withErrorLogging } from "./utils/errors";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 * Usage: const signedInUser = await ctx.runQuery(api.authHelpers.currentUser);
 * THIS FUNCTION IS READ-ONLY. DO NOT MODIFY.
 */
export const currentUser = query({
  args: {},
  handler: withErrorLogging("users.currentUser", async (ctx, _args) => {
    const user = await getCurrentUser(ctx);

    if (user === null) {
      return null;
    }

    return user;
  }),
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
  handler: withErrorLogging("users.updateUserName", async (ctx, args) => {
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
  }),
});

export const updateUserImage = mutation({
  args: { image: v.string() },
  handler: withErrorLogging("users.updateUserImage", async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    await ctx.db.patch(user._id, { image: args.image });
    return true;
  }),
});

export const getUserById = query({
  args: { userId: v.id("users") },
  handler: withErrorLogging("users.getUserById", async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user ?? null;
  }),
});

export const getUserCounts = query({
  args: {},
  handler: withErrorLogging("users.getUserCounts", async (ctx, _args) => {
    let totalUsers = 0;
    for await (const _ of ctx.db.query("users")) {
      totalUsers++;
    }

    let onlineUsers = 0;
    for await (const _ of ctx.db
      .query("users")
      .withIndex("by_isOnline", (q: any) => q.eq("isOnline", true))) {
      onlineUsers++;
    }

    let communitiesCount = 0;
    for await (const _ of ctx.db
      .query("conversations")
      .withIndex("by_isGroup", (q: any) => q.eq("isGroup", true))) {
      communitiesCount++;
    }

    return { totalUsers, onlineUsers, communitiesCount };
  }),
});

// Fetch user by username
export const getUserByUsername = query({
  args: { username: v.string() },
  handler: withErrorLogging("users.getUserByUsername", async (ctx, args) => {
    const uname = args.username.trim().toLowerCase();
    if (!uname) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q: any) => q.eq("username", uname))
      .unique();

    return user ?? null;
  }),
});

// Check username availability (case-insensitive)
export const checkUsernameAvailable = query({
  args: { username: v.string() },
  handler: withErrorLogging("users.checkUsernameAvailable", async (ctx, args) => {
    const uname = args.username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,20}$/.test(uname)) {
      return { available: false };
    }
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q: any) => q.eq("username", uname))
      .unique()
      .catch(() => null);

    return { available: !existing };
  }),
});

// Update multiple user profile fields with basic validation and username uniqueness
export const updateUserProfile = mutation({
  args: {
    name: v.optional(v.string()),
    bio: v.optional(v.string()),
    coverImage: v.optional(v.string()),
    username: v.optional(v.string()),
  },
  handler: withErrorLogging("users.updateUserProfile", async (ctx, args) => {
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
      const existing = await ctx.db
        .query("users")
        .withIndex("by_username", (q: any) => q.eq("username", uname))
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
  }),
});

export const updateUserSettings = mutation({
  args: {
    notifications: v.optional(
      v.object({
        likes: v.optional(v.boolean()),
        comments: v.optional(v.boolean()),
        friendRequests: v.optional(v.boolean()),
        messages: v.optional(v.boolean()),
        sound: v.optional(v.boolean()),
        vibration: v.optional(v.boolean()),
        previews: v.optional(v.boolean()),
      })
    ),
    privacy: v.optional(
      v.object({
        canMessage: v.optional(v.union(v.literal("everyone"), v.literal("friends"))),
        postsVisibility: v.optional(v.union(v.literal("public"), v.literal("friends"))),
        showActiveStatus: v.optional(v.boolean()),
        lastSeenVisibility: v.optional(
          v.union(v.literal("everyone"), v.literal("friends"), v.literal("nobody"))
        ),
        profilePhotoVisibility: v.optional(
          v.union(v.literal("everyone"), v.literal("friends"), v.literal("nobody"))
        ),
        readReceipts: v.optional(v.boolean()),
      })
    ),
    preferences: v.optional(
      v.object({
        language: v.optional(v.union(v.literal("en"), v.literal("es"), v.literal("hi"))),
        density: v.optional(v.union(v.literal("comfortable"), v.literal("compact"))),
      })
    ),
    security: v.optional(
      v.object({
        twoFactorEnabled: v.optional(v.boolean()),
      })
    ),
  },
  handler: withErrorLogging("users.updateUserSettings", async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const existing = (user as any).settings || {
      notifications: { likes: true, comments: true, friendRequests: true, messages: true, sound: true, vibration: true, previews: true },
      privacy: { canMessage: "everyone", postsVisibility: "public", showActiveStatus: true, lastSeenVisibility: "everyone", profilePhotoVisibility: "everyone", readReceipts: true },
      preferences: { language: "en", density: "comfortable" },
      security: { twoFactorEnabled: false },
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
      security: {
        ...existing.security,
        ...(args.security || {}),
      },
    };

    await ctx.db.patch(user._id, { settings: merged });
    return true;
  }),
});

export const getUserByRawId = query({
  args: { rawId: v.string() },
  handler: withErrorLogging("users.getUserByRawId", async (ctx, args) => {
    const id = args.rawId.trim();
    if (!id) return null;
    try {
      const maybeUser = await ctx.db.get(id as any);
      if (maybeUser && (maybeUser as any).email !== undefined) {
        return maybeUser as Doc<"users">;
      }
      return null;
    } catch {
      return null;
    }
  }),
});

export const updateStatus = mutation({
  args: { isOnline: v.boolean() },
  handler: withErrorLogging("users.updateStatus", async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const patch: Record<string, any> = { isOnline: args.isOnline };
    if (!args.isOnline) {
      patch.lastSeen = Date.now();
    }
    await ctx.db.patch(user._id, patch);
    return true;
  }),
});

// Return privacy-respecting last seen data for a user
export const getLastSeen = query({
  args: { userId: v.id("users") },
  handler: withErrorLogging("users.getLastSeen", async (ctx, args) => {
    const viewer = await getCurrentUser(ctx);
    if (!viewer) {
      throw new Error("Not authenticated");
    }
    const target = await ctx.db.get(args.userId);
    if (!target) return { visible: false } as const;

    const settings = (target as any).settings || {};
    const privacy = settings.privacy || {};
    const showActiveStatus: boolean = privacy.showActiveStatus ?? true;
    const lastSeenVisibility: "everyone" | "friends" | "nobody" =
      privacy.lastSeenVisibility ?? "everyone";

    if (!showActiveStatus) {
      return { visible: false } as const;
    }

    if (lastSeenVisibility === "nobody") {
      return { visible: false } as const;
    }

    if (lastSeenVisibility === "friends") {
      return { visible: false } as const;
    }

    const isOnline = !!(target as any).isOnline;
    const lastSeen = (target as any).lastSeen ?? null;
    return { visible: true, isOnline, lastSeen } as const;
  }),
});