 // Lightweight wrapper to log and rethrow errors without changing return shapes.
export function withErrorLogging(
  name: string,
  fn: (ctx: any, args: any) => Promise<any>
) {
  return async (ctx: any, args: any): Promise<any> => {
    try {
      return await fn(ctx, args);
    } catch (err: any) {
      try {
        const identity =
          (await ctx?.auth?.getUserIdentity?.()) || { tokenIdentifier: "anonymous" };
        console.error(
          `[Convex] ${name} error`,
          {
            user: identity?.tokenIdentifier ?? "anonymous",
            message: err?.message ?? String(err),
          }
        );
      } catch {
        console.error(`[Convex] ${name} error`, err?.message ?? String(err));
      }
      throw err;
    }
  };
}
