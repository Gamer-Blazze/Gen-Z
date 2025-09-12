import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, UserPlus, Clapperboard } from "lucide-react";
import { motion } from "framer-motion";
import { useMutation } from "convex/react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useNavigate } from "react-router";

export function FriendsSidebar() {
  const friends = useQuery(api.friends.getUserFriends, {});
  const friendRequests = useQuery(api.friends.getPendingFriendRequests, {});
  const acceptFriend = useMutation(api.friends.acceptFriendRequest);
  const declineFriend = useMutation(api.friends.declineFriendRequest);
  const sendFriend = useMutation(api.friends.sendFriendRequest);

  const [search, setSearch] = useState("");
  const searchResults = useQuery(
    api.friends.searchUsers,
    search.trim().length >= 2 ? { query: search.trim() } : "skip"
  );

  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="w-80 p-4 space-y-4"
    >
      {/* Reels quick access */}
      <Card>
        <CardContent className="py-3">
          <Button
            className="w-full justify-center gap-2"
            onClick={() => navigate("/reels")}
            aria-label="Open Reels"
          >
            <Clapperboard className="w-4 h-4" />
            Watch Reels
          </Button>
        </CardContent>
      </Card>

      {/* Friend Requests */}
      {friendRequests && friendRequests.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Friend Requests
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {friendRequests.slice(0, 3).map((request: any) => (
              <div key={request._id} className="flex items-center gap-3">
                <button
                  onClick={() => request.requester?._id && navigate(`/profile?id=${request.requester._id}`)}
                  className="shrink-0"
                  aria-label="View profile"
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={request.requester?.image} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {request.requester?.name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                </button>
                <div className="flex-1 min-w-0">
                  <p
                    className="font-medium text-sm truncate cursor-pointer hover:underline"
                    onClick={() => request.requester?._id && navigate(`/profile?id=${request.requester._id}`)}
                  >
                    {request.requester?.name || "Anonymous"}
                  </p>
                  <div className="flex gap-1 mt-1">
                    <Button size="sm" className="h-6 px-2 text-xs"
                      onClick={async () => {
                        try {
                          await acceptFriend({ friendshipId: request._id });
                          toast.success("Friend request accepted");
                        } catch (e) {
                          toast.error("Failed to accept");
                        }
                      }}
                    >
                      Accept
                    </Button>
                    <Button variant="outline" size="sm" className="h-6 px-2 text-xs"
                      onClick={async () => {
                        try {
                          await declineFriend({ friendshipId: request._id });
                          toast.message("Request declined");
                        } catch (e) {
                          toast.error("Failed to decline");
                        }
                      }}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Online Friends */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Friends Online</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {friends && friends.length > 0 ? (
            friends.slice(0, 8).map((friend: any) => {
              if (!friend) return null;
              return (
                <div
                  key={friend._id}
                  className="flex items-center gap-3 group cursor-pointer hover:bg-muted/50 p-2 rounded-lg -m-2"
                  onClick={() => navigate(`/profile?id=${friend._id}`)}
                >
                  <div className="relative">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={friend.image} />
                      <AvatarFallback className="bg-muted text-xs">
                        {friend.name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-background rounded-full"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{friend.name || "Anonymous"}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MessageCircle className="w-3 h-3" />
                  </Button>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">No friends online</p>
          )}
        </CardContent>
      </Card>

      {/* Suggested Friends */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Find Friends</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Search by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search.trim().length >= 2 && (
            <>
              {searchResults && searchResults.length > 0 ? (
                <div className="space-y-3">
                  {searchResults.map((u: any) => (
                    <div key={u._id} className="flex items-center gap-3">
                      <button
                        onClick={() => navigate(`/profile?id=${u._id}`)}
                        className="shrink-0"
                        aria-label="View profile"
                      >
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={u.image} />
                          <AvatarFallback className="bg-muted text-xs">
                            {u.name?.charAt(0) || "U"}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                      <div className="flex-1 min-w-0">
                        <p
                          className="font-medium text-sm truncate cursor-pointer hover:underline"
                          onClick={() => navigate(`/profile?id=${u._id}`)}
                        >
                          {u.name || "Anonymous"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {u.email}
                        </p>
                        <Button
                          size="sm"
                          className="h-6 px-2 text-xs mt-1"
                          onClick={async () => {
                            try {
                              await sendFriend({ userId: u._id });
                              toast.success("Friend request sent");
                            } catch (e: any) {
                              toast.error(e?.message || "Failed to send request");
                            }
                          }}
                        >
                          Add Friend
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No results</p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}