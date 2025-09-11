import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Users, MessageCircle, Bell, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

// ... keep existing code (none - new file)

// Simple placeholder types
type FriendRequest = {
  id: string;
  name: string;
  avatar?: string;
};

type MessagePreview = {
  id: string;
  from: string;
  avatar?: string;
  snippet: string;
  unread: boolean;
};

type AppNotification = {
  id: string;
  text: string;
  unread: boolean;
};

// Simulated API fetchers (placeholders)
async function fetchFriendRequests(): Promise<FriendRequest[]> {
  return [
    { id: "fr_1", name: "Alex Carter" },
    { id: "fr_2", name: "Priya Singh" },
    { id: "fr_3", name: "Diego Ramirez" },
  ];
}

async function fetchMessages(): Promise<MessagePreview[]> {
  return [
    { id: "m_1", from: "John Doe", snippet: "Hey! Are you free later?", unread: true },
    { id: "m_2", from: "Jane Smith", snippet: "Thanks for the update 👍", unread: true },
    { id: "m_3", from: "Kofi Mensah", snippet: "Let's catch up tomorrow.", unread: false },
  ];
}

async function fetchNotifications(): Promise<AppNotification[]> {
  return [
    { id: "n_1", text: "Emily liked your post", unread: true },
    { id: "n_2", text: "Ravi commented on your photo", unread: true },
    { id: "n_3", text: "You have a new follower", unread: false },
  ];
}

export function TopNav() {
  const navigate = useNavigate();

  // Center search
  const [query, setQuery] = useState("");

  // Friend requests
  const [friendRequests, setFriendRequests] = useState<FriendRequest[] | undefined>(undefined);
  const friendRequestsCount = friendRequests?.length ?? 0;

  // Messages
  const [messages, setMessages] = useState<MessagePreview[] | undefined>(undefined);
  const messagesCount = useMemo(
    () => (messages ? messages.filter((m) => m.unread).length : 0),
    [messages]
  );

  // Notifications
  const [notifications, setNotifications] = useState<AppNotification[] | undefined>(undefined);
  const notificationsCount = useMemo(
    () => (notifications ? notifications.filter((n) => n.unread).length : 0),
    [notifications]
  );

  // Loading states for actions
  const [working, setWorking] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Initial load (simulated)
    (async () => {
      const [reqs, msgs, notifs] = await Promise.all([
        fetchFriendRequests(),
        fetchMessages(),
        fetchNotifications(),
      ]);
      setFriendRequests(reqs);
      setMessages(msgs);
      setNotifications(notifs);
    })();
  }, []);

  // Friend Request handlers
  const confirmRequest = async (id: string) => {
    setWorking((s) => new Set(s).add(id));
    try {
      await new Promise((r) => setTimeout(r, 500));
      setFriendRequests((prev) => (prev || []).filter((r) => r.id !== id));
    } finally {
      setWorking((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  };

  const deleteRequest = async (id: string) => {
    setWorking((s) => new Set(s).add(id));
    try {
      await new Promise((r) => setTimeout(r, 400));
      setFriendRequests((prev) => (prev || []).filter((r) => r.id !== id));
    } finally {
      setWorking((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  };

  // Message handlers
  const markMessageRead = async (id: string) => {
    setWorking((s) => new Set(s).add(id));
    try {
      await new Promise((r) => setTimeout(r, 300));
      setMessages((prev) =>
        (prev || []).map((m) => (m.id === id ? { ...m, unread: false } : m))
      );
    } finally {
      setWorking((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  };

  // Notification handlers
  const markNotificationRead = async (id: string) => {
    setWorking((s) => new Set(s).add(id));
    try {
      await new Promise((r) => setTimeout(r, 300));
      setNotifications((prev) =>
        (prev || []).map((n) => (n.id === id ? { ...n, unread: false } : n))
      );
    } finally {
      setWorking((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  };

  // Simulate external real-time increments
  const simulateIncomingMessage = () => {
    const id = `m_${Date.now()}`;
    setMessages((prev = []) => [
      { id, from: "New User", snippet: "New incoming message...", unread: true },
      ...prev,
    ]);
  };
  const simulateIncomingNotification = () => {
    const id = `n_${Date.now()}`;
    setNotifications((prev = []) => [
      { id, text: "Someone mentioned you in a comment", unread: true },
      ...prev,
    ]);
  };
  const simulateIncomingFriendRequest = () => {
    const id = `fr_${Date.now()}`;
    setFriendRequests((prev = []) => [{ id, name: "New Friend" }, ...prev]);
  };

  // Small red badge
  const Badge = ({ count }: { count: number }) =>
    count > 0 ? (
      <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-600 text-white text-[10px] leading-4 text-center">
        {count > 99 ? "99+" : count}
      </span>
    ) : null;

  return (
    <div className="w-full bg-white dark:bg-background border-b shadow-sm sticky top-0 z-40">
      <div className="mx-auto max-w-7xl px-3 sm:px-4">
        <div className="h-14 flex items-center justify-between gap-3">
          {/* Left: Logo */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/dashboard")}
              className="inline-flex items-center gap-2"
              aria-label="Home"
            >
              <img src="/logo.svg" alt="Logo" className="h-8 w-8" />
              <span className="hidden sm:inline text-lg font-semibold">Social</span>
            </button>
          </div>

          {/* Center: Search */}
          <div className="hidden md:flex flex-1 max-w-xl items-center">
            <div className="relative w-full">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="pl-8"
              />
            </div>
          </div>

          {/* Right: Action icons */}
          <div className="flex items-center gap-2">
            {/* Friend Requests */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="relative h-10 w-10 rounded-full hover:bg-muted grid place-items-center text-muted-foreground hover:text-[#1877F2]"
                  aria-label="Friend Requests"
                >
                  <Users className="h-5 w-5" />
                  <Badge count={friendRequestsCount} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between">
                  Friend Requests
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={simulateIncomingFriendRequest}>
                      + Sim
                    </Button>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {friendRequests === undefined ? (
                  <div className="p-4 text-sm text-muted-foreground">Loading...</div>
                ) : friendRequests.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">No pending requests</div>
                ) : (
                  friendRequests.slice(0, 6).map((r) => (
                    <DropdownMenuItem key={r.id} className="focus:bg-transparent">
                      <div className="w-full flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-muted grid place-items-center text-xs">
                          {r.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{r.name}</div>
                          <div className="mt-2 flex gap-2">
                            <Button
                              size="sm"
                              className="h-7 px-2 bg-[#1877F2] hover:bg-[#166FE5]"
                              onClick={() => confirmRequest(r.id)}
                              disabled={working.has(r.id)}
                            >
                              {working.has(r.id) ? "Confirming..." : "Confirm"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2"
                              onClick={() => deleteRequest(r.id)}
                              disabled={working.has(r.id)}
                            >
                              {working.has(r.id) ? "Deleting..." : "Delete"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Messages */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="relative h-10 w-10 rounded-full hover:bg-muted grid place-items-center text-muted-foreground hover:text-[#1877F2]"
                  aria-label="Messages"
                >
                  <MessageCircle className="h-5 w-5" />
                  <Badge count={messagesCount} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between">
                  Messages
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={simulateIncomingMessage}>
                      + Sim
                    </Button>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {messages === undefined ? (
                  <div className="p-4 text-sm text-muted-foreground">Loading...</div>
                ) : messages.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">No messages</div>
                ) : (
                  messages.slice(0, 6).map((m) => (
                    <DropdownMenuItem key={m.id} className="focus:bg-transparent">
                      <div className="w-full flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-muted grid place-items-center text-xs">
                          {m.from.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {m.from} {m.unread ? "•" : ""}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">{m.snippet}</div>
                          <div className="mt-2 flex gap-2">
                            <Button
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => {
                                markMessageRead(m.id);
                              }}
                              disabled={working.has(m.id) || !m.unread}
                            >
                              {working.has(m.id) ? "Opening..." : m.unread ? "Mark as read" : "Read"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2"
                              onClick={() => navigate("/messages")}
                            >
                              Open Chat
                            </Button>
                          </div>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="relative h-10 w-10 rounded-full hover:bg-muted grid place-items-center text-muted-foreground hover:text-[#1877F2]"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  <Badge count={notificationsCount} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between">
                  Notifications
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={simulateIncomingNotification}>
                      + Sim
                    </Button>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications === undefined ? (
                  <div className="p-4 text-sm text-muted-foreground">Loading...</div>
                ) : notifications.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">No notifications</div>
                ) : (
                  notifications.slice(0, 8).map((n) => (
                    <DropdownMenuItem key={n.id} className="focus:bg-transparent">
                      <div className="w-full flex items-center gap-3">
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 mt-1.5" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">
                            {n.text} {n.unread ? "•" : ""}
                          </div>
                          <div className="mt-2 flex gap-2">
                            <Button
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => markNotificationRead(n.id)}
                              disabled={working.has(n.id) || !n.unread}
                            >
                              {working.has(n.id) ? "Marking..." : n.unread ? "Mark as read" : "Read"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2"
                              onClick={() => navigate("/notifications")}
                            >
                              View All
                            </Button>
                          </div>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile search under bar */}
        <div className="md:hidden pb-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="pl-8"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
