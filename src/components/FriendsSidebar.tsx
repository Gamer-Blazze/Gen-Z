import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, UserPlus } from "lucide-react";
import { motion } from "framer-motion";

export function FriendsSidebar() {
  const friends = useQuery(api.friends.getUserFriends, {});
  const friendRequests = useQuery(api.friends.getPendingFriendRequests, {});

  return (
    <motion.div
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="w-80 p-4 space-y-4"
    >
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
            {friendRequests.slice(0, 3).map((request) => (
              <div key={request._id} className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={request.requester?.image} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {request.requester?.name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {request.requester?.name || "Anonymous"}
                  </p>
                  <div className="flex gap-1 mt-1">
                    <Button size="sm" className="h-6 px-2 text-xs">
                      Accept
                    </Button>
                    <Button variant="outline" size="sm" className="h-6 px-2 text-xs">
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
            friends.slice(0, 8).map((friend) => {
              if (!friend) return null;
              return (
                <div key={friend._id} className="flex items-center gap-3 group cursor-pointer hover:bg-muted/50 p-2 rounded-lg -m-2">
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
          <CardTitle className="text-sm font-semibold">People You May Know</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarFallback className="bg-gradient-to-br from-red-500 to-orange-500 text-white">
                R
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Ram Bahadur</p>
              <p className="text-xs text-muted-foreground">2 mutual friends</p>
              <Button size="sm" className="h-6 px-2 text-xs mt-1">
                Add Friend
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                S
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Sita Sharma</p>
              <p className="text-xs text-muted-foreground">1 mutual friend</p>
              <Button size="sm" className="h-6 px-2 text-xs mt-1">
                Add Friend
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}