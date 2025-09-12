import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

auth.addHttpRoutes(http);

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

const checkUsername = httpAction(async (ctx, req) => {
  const url = new URL(req.url);
  const raw = url.searchParams.get("username") || "";
  const username = raw.trim().toLowerCase();

  // Validation errors return 400
  if (!username) {
    return json({ error: "username is required", available: false }, 400);
  }
  if (!/^[a-z0-9._-]{3,20}$/.test(username)) {
    return json(
      {
        error:
          "invalid username: must be 3-20 chars (a-z, 0-9, ., _, -)",
        available: false,
      },
      400
    );
  }

  try {
    const result = await ctx.runQuery(api.users.checkUsernameAvailable, { username });
    return json(result, 200);
  } catch (err: any) {
    // Server errors return 500
    console.error("[HTTP] /check-username error", err?.message || String(err));
    return json({ error: "internal_error", available: false }, 500);
  }
});

http.route({
  path: "/check-username",
  method: "GET",
  handler: checkUsername,
});

export default http;