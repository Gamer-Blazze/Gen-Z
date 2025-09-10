"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

export const generateUploadUrl = action({
  args: {},
  handler: async (ctx) => {
    const url = await ctx.storage.generateUploadUrl();
    return url;
  },
});

// Add: resolve a signed URL from a fileId
export const getFileUrl = action({
  args: { fileId: v.id("_storage") },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.fileId);
    if (!url) {
      throw new Error("File not found");
    }
    return url;
  },
});