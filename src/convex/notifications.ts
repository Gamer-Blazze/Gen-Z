import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getCurrentUser } from "./users";

// Fetch current user's notifications (latest first)
export const getMyNotifications = query({
  args: {
    limit: v.optional(v.number()),
    unreadOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    // If unreadOnly, use composite index by_read_status; else use by_user
    if (args.unreadOnly) {
      const unread = await ctx.db
        .query("notifications")
        .withIndex("by_read_status", (q) => q.eq("userId", user._id).eq("isRead", false))
        .order("desc")
        .take(args.limit || 50);

      const enriched = await Promise.all(
        unread.map(async (n) => {
          const fromUser = await ctx.db.get(n.fromUserId);
          return { ...n, fromUser };
        })
      );
      return enriched;
    }

    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(args.limit || 50);

    const enriched = await Promise.all(
      rows.map(async (n) => {
        const fromUser = await ctx.db.get(n.fromUserId);
        return { ...n, fromUser };
      })
    );
    return enriched;
  },
});

// Mark a single notification as read
export const markAsRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const notif = await ctx.db.get(args.notificationId);
    if (!notif) throw new Error("Notification not found");
    if (notif.userId !== user._id) throw new Error("Not authorized");

    if (!notif.isRead) {
      await ctx.db.patch(args.notificationId, { isRead: true });
    }
    return true;
  },
});

// Mark all notifications as read
export const markAllAsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // Use index by_read_status for efficient unread scan
    for await (const n of ctx.db
      .query("notifications")
      .withIndex("by_read_status", (q) => q.eq("userId", user._id).eq("isRead", false))) {
      await ctx.db.patch(n._id, { isRead: true });
    }
    return true;
  },
});
