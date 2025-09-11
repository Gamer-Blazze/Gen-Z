import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";
import { withErrorLogging } from "./utils/errors";

// Create or get conversation between users
export const getOrCreateConversation = mutation({
  args: {
    participantIds: v.array(v.id("users")),
    isGroup: v.optional(v.boolean()),
    groupName: v.optional(v.string()),
  },
  handler: withErrorLogging("messages.getOrCreateConversation", async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const participants = [user._id, ...args.participantIds].sort();
    
    if (!args.isGroup && participants.length === 2) {
      // Check if conversation already exists
      const existingConversation = await ctx.db
        .query("conversations")
        .filter((q: any) => 
          q.and(
            q.eq(q.field("isGroup"), false),
            q.eq(q.field("participants"), participants)
          )
        )
        .first();

      if (existingConversation) {
        return existingConversation._id;
      }
    }

    // Create new conversation
    const conversationId = await ctx.db.insert("conversations", {
      participants,
      isGroup: args.isGroup || false,
      groupName: args.groupName,
      createdBy: user._id,
    });

    return conversationId;
  }),
});

// Send message
export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    messageType: v.optional(v.union(v.literal("text"), v.literal("image"), v.literal("file"), v.literal("audio"))),
    imageUrl: v.optional(v.string()),
    fileUrl: v.optional(v.string()),
    fileName: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
    audioDuration: v.optional(v.number()),
  },
  handler: withErrorLogging("messages.sendMessage", async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Check if user is participant
    if (!conversation.participants.includes(user._id)) {
      throw new Error("Not authorized");
    }

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: user._id,
      content: args.content,
      messageType: args.messageType || "text",
      imageUrl: args.imageUrl,
      fileUrl: args.fileUrl,
      fileName: args.fileName,
      audioUrl: args.audioUrl,
      audioDuration: args.audioDuration,
      readBy: [{
        userId: user._id,
        readAt: Date.now(),
      }],
      isEdited: false,
    });

    // Update conversation
    await ctx.db.patch(args.conversationId, {
      lastMessageId: messageId,
      lastMessageTime: Date.now(),
    });

    // Create notifications for other participants
    const otherParticipants = conversation.participants.filter((id: any) => id !== user._id);
    for (const participantId of otherParticipants) {
      await ctx.db.insert("notifications", {
        userId: participantId,
        type: "message",
        fromUserId: user._id,
        conversationId: args.conversationId,
        isRead: false,
        content: `${user.name || "Someone"} sent you a message`,
      });
    }

    return messageId;
  }),
});

// Get user's conversations
export const getUserConversations = query({
  args: {},
  handler: withErrorLogging("messages.getUserConversations", async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return [];
    }

    const allConversations = await ctx.db
      .query("conversations")
      .collect();

    // Filter conversations where user is a participant
    const conversations = allConversations.filter((conv: any) => 
      conv.participants.includes(user._id)
    );

    const conversationsWithDetails = await Promise.all(
      conversations.map(async (conversation: any) => {
        let otherParticipants: any[] = [];
        
        if (!conversation.isGroup) {
          const otherParticipantIds = conversation.participants.filter((id: any) => id !== user._id);
          otherParticipants = await Promise.all(
            otherParticipantIds.map((id: any) => ctx.db.get(id))
          );
        }

        let lastMessage = null;
        if (conversation.lastMessageId) {
          lastMessage = await ctx.db.get(conversation.lastMessageId);
          if (lastMessage) {
            const sender = await ctx.db.get(lastMessage.senderId);
            lastMessage = { ...lastMessage, sender };
          }
        }

        return {
          ...conversation,
          otherParticipants: otherParticipants.filter(Boolean),
          lastMessage,
        };
      })
    );

    return conversationsWithDetails;
  }),
});

// Get messages for conversation
export const getConversationMessages = query({
  args: {
    conversationId: v.id("conversations"),
    limit: v.optional(v.number()),
  },
  handler: withErrorLogging("messages.getConversationMessages", async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return [];
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || !conversation.participants.includes(user._id)) {
      return [];
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q: any) => q.eq("conversationId", args.conversationId))
      .order("desc")
      .take(args.limit || 50);

    const messagesWithSenders = await Promise.all(
      messages.map(async (message: any) => {
        const sender = await ctx.db.get(message.senderId);
        return {
          ...message,
          sender,
        };
      })
    );

    return messagesWithSenders.reverse();
  }),
});

// Mark messages as read
export const markMessagesAsRead = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: withErrorLogging("messages.markMessagesAsRead", async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q: any) => q.eq("conversationId", args.conversationId))
      .collect();

    for (const message of messages) {
      const hasRead = message.readBy.some((read: any) => read.userId === user._id);
      if (!hasRead) {
        await ctx.db.patch(message._id, {
          readBy: [...message.readBy, {
            userId: user._id,
            readAt: Date.now(),
          }],
        });
      }
    }
  }),
});