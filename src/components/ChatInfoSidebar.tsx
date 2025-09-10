import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router";
import { Badge } from "@/components/ui/badge";

interface ChatInfoSidebarProps {
  conversationId: Id<"conversations"> | null;
}

export default function ChatInfoSidebar({ conversationId }: ChatInfoSidebarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const conversations = useQuery(api.messages.getUserConversations, {});
  const conversation = conversations?.find((c) => c._id === conversationId) || null;
  const otherUser = !conversation?.isGroup ? conversation?.otherParticipants?.[0] : null;

  if (!conversationId) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground px-4">
        <div className="text-center text-sm">Select a chat to view info</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <div className="flex flex-col items-center text-center gap-3">
          <Avatar className="w-20 h-20">
            <AvatarImage src={conversation?.isGroup ? conversation?.groupImage : otherUser?.image} />
            <AvatarFallback className="bg-muted">
              {(conversation?.isGroup ? conversation?.groupName?.charAt(0) : otherUser?.name?.charAt(0)) || "U"}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-semibold">
              {conversation?.isGroup ? conversation?.groupName : otherUser?.name || "Unknown"}
            </div>
            {!conversation?.isGroup && (
              <div className="text-xs text-muted-foreground">
                {otherUser?.isOnline ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500" /> Active now
                  </span>
                ) : (
                  "Offline"
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {!conversation?.isGroup && otherUser?._id && (
              <Button size="sm" variant="secondary" onClick={() => navigate(`/profile?id=${otherUser._id}`)}>
                Profile
              </Button>
            )}
            <Button size="sm" variant="outline">
              Mute
            </Button>
            <Button size="sm" variant="outline">
              Search
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <Card className="bg-card/50">
          <CardContent className="p-0">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="chat-info" className="border-b">
                <AccordionTrigger className="px-4">Chat info</AccordionTrigger>
                <AccordionContent className="px-4 pb-4 text-sm text-muted-foreground">
                  <div className="space-y-2">
                    <div>
                      <div className="text-foreground/80">Type</div>
                      <div>{conversation?.isGroup ? "Group chat" : "Direct message"}</div>
                    </div>
                    {conversation?.isGroup && (
                      <div>
                        <div className="text-foreground/80">Members</div>
                        <div className="flex flex-wrap gap-2">
                          {conversation?.participants?.map((p: any) => (
                            <Badge key={p._id} variant="secondary">
                              {p.name || "User"}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="customize" className="border-b">
                <AccordionTrigger className="px-4">Customize chat</AccordionTrigger>
                <AccordionContent className="px-4 pb-4 text-sm text-muted-foreground">
                  Themes, nicknames, emojis (coming soon)
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="media" className="border-b">
                <AccordionTrigger className="px-4">Media, files & links</AccordionTrigger>
                <AccordionContent className="px-4 pb-4 text-sm text-muted-foreground">
                  Recent media and shared content will appear here.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="privacy" className="border-b">
                <AccordionTrigger className="px-4">Privacy & support</AccordionTrigger>
                <AccordionContent className="px-4 pb-4 text-sm text-muted-foreground">
                  Block, report, and support options (coming soon).
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
