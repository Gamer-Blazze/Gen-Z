import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users with commonly used indexes
  users: defineTable({
    tokenIdentifier: v.optional(v.string()),
    username: v.optional(v.string()),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    coverImage: v.optional(v.string()),
    bio: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    isOnline: v.optional(v.boolean()),
    lastSeenAt: v.optional(v.number()),
    // Legacy field for backward compatibility with existing data
    lastSeen: v.optional(v.number()),
    // Add optional settings for backward compatibility with existing data
    settings: v.optional(
      v.object({
        notifications: v.optional(
          v.object({
            comments: v.optional(v.boolean()),
            friendRequests: v.optional(v.boolean()),
            likes: v.optional(v.boolean()),
            messages: v.optional(v.boolean()),
            previews: v.optional(v.boolean()),
            sound: v.optional(v.boolean()),
            vibration: v.optional(v.boolean()),
          })
        ),
        preferences: v.optional(
          v.object({
            density: v.optional(v.string()),
            language: v.optional(v.string()),
          })
        ),
        privacy: v.optional(
          v.object({
            canMessage: v.optional(v.string()),
            lastSeenVisibility: v.optional(v.string()),
            postsVisibility: v.optional(v.string()),
            profilePhotoVisibility: v.optional(v.string()),
            readReceipts: v.optional(v.boolean()),
            showActiveStatus: v.optional(v.boolean()),
          })
        ),
        security: v.optional(
          v.object({
            twoFactorEnabled: v.optional(v.boolean()),
          })
        ),
      })
    ),
  })
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_username", ["username"])
    .index("by_name", ["name"])
    .index("email", ["email"])
    .index("by_isOnline", ["isOnline"]),

  // Conversations and relationship table
  conversations: defineTable({
    participants: v.array(v.id("users")),
    isGroup: v.boolean(),
    groupName: v.optional(v.string()),
    groupImage: v.optional(v.string()),
    lastMessageAt: v.optional(v.number()),
    lastMessagePreview: v.optional(v.string()),
    lastSenderId: v.optional(v.id("users")),
    // Backward-compatible fields present in existing data
    createdBy: v.optional(v.id("users")),
    lastMessageId: v.optional(v.id("messages")),
    lastMessageTime: v.optional(v.number()),
  }).index("by_lastMessageAt", ["lastMessageAt"]),

  conversationParticipants: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
  })
    .index("by_userId", ["userId"])
    .index("by_conversationId", ["conversationId"]),

  // Messages with indexes
  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    content: v.optional(v.string()),
    // Make `type` optional for backward compatibility with legacy data
    type: v.optional(
      v.union(
        v.literal("text"),
        v.literal("image"),
        v.literal("video"),
        v.literal("file")
      )
    ),
    // Accept legacy fields for existing documents
    messageType: v.optional(v.string()),
    isEdited: v.optional(v.boolean()),
    readBy: v.optional(
      v.array(
        v.object({
          userId: v.id("users"),
          readAt: v.number(),
        })
      )
    ),
    images: v.optional(v.array(v.string())), // storage IDs
    imageUrl: v.optional(v.string()),
    videos: v.optional(v.array(v.string())), // storage IDs
    videoUrl: v.optional(v.string()),
    files: v.optional(v.array(v.string())), // storage IDs
    fileUrl: v.optional(v.string()),
    seenBy: v.optional(v.record(v.string(), v.number())), // userId -> timestamp
  })
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_and_sender", ["conversationId", "senderId"])
    .index("by_sender", ["senderId"]),

  // Typing indicators
  typing: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    expiresAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_and_user", ["conversationId", "userId"]),

  // Notifications with fields referenced across the app
  notifications: defineTable({
    userId: v.id("users"),
    type: v.string(), // allow flexible types used in code (e.g., "friend_accepted", "mention", etc.)
    content: v.string(),
    isRead: v.boolean(),
    fromUserId: v.optional(v.id("users")),
    postId: v.optional(v.id("posts")),
    commentId: v.optional(v.id("comments")),
    relatedId: v.optional(v.string()),
    // Add for backward compatibility with existing data
    conversationId: v.optional(v.id("conversations")),
  })
    .index("by_user", ["userId"])
    .index("by_read_status", ["userId", "isRead"]),

  // Friend requests (single-table pattern)
  friend_requests: defineTable({
    from: v.id("users"),
    to: v.id("users"),
    // Add "rejected" for backward compatibility with existing data
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("rejected")),
  })
    .index("by_from_and_to", ["from", "to"])
    .index("by_from_and_status", ["from", "status"])
    .index("by_to_and_status", ["to", "status"]),

  // Follows (one-way follow)
  follows: defineTable({
    followerId: v.id("users"),
    followingId: v.id("users"),
  })
    .index("by_follower_and_following", ["followerId", "followingId"])
    .index("by_follower", ["followerId"])
    .index("by_following", ["followingId"]),

  // Posts as expected by posts.ts
  posts: defineTable({
    userId: v.id("users"),
    content: v.string(),
    images: v.optional(v.array(v.id("_storage"))),
    videos: v.optional(v.array(v.id("_storage"))),
    likes: v.optional(v.array(v.id("users"))),
    likesCount: v.optional(v.number()),
    commentsCount: v.optional(v.number()),
    sharesCount: v.optional(v.number()),
    isPublic: v.optional(v.boolean()),
    audience: v.optional(v.union(v.literal("public"), v.literal("friends"), v.literal("only_me"))),
    tags: v.optional(v.array(v.id("users"))),
    scheduledAt: v.optional(v.number()),
    isDraft: v.optional(v.boolean()),
    status: v.optional(v.union(v.literal("working"), v.literal("active"))),
    publishedAt: v.optional(v.number()),
    updatedBy: v.optional(v.id("users")),
    location: v.optional(v.string()),
    feeling: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_isPublic", ["isPublic"]),

  // Comments for posts
  comments: defineTable({
    postId: v.id("posts"),
    userId: v.id("users"),
    content: v.string(),
    likes: v.optional(v.array(v.id("users"))),
    likesCount: v.optional(v.number()),
    parentCommentId: v.optional(v.id("comments")),
  })
    .index("by_post", ["postId"])
    .index("by_parent", ["parentCommentId"]),

  // Calls aligned with calls.ts usage
  calls: defineTable({
    conversationId: v.id("conversations"),
    callerId: v.id("users"),
    calleeId: v.id("users"),
    type: v.union(v.literal("voice"), v.literal("video")),
    status: v.union(v.literal("ringing"), v.literal("accepted"), v.literal("declined"), v.literal("ended")),
    startedAt: v.optional(v.number()),
    acceptedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
  }).index("by_conversation", ["conversationId"]),

  // Call signaling messages
  call_signals: defineTable({
    callId: v.id("calls"),
    toUserId: v.id("users"),
    fromUserId: v.id("users"),
    signalType: v.union(
      v.literal("offer"),
      v.literal("answer"),
      v.literal("candidate"),
      v.literal("accept"),
      v.literal("end")
    ),
    payload: v.string(),
    createdAt: v.number(),
  }).index("by_call_and_to", ["callId", "toUserId"]),

  // Files metadata
  files: defineTable({
    storageId: v.string(),
    name: v.string(),
    type: v.string(),
    size: v.number(),
    uploaderId: v.id("users"),
  }).index("by_uploader", ["uploaderId"]),
});