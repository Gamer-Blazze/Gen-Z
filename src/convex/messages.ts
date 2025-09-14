import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { internal } from "./_generated/api";

export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.optional(v.string()),
    type: v.union(v.literal("text"), v.literal("image"), v.literal("video"), v.literal("file")),
    images: v.optional(v.array(v.string())),
    videos: v.optional(v.array(v.string())),
    files: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new Error("User not found");

    // Validation
    if (!args.content && !args.images?.length && !args.videos?.length && !args.files?.length) {
      throw new Error("Message must have content or media");
    }
    if (args.content && args.content.length > 5000) {
      throw new Error("Message too long");
    }
    const totalMedia = (args.images?.length || 0) + (args.videos?.length || 0) + (args.files?.length || 0);
    if (totalMedia > 8) {
      throw new Error("Too many media attachments");
    }

    // Verify conversation exists and user is participant
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");
    if (!conversation.participants.includes(user._id)) {
      throw new Error("Not a participant in this conversation");
    }

    // Create message
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: user._id,
      content: args.content?.trim(),
      type: args.type,
      images: args.images,
      videos: args.videos,
      files: args.files,
      seenBy: { [user._id]: Date.now() },
    });

    // Update conversation
    const preview = args.content?.trim() || 
      (args.images?.length ? "📷 Photo" : "") ||
      (args.videos?.length ? "🎥 Video" : "") ||
      (args.files?.length ? "📎 File" : "");

    await ctx.db.patch(args.conversationId, {
      lastMessageAt: Date.now(),
      lastMessagePreview: preview,
      lastSenderId: user._id,
    });

    // Create notifications for other participants
    const otherParticipants = conversation.participants.filter(id => id !== user._id);
    for (const participantId of otherParticipants) {
      await ctx.db.insert("notifications", {
        userId: participantId,
        type: "message",
        content: `${user.name || "Someone"} sent you a message: ${preview}`,
        isRead: false,
        relatedId: args.conversationId,
      });
    }

    return messageId;
  },
});

export const getMessages = query({
  args: {
    conversationId: v.id("conversations"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return null;

    // Verify user is participant
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || !conversation.participants.includes(user._id)) {
      return null;
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("desc")
      .paginate(args.paginationOpts);

    // Resolve media URLs
    const messagesWithUrls = await Promise.all(
      messages.page.map(async (message) => {
        const imageUrls = message.images ? await Promise.all(
          message.images.map(id => ctx.storage.getUrl(id))
        ) : [];
        const videoUrls = message.videos ? await Promise.all(
          message.videos.map(id => ctx.storage.getUrl(id))
        ) : [];
        const fileUrls = message.files ? await Promise.all(
          message.files.map(async (id) => {
            const url = await ctx.storage.getUrl(id);
            const fileDoc = await ctx.db
              .query("files")
              .filter(q => q.eq(q.field("storageId"), id))
              .first();
            return { url, name: fileDoc?.name, size: fileDoc?.size };
          })
        ) : [];

        return {
          ...message,
          imageUrls: imageUrls.filter(Boolean),
          videoUrls: videoUrls.filter(Boolean),
          fileUrls: fileUrls.filter(f => f.url),
        };
      })
    );

    return {
      ...messages,
      page: messagesWithUrls,
    };
  },
});

export const markSeen = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new Error("User not found");

    // Get latest messages in conversation
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("desc")
      .take(10);

    const now = Date.now();
    for (const message of messages) {
      if (message.senderId !== user._id) {
        const seenBy = message.seenBy || {};
        if (!seenBy[user._id]) {
          seenBy[user._id] = now;
          await ctx.db.patch(message._id, { seenBy });
        }
      }
    }
  },
});

export const setTyping = mutation({
  args: {
    conversationId: v.id("conversations"),
    isTyping: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new Error("User not found");

    const existing = await ctx.db
      .query("typing")
      .withIndex("by_conversation_and_user", (q) => 
        q.eq("conversationId", args.conversationId).eq("userId", user._id)
      )
      .unique();

    if (args.isTyping) {
      const expiresAt = Date.now() + 8000; // 8 seconds
      if (existing) {
        await ctx.db.patch(existing._id, { expiresAt });
      } else {
        await ctx.db.insert("typing", {
          conversationId: args.conversationId,
          userId: user._id,
          expiresAt,
        });
      }
    } else if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const getTyping = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const now = Date.now();
    const typing = await ctx.db
      .query("typing")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    const activeTyping = typing.filter(t => t.expiresAt > now);
    
    // Get user details for active typers
    const typers = await Promise.all(
      activeTyping.map(async (t) => {
        const user = await ctx.db.get(t.userId);
        return user ? { _id: user._id, name: user.name } : null;
      })
    );

    return typers.filter(Boolean);
  },
});

export const getUserConversations = query({
  args: {},
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return [];

    // Get conversations via participant relationship
    const participantRecords = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const conversations = await Promise.all(
      participantRecords.map(async (record) => {
        const conversation = await ctx.db.get(record.conversationId);
        if (!conversation) return null;

        // Get other participants
        const otherParticipants = await Promise.all(
          conversation.participants
            .filter(id => id !== user._id)
            .map(id => ctx.db.get(id))
        );

        // Get last message
        const lastMessage = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
          .order("desc")
          .first();

        return {
          ...conversation,
          otherParticipants: otherParticipants.filter(Boolean),
          lastMessage,
        };
      })
    );

    return conversations
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
      .sort((a, b) => ((b?.lastMessageAt || 0) - (a?.lastMessageAt || 0)));
  },
});

export const getOrCreateConversation = mutation({
  args: {
    participantIds: v.array(v.id("users")),
    isGroup: v.boolean(),
    groupName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new Error("User not found");

    const allParticipants = [user._id, ...args.participantIds];

    // For 1-on-1 chats, check if conversation already exists
    if (!args.isGroup && args.participantIds.length === 1) {
      const otherUserId = args.participantIds[0];
      
      // Find existing conversation between these two users
      const userParticipants = await ctx.db
        .query("conversationParticipants")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect();

      for (const record of userParticipants) {
        const conversation = await ctx.db.get(record.conversationId);
        if (conversation && 
            !conversation.isGroup && 
            conversation.participants.length === 2 &&
            conversation.participants.includes(otherUserId)) {
          return conversation._id;
        }
      }
    }

    // Create new conversation
    const conversationId = await ctx.db.insert("conversations", {
      participants: allParticipants,
      isGroup: args.isGroup,
      groupName: args.groupName,
    });

    // Create participant records
    for (const participantId of allParticipants) {
      await ctx.db.insert("conversationParticipants", {
        conversationId,
        userId: participantId,
      });
    }

    return conversationId;
  },
});