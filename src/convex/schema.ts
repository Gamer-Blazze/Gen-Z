import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
      
      // Additional fields for social media
      bio: v.optional(v.string()),
      location: v.optional(v.string()),
      website: v.optional(v.string()),
      coverImage: v.optional(v.string()),
      isOnline: v.optional(v.boolean()),
      lastSeen: v.optional(v.number()),
    }).index("email", ["email"]).index("by_isOnline", ["isOnline"]), // index for the email. do not remove or modify; add index for online users

    // Posts table
    posts: defineTable({
      userId: v.id("users"),
      content: v.string(),
      // CHANGED: store Convex storage file ids for images/videos
      images: v.optional(v.array(v.id("_storage"))),
      likes: v.array(v.id("users")),
      likesCount: v.number(),
      commentsCount: v.number(),
      sharesCount: v.number(),
      isPublic: v.boolean(),
      // ADD: videos support
      videos: v.optional(v.array(v.id("_storage"))),
    }).index("by_user", ["userId"]),

    // Comments table
    comments: defineTable({
      postId: v.id("posts"),
      userId: v.id("users"),
      content: v.string(),
      likes: v.array(v.id("users")),
      likesCount: v.number(),
      parentCommentId: v.optional(v.id("comments")), // for nested comments
    }).index("by_post", ["postId"])
      .index("by_user", ["userId"])
      .index("by_parent", ["parentCommentId"]),

    // Friend requests table for simple tracking of request lifecycle
    friend_requests: defineTable({
      from: v.id("users"),
      to: v.id("users"),
      status: v.union(
        v.literal("pending"),
        v.literal("accepted"),
        v.literal("declined"),
        // Add: support "rejected" status as requested (keep "declined" for compatibility)
        v.literal("rejected")
      ),
    })
      .index("by_to", ["to"])
      .index("by_from", ["from"])
      .index("by_status", ["status"])
      .index("by_from_and_to", ["from", "to"]),

    // Friend requests and friendships
    friendships: defineTable({
      userId1: v.id("users"),
      userId2: v.id("users"),
      status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("blocked")),
      requesterId: v.id("users"), // who sent the request
    }).index("by_user1", ["userId1"])
      .index("by_user2", ["userId2"])
      .index("by_status", ["status"]),

    // Conversations for messaging
    conversations: defineTable({
      participants: v.array(v.id("users")),
      lastMessageId: v.optional(v.id("messages")),
      lastMessageTime: v.optional(v.number()),
      isGroup: v.boolean(),
      groupName: v.optional(v.string()),
      groupImage: v.optional(v.string()),
      createdBy: v.id("users"),
    }).index("by_participant", ["participants"]),

    // Messages table
    messages: defineTable({
      conversationId: v.id("conversations"),
      senderId: v.id("users"),
      content: v.string(),
      messageType: v.union(v.literal("text"), v.literal("image"), v.literal("file")),
      imageUrl: v.optional(v.string()),
      fileUrl: v.optional(v.string()),
      fileName: v.optional(v.string()),
      readBy: v.array(v.object({
        userId: v.id("users"),
        readAt: v.number(),
      })),
      isEdited: v.boolean(),
      editedAt: v.optional(v.number()),
    }).index("by_conversation", ["conversationId"])
      .index("by_sender", ["senderId"]),

    // Notifications table
    notifications: defineTable({
      userId: v.id("users"),
      type: v.union(
        v.literal("like"),
        v.literal("comment"),
        v.literal("friend_request"),
        v.literal("friend_accepted"),
        v.literal("message"),
        v.literal("mention")
      ),
      fromUserId: v.id("users"),
      postId: v.optional(v.id("posts")),
      commentId: v.optional(v.id("comments")),
      conversationId: v.optional(v.id("conversations")),
      isRead: v.boolean(),
      content: v.string(),
    }).index("by_user", ["userId"])
      .index("by_read_status", ["userId", "isRead"]),

    // Calls for voice/video between 1:1 participants
    calls: defineTable({
      conversationId: v.id("conversations"),
      callerId: v.id("users"),
      calleeId: v.id("users"),
      type: v.union(v.literal("voice"), v.literal("video")),
      status: v.union(v.literal("ringing"), v.literal("accepted"), v.literal("ended")),
      startedAt: v.number(),
      acceptedAt: v.optional(v.number()),
      endedAt: v.optional(v.number()),
    })
      .index("by_conversation", ["conversationId"])
      .index("by_callee", ["calleeId"])
      .index("by_caller", ["callerId"]),

    // Signaling messages for WebRTC
    call_signals: defineTable({
      callId: v.id("calls"),
      toUserId: v.id("users"),
      fromUserId: v.id("users"),
      signalType: v.union(
        v.literal("offer"),
        v.literal("answer"),
        v.literal("candidate"),
        v.literal("accept"),
        v.literal("end"),
      ),
      payload: v.string(), // stringified JSON
      createdAt: v.number(),
    })
      .index("by_call_and_to", ["callId", "toUserId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;