import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

export const current = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

export async function getCurrentUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
  return user;
}

export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, {
      name: args.name,
      image: args.image,
    });

    return user._id;
  },
});

export const updateStatus = mutation({
  args: {
    isOnline: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) return;

    const updates: any = { isOnline: args.isOnline };
    if (!args.isOnline) {
      updates.lastSeenAt = Date.now();
    }

    await ctx.db.patch(user._id, updates);
  },
});

export const getUserById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const searchUsers = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) return [];

    const query = args.query.toLowerCase().trim();
    if (query.length < 2) return [];

    const users = await ctx.db.query("users").collect();
    
    return users
      .filter(user => 
        user._id !== currentUser._id &&
        (user.name?.toLowerCase().includes(query) || 
         user.email?.toLowerCase().includes(query))
      )
      .slice(0, 20);
  },
});

export const upsertFromClerk = internalMutation({
  args: {
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", args.tokenIdentifier))
      .unique();

    if (user) {
      await ctx.db.patch(user._id, {
        name: args.name,
        email: args.email,
        image: args.image,
      });
      return user._id;
    } else {
      return await ctx.db.insert("users", {
        tokenIdentifier: args.tokenIdentifier,
        name: args.name,
        email: args.email,
        image: args.image,
        isOnline: false,
      });
    }
  },
});

export const checkUsernameAvailable = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const username = args.username.trim().toLowerCase();
    if (!username) {
      return { available: false, username };
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q: any) => q.eq("username", username))
      .first();

    return { available: !existing, username };
  },
});

export const getUserCounts = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const totalUsers = users.length;
    const onlineUsers = users.filter((u: any) => u.isOnline).length;
    const communitiesCount = 0;
    return { totalUsers, onlineUsers, communitiesCount };
  },
});

// Get a user by username (returns null if none; throws if duplicate usernames exist)
export const getUserByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const doc = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("username"), username))
      .unique();
    return doc;
  },
});

// Update only the display name of the current user
export const updateUserName = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    let user =
      (await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("tokenIdentifier"), identity.tokenIdentifier))
        .unique()) ||
      (identity.email
        ? await ctx.db
            .query("users")
            .filter((q) => q.eq(q.field("email"), identity.email))
            .unique()
        : null);

    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, { name });
  },
});

// Update user profile details (username/name/bio)
export const updateUserProfile = mutation({
  args: v.object({
    username: v.optional(v.string()),
    name: v.optional(v.string()),
    bio: v.optional(v.string()),
  }),
  handler: async (ctx, { username, name, bio }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    let user =
      (await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("tokenIdentifier"), identity.tokenIdentifier))
        .unique()) ||
      (identity.email
        ? await ctx.db
            .query("users")
            .filter((q) => q.eq(q.field("email"), identity.email))
            .unique()
        : null);

    if (!user) throw new Error("User not found");

    const updates: Record<string, unknown> = {};

    if (typeof name === "string" && name.trim()) {
      updates.name = name.trim();
    }

    if (typeof bio === "string") {
      updates.bio = bio;
    }

    if (typeof username === "string" && username.trim()) {
      const newUsername = username.trim().toLowerCase();
      // Ensure uniqueness
      const existing = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("username"), newUsername))
        .collect();

      const taken = existing.some((u) => u._id !== user!._id);
      if (taken) throw new Error("Username already taken");

      updates.username = newUsername;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(user._id, updates);
    }
  },
});

// Update only the profile image URL
export const updateUserImage = mutation({
  args: { image: v.string() },
  handler: async (ctx, { image }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    let user =
      (await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("tokenIdentifier"), identity.tokenIdentifier))
        .unique()) ||
      (identity.email
        ? await ctx.db
            .query("users")
            .filter((q) => q.eq(q.field("email"), identity.email))
            .unique()
        : null);

    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, { image });
  },
});

// Update nested settings (notifications, privacy, preferences, security)
export const updateUserSettings = mutation({
  args: v.object({
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
        canMessage: v.optional(v.string()),
        postsVisibility: v.optional(v.string()),
        showActiveStatus: v.optional(v.boolean()),
        lastSeenVisibility: v.optional(v.string()),
        profilePhotoVisibility: v.optional(v.string()),
        readReceipts: v.optional(v.boolean()),
      })
    ),
    preferences: v.optional(
      v.object({
        language: v.optional(v.string()),
        density: v.optional(v.string()),
      })
    ),
    security: v.optional(
      v.object({
        twoFactorEnabled: v.optional(v.boolean()),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    let user =
      (await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("tokenIdentifier"), identity.tokenIdentifier))
        .unique()) ||
      (identity.email
        ? await ctx.db
            .query("users")
            .filter((q) => q.eq(q.field("email"), identity.email))
            .unique()
        : null);

    if (!user) throw new Error("User not found");

    const current = (user as any).settings || {};
    const merged = {
      notifications: { ...(current.notifications || {}), ...(args.notifications || {}) },
      privacy: { ...(current.privacy || {}), ...(args.privacy || {}) },
      preferences: { ...(current.preferences || {}), ...(args.preferences || {}) },
      security: { ...(current.security || {}), ...(args.security || {}) },
    };

    await ctx.db.patch(user._id, { settings: merged as any });
  },
});