import { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function Stories() {
  const { user } = useAuth();
  const friends = useQuery(api.friends.getUserFriends, {});
  const list = useMemo(() => (Array.isArray(friends) ? friends.filter(Boolean) : []), [friends]);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground">Stories</h3>
        <Button variant="ghost" size="sm" className="text-[#1877F2] hover:text-[#166FE5]">See All</Button>
      </div>
      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-1">
          {/* Your Story */}
          <button
            className="group relative w-28 h-44 shrink-0 rounded-xl overflow-hidden border bg-muted/40"
            title="Add to story"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-black/0 to-black/30" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Avatar className="h-14 w-14 ring-2 ring-white">
                <AvatarImage src={user?.image} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {user?.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="absolute bottom-2 left-2 right-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-[#1877F2] text-white">
                  <Plus className="h-4 w-4" />
                </span>
                <span className="text-xs font-medium text-white drop-shadow">Create</span>
              </div>
            </div>
          </button>

          {/* Friends' Stories (mocked from friends list) */}
          {list.slice(0, 12).map((f: any) => {
            const id = f?._id as string;
            const name = f?.name || "Friend";
            return (
              <div key={id} className="relative w-28 h-44 shrink-0 rounded-xl overflow-hidden border bg-muted/40">
                <img
                  src={f?.image || "/logo.png"}
                  alt={name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/40" />
                <div className="absolute top-2 left-2">
                  <Avatar className="h-8 w-8 ring-2 ring-white">
                    <AvatarImage src={f?.image} />
                    <AvatarFallback className="bg-muted text-[10px]">
                      {name?.charAt(0) || "F"}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="absolute bottom-2 left-2 right-2">
                  <p className="text-[11px] font-medium text-white line-clamp-2 drop-shadow">{name}</p>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
