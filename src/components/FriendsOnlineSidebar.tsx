import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import type { Id } from "@/convex/_generated/dataModel";

type FriendDoc = {
  _id: string;
  name?: string;
  image?: string;
  isOnline?: boolean;
  lastSeen?: number | null;
};

function formatLastActive(ts: number | null | undefined): string {
  if (!ts) return "Last active recently";
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Last active just now";
  if (mins < 60) return `Last active ${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Last active ${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `Last active ${days} day${days === 1 ? "" : "s"} ago`;
}

export default function FriendsOnlineSidebar({ conversationId }: { conversationId?: Id<"conversations"> | null }) {
  const friends = useQuery(api.friends.getUserFriends, {});
  const navigate = useNavigate();

  const raw = Array.isArray(friends) ? friends.filter((f): f is NonNullable<typeof f> => !!f) : [];
  const list: Array<FriendDoc> = raw.map((f) => ({
    _id: (f._id as unknown as string),
    name: f.name,
    image: f.image,
    isOnline: (f as any).isOnline,
    lastSeen: (f as any).lastSeen ?? null,
  }));

  const online = list.filter((f) => !!f?.isOnline);
  const offline = list
    .filter((f) => !f?.isOnline)
    .sort((a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0));

  const sorted = [...online, ...offline];
  const onlineCount = online.length;

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b bg-white/80 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Friends Online</h3>
          <span className="text-xs text-muted-foreground">
            {onlineCount} Online
          </span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1.5">
          {sorted.length === 0 ? (
            <div className="text-xs text-muted-foreground p-3 text-center">
              No friends yet.
            </div>
          ) : (
            sorted.map((f) => {
              const name = f?.name || "Anonymous";
              const isOnline = !!f?.isOnline;
              const lastSeenText = isOnline ? "Online now" : formatLastActive(f?.lastSeen ?? null);
              return (
                <motion.button
                  key={f._id}
                  onClick={() => navigate(`/profile?id=${f._id}`)}
                  className="w-full flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/60 transition-colors text-left"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={f.image} />
                      <AvatarFallback className="bg-muted text-xs">
                        {name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white ${
                        isOnline ? "bg-green-500" : "bg-zinc-300"
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{name}</div>
                    <div
                      className={`truncate text-[11px] ${
                        isOnline ? "text-green-600" : "text-muted-foreground"
                      }`}
                    >
                      {lastSeenText}
                    </div>
                  </div>
                </motion.button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
