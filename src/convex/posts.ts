import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";
import { withErrorLogging } from "./utils/errors";

// Create a new post
export const createPost = mutation({
  args: {
    content: v.string(),
    images: v.optional(v.array(v.id("_storage"))),
    videos: v.optional(v.array(v.id("_storage"))),
    isPublic: v.optional(v.boolean()),
    // UPDATE: include "only_me" and legacy "private"
    audience: v.optional(
      v.union(
        v.literal("public"),
        v.literal("friends"),
        v.literal("only_me"),
        v.literal("private")
      )
    ),
    tags: v.optional(v.array(v.id("users"))),
    scheduledAt: v.optional(v.number()),
    isDraft: v.optional(v.boolean()),
    location: v.optional(v.string()),
    feeling: v.optional(v.string()),
  },
  handler: withErrorLogging("posts.createPost", async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Normalize audience, supporting legacy "private" but prefer "only_me"
    const audienceRaw =
      args.audience ??
      (args.isPublic === true ? "public" : undefined) ??
      "public";
    const audience = (audienceRaw === "private" ? "only_me" : audienceRaw) as
      | "public"
      | "friends"
      | "only_me";

    const isPublic = audience === "public";

    const now = Date.now();
    const isDraft = args.isDraft ?? false;
    const scheduledAt = args.scheduledAt;
    const isScheduledInFuture = typeof scheduledAt === "number" && scheduledAt > now;

    const status = isDraft || isScheduledInFuture ? "working" : "active";
    const publishedAt = status === "active" ? now : undefined;

    const postId = await ctx.db.insert("posts", {
      userId: user._id,
      content: args.content,
      images: args.images || [],
      videos: args.videos || [],
      likes: [],
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      isPublic,
      audience, // store normalized audience
      tags: args.tags || [],
      scheduledAt,
      isDraft,
      status,
      publishedAt,
      updatedBy: user._id,
      location: args.location,
      feeling: args.feeling,
    });

    return postId;
  }),
});

// Get posts for feed
export const getFeedPosts = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: withErrorLogging("posts.getFeedPosts", async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return [];
    }
    const limit = Math.max(1, Math.min(args.limit ?? 20, 100));

    // Build friend set using accepted friend_requests (both directions)
    const outgoingAccepted = await ctx.db
      .query("friend_requests")
      .withIndex("by_from_and_status", (q: any) => q.eq("from", user._id).eq("status", "accepted"))
      .collect();

    const incomingAccepted = await ctx.db
      .query("friend_requests")
      .withIndex("by_to_and_status", (q: any) => q.eq("to", user._id).eq("status", "accepted"))
      .collect();

    const friendIds = new Set<string>();
    for (const r of outgoingAccepted) friendIds.add(r.to as unknown as string);
    for (const r of incomingAccepted) friendIds.add(r.from as unknown as string);

    // Fetch buckets with indexes:
    // - My posts by_user
    const myPosts = await ctx.db
      .query("posts")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .order("desc")
      .take(limit * 2);

    // - Public posts via by_isPublic
    const publicPosts = await ctx.db
      .query("posts")
      .withIndex("by_isPublic", (q: any) => q.eq("isPublic", true))
      .order("desc")
      .take(limit * 3);

    // - Friends' posts by_user for each friend (cap to avoid overfetch)
    const friendPosts: any[] = [];
    let perFriendCap = Math.max(2, Math.ceil((limit * 2) / Math.max(1, friendIds.size)));
    perFriendCap = Math.min(perFriendCap, 20);
    for (const idStr of friendIds) {
      const rows = await ctx.db
        .query("posts")
        .withIndex("by_user", (q: any) => q.eq("userId", idStr as any))
        .order("desc")
        .take(perFriendCap);
      friendPosts.push(...rows);
      if (friendPosts.length >= limit * 2) break;
    }

    // Merge + filter by visibility rules
    const combined = [...myPosts, ...publicPosts, ...friendPosts];

    const now = Date.now();
    const visible = combined.filter((p: any, idx, arr) => {
      // Dedupe by _id
      const idStr = p._id as unknown as string;
      const firstIdx = arr.findIndex((x: any) => (x._id as unknown as string) === idStr);
      if (firstIdx !== idx) return false;

      const isMine = (p.userId as unknown as string) === (user._id as unknown as string);
      const aud = (p.audience as string) || (p.isPublic ? "public" : "public");
      const normalized = aud === "private" ? "only_me" : aud;

      // Publishing status filter: exclude drafts/working future
      const draft = p.isDraft === true;
      const scheduledFuture = typeof p.scheduledAt === "number" && p.scheduledAt > now;
      const inactive = p.status && p.status !== "active";
      if (draft || scheduledFuture || inactive) return false;

      if (isMine) return true;
      if (p.isPublic === true || normalized === "public") return true;
      if (normalized === "friends") {
        const authorId = p.userId as unknown as string;
        return friendIds.has(authorId);
      }
      if (normalized === "only_me") return false;

      return false;
    });

    // Sort by creation time desc and slice to limit
    const sorted = visible.sort((a: any, b: any) => (b._creationTime || 0) - (a._creationTime || 0)).slice(0, limit);

    // Map to include user and storage URLs
    const postsWithUsers = await Promise.all(
      sorted.map(async (post: any) => {
        const postUser = await ctx.db.get(post.userId);

        const imageUrls = post.images
          ? (await Promise.all(post.images.map(async (fid: any) => (await ctx.storage.getUrl(fid)) || ""))).filter(Boolean)
          : [];

        const videoUrls = post.videos
          ? (await Promise.all(post.videos.map(async (fid: any) => (await ctx.storage.getUrl(fid)) || ""))).filter(Boolean)
          : [];

        return {
          ...post,
          images: imageUrls,
          videos: videoUrls,
          user: postUser,
        };
      })
    );

    return postsWithUsers;
  }),
});

// Get user's posts
export const getUserPosts = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: withErrorLogging("posts.getUserPosts", async (ctx, args) => {
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit || 20);

    const user = await ctx.db.get(args.userId);

    const mapped = await Promise.all(
      posts.map(async (post: any) => {
        const imageUrls = post.images
          ? (await Promise.all(
              post.images.map(async (fid: any) => (await ctx.storage.getUrl(fid)) || "")
            )).filter(Boolean)
          : [];

        const videoUrls = post.videos
          ? (await Promise.all(
              post.videos.map(async (fid: any) => (await ctx.storage.getUrl(fid)) || "")
            )).filter(Boolean)
          : [];

        return {
          ...post,
          images: imageUrls,
          videos: videoUrls,
          user,
        };
      })
    );

    return mapped;
  }),
});

// Like/unlike a post
export const toggleLike = mutation({
  args: {
    postId: v.id("posts"),
  },
  handler: withErrorLogging("posts.toggleLike", async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const post = await ctx.db.get(args.postId);
    if (!post) {
      throw new Error("Post not found");
    }

    const hasLiked = post.likes.includes(user._id);

    if (hasLiked) {
      // Unlike — recompute likes and count authoritatively
      const newLikes = post.likes.filter((id: any) => id !== user._id);
      await ctx.db.patch(args.postId, {
        likes: newLikes,
        likesCount: newLikes.length,
      });
    } else {
      // Like — avoid duplicates and recompute count
      const newLikes = [...post.likes, user._id];
      await ctx.db.patch(args.postId, {
        likes: newLikes,
        likesCount: newLikes.length,
      });

      // Create notification if not own post
      if (post.userId !== user._id) {
        await ctx.db.insert("notifications", {
          userId: post.userId,
          type: "like",
          fromUserId: user._id,
          postId: args.postId,
          isRead: false,
          content: `${user.name || "Someone"} liked your post`,
        });
      }
    }

    return !hasLiked;
  }),
});

// Add comment to post
export const addComment = mutation({
  args: {
    postId: v.id("posts"),
    content: v.string(),
    parentCommentId: v.optional(v.id("comments")),
  },
  handler: withErrorLogging("posts.addComment", async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const post = await ctx.db.get(args.postId);
    if (!post) {
      throw new Error("Post not found");
    }

    const commentId = await ctx.db.insert("comments", {
      postId: args.postId,
      userId: user._id,
      content: args.content,
      likes: [],
      likesCount: 0,
      parentCommentId: args.parentCommentId,
    });

    // Update post comment count
    await ctx.db.patch(args.postId, {
      commentsCount: post.commentsCount + 1,
    });

    // Create notification
    if (post.userId !== user._id) {
      await ctx.db.insert("notifications", {
        userId: post.userId,
        type: "comment",
        fromUserId: user._id,
        postId: args.postId,
        commentId,
        isRead: false,
        content: `${user.name || "Someone"} commented on your post`,
      });
    }

    return commentId;
  }),
});

// Get comments for a post
export const getPostComments = query({
  args: {
    postId: v.id("posts"),
  },
  handler: withErrorLogging("posts.getPostComments", async (ctx, args) => {
    // Fetch all comments for the post using a single index (by_post)
    const allForPost = await ctx.db
      .query("comments")
      .withIndex("by_post", (q: any) => q.eq("postId", args.postId))
      .order("desc")
      .collect();

    // Only keep top-level comments (no parentCommentId)
    const comments = allForPost.filter((c: any) => c.parentCommentId === undefined);

    const commentsWithUsers = await Promise.all(
      comments.map(async (comment: any) => {
        const user = await ctx.db.get(comment.userId);
        
        // Get replies via by_parent index
        const replies = await ctx.db
          .query("comments")
          .withIndex("by_parent", (q: any) => q.eq("parentCommentId", comment._id))
          .collect();

        const repliesWithUsers = await Promise.all(
          replies.map(async (reply: any) => {
            const replyUser = await ctx.db.get(reply.userId);
            return {
              ...reply,
              user: replyUser,
            };
          })
        );

        return {
          ...comment,
          user,
          replies: repliesWithUsers,
        };
      })
    );

    return commentsWithUsers;
  }),
});

// Add: delete a post (owner only) and its comments
export const deletePost = mutation({
  args: { postId: v.id("posts") },
  handler: withErrorLogging("posts.deletePost", async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const post = await ctx.db.get(args.postId);
    if (!post) {
      throw new Error("Post not found");
    }
    if (post.userId !== user._id) {
      throw new Error("Not authorized to delete this post");
    }

    // Delete related comments
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_post", (q: any) => q.eq("postId", args.postId))
      .collect();

    for (const c of comments) {
      await ctx.db.delete(c._id);
    }

    // Delete the post
    await ctx.db.delete(args.postId);
    return true;
  }),
});

// ADD: helper to determine unpublished
function isUnpublished(post: any, now: number) {
  const draft = post.isDraft === true;
  const scheduledFuture = typeof post.scheduledAt === "number" && post.scheduledAt > now;
  const inactiveStatus = post.status && post.status !== "active";
  return draft || scheduledFuture || inactiveStatus;
}

// Add: publish a single post (owner only)
export const publishPost = mutation({
  args: {
    postId: v.id("posts"),
    targetStatus: v.optional(v.union(v.literal("working"), v.literal("active"))),
  },
  handler: withErrorLogging("posts.publishPost", async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Post not found");
    if (post.userId !== user._id) throw new Error("Not authorized to publish this post");

    const now = Date.now();
    if (!isUnpublished(post, now)) {
      // Already active/published
      return { updated: false, message: "Post is already active." };
    }

    const target = args.targetStatus ?? "active";
    await ctx.db.patch(args.postId, {
      isDraft: false,
      scheduledAt: undefined,
      status: target,
      publishedAt: now,
      updatedBy: user._id,
    });

    return { updated: true, message: `Post moved to ${target}.` };
  }),
});

// Add: get count of current user's unpublished posts
export const getMyUnpublishedCount = query({
  args: {},
  handler: withErrorLogging("posts.getMyUnpublishedCount", async (ctx, _args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return { count: 0 };

    const now = Date.now();
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .collect();

    const count = posts.reduce((acc: number, p: any) => (isUnpublished(p, now) ? acc + 1 : acc), 0);
    return { count };
  }),
});

// Add: publish all of current user's unpublished posts
export const publishAllMyUnpublished = mutation({
  args: {
    targetStatus: v.optional(v.union(v.literal("working"), v.literal("active"))),
  },
  handler: withErrorLogging("posts.publishAllMyUnpublished", async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const now = Date.now();
    let updated = 0;

    const posts = await ctx.db
      .query("posts")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .collect();

    for (const p of posts) {
      if (isUnpublished(p, now)) {
        await ctx.db.patch(p._id, {
          isDraft: false,
          scheduledAt: undefined,
          status: args.targetStatus ?? "active",
          publishedAt: now,
          updatedBy: user._id,
        });
        updated += 1;
      }
    }

    return { updated, message: `Moved ${updated} item(s) to ${args.targetStatus ?? "active"}.` };
  }),
});

// ADD: Share a post (increments counter and notifies author)
export const sharePost = mutation({
  args: { postId: v.id("posts") },
  handler: withErrorLogging("posts.sharePost", async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Post not found");

    await ctx.db.patch(args.postId, {
      sharesCount: (post.sharesCount ?? 0) + 1,
    });

    // notify post owner if not self
    if (post.userId !== user._id) {
      await ctx.db.insert("notifications", {
        userId: post.userId,
        type: "mention", // reuse a safe type; customize if needed
        fromUserId: user._id,
        postId: args.postId,
        isRead: false,
        content: `${user.name || "Someone"} shared your post`,
      });
    }

    return true;
  }),
});

// Add: edit a post (owner only)
export const editPost = mutation({
  args: {
    postId: v.id("posts"),
    content: v.string(),
    location: v.optional(v.string()),
    feeling: v.optional(v.string()),
  },
  handler: withErrorLogging("posts.editPost", async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Post not found");
    if (post.userId !== user._id) throw new Error("Not authorized to edit this post");

    await ctx.db.patch(args.postId, {
      content: args.content,
      location: args.location,
      feeling: args.feeling,
      updatedBy: user._id,
      // keep publishedAt/status unchanged
    });
    return true;
  }),
});