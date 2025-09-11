import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

auth.addHttpRoutes(http);

const checkUsername = httpAction(async (ctx, req) => {
  const url = new URL(req.url);
  const username = url.searchParams.get("username") || "";
  try {
    const result = await ctx.runQuery(api.users.checkUsernameAvailable, { username });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    return new Response(JSON.stringify({ available: false }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
});

http.route({
  path: "/check-username",
  method: "GET",
  handler: checkUsername,
});

export default http;