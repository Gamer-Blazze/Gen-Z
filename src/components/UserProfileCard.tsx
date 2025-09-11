import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

type RequestStatus = "none" | "pending" | "friends";

type Props = {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl?: string | null;
  requestStatus: RequestStatus;
  // Optional handlers (mocked by default)
  sendFriendRequest?: (userId: string) => Promise<void> | void;
  cancelFriendRequest?: (userId: string) => Promise<void> | void;
  onOpenProfile?: (username: string) => void;
  // Add: unfriend handler
  unfriendUser?: (userId: string) => Promise<void> | void;
};

function initialsFromName(name?: string | null) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0];
  const second = parts.length > 1 ? parts[1]?.[0] : "";
  return (first || "U").toUpperCase() + (second || "").toUpperCase();
}

export function UserProfileCard({
  userId,
  displayName,
  username,
  avatarUrl,
  requestStatus,
  sendFriendRequest,
  cancelFriendRequest,
  onOpenProfile,
  // Add prop
  unfriendUser,
}: Props) {
  const [status, setStatus] = useState<RequestStatus>(requestStatus);
  const [working, setWorking] = useState(false);

  // Default mock handlers if not provided
  const onSend = async () => {
    setWorking(true);
    try {
      if (sendFriendRequest) {
        await sendFriendRequest(userId);
      } else {
        await new Promise((r) => setTimeout(r, 400));
        // console.log("Mock: sendFriendRequest", userId);
      }
      setStatus("pending");
    } finally {
      setWorking(false);
    }
  };

  const onCancel = async () => {
    setWorking(true);
    try {
      if (cancelFriendRequest) {
        await cancelFriendRequest(userId);
      } else {
        await new Promise((r) => setTimeout(r, 400));
        // console.log("Mock: cancelFriendRequest", userId);
      }
      setStatus("none");
    } finally {
      setWorking(false);
    }
  };

  const onUnfriend = async () => {
    setWorking(true);
    try {
      if (unfriendUser) {
        await unfriendUser(userId);
      } else {
        await new Promise((r) => setTimeout(r, 400));
        // console.log("Mock: unfriendUser", userId);
      }
      setStatus("none");
    } finally {
      setWorking(false);
    }
  };

  const handleOpenProfile = () => {
    if (onOpenProfile) {
      onOpenProfile(username);
    } else {
      window.location.href = `/profile?u=${encodeURIComponent(username)}`;
    }
  };

  const friendlyUsername = useMemo(() => `@${username}`, [username]);

  return (
    <div className="w-full rounded-lg border bg-card p-4 shadow-sm transition hover:shadow">
      {/* Responsive: stack on mobile, align on desktop */}
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        {/* Avatar */}
        <button
          type="button"
          onClick={handleOpenProfile}
          aria-label={`Open profile of ${displayName || username}`}
          className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <Avatar className="h-14 w-14 sm:h-16 sm:w-16">
            <AvatarImage src={avatarUrl || undefined} alt={`${displayName || username} avatar`} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {initialsFromName(displayName)}
            </AvatarFallback>
          </Avatar>
        </button>

        {/* Info + Actions */}
        <div className="flex w-full flex-1 items-center gap-3 sm:gap-4">
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h2
              className="truncate text-lg font-semibold leading-tight"
              title={displayName}
            >
              <button
                type="button"
                onClick={handleOpenProfile}
                className="transition-colors hover:underline focus:outline-none focus:ring-2 focus:ring-primary/50 rounded"
                aria-label={`Open profile of ${displayName || username}`}
              >
                {displayName}
              </button>
            </h2>
            <p
              className="truncate text-sm text-muted-foreground"
              title={friendlyUsername}
            >
              {friendlyUsername}
            </p>
          </div>

          {/* Action Button */}
          <div className="w-full sm:w-auto">
            {status === "none" && (
              <Button
                onClick={onSend}
                disabled={working}
                className="w-full sm:w-auto bg-[#1877F2] hover:bg-[#166FE5] text-white transition-colors"
              >
                {working ? "Adding..." : "Add Friend"}
              </Button>
            )}
            {status === "pending" && (
              <Button
                onClick={onCancel}
                disabled={working}
                variant="outline"
                className="w-full sm:w-auto transition-colors"
              >
                {working ? "Cancelling..." : "Cancel Request"}
              </Button>
            )}
            {status === "friends" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    disabled={working}
                    variant="secondary"
                    className="w-full sm:w-auto inline-flex items-center gap-1.5"
                    aria-label="Friends actions"
                  >
                    Friends
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={onUnfriend}
                    disabled={working}
                  >
                    {working ? "Working..." : "Unfriend"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Example usage (mock) */
export function UserProfileCardExample() {
  const mockSend = async (id: string) => {
    await new Promise((r) => setTimeout(r, 400));
    console.log("sendFriendRequest", id);
  };
  const mockCancel = async (id: string) => {
    await new Promise((r) => setTimeout(r, 400));
    console.log("cancelFriendRequest", id);
  };
  const mockUnfriend = async (id: string) => {
    await new Promise((r) => setTimeout(r, 400));
    console.log("unfriendUser", id);
  };

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <UserProfileCard
        userId="u_1"
        displayName="Alex Carter"
        username="alex.c"
        avatarUrl="https://images.unsplash.com/photo-1531123897727-8f129e1688ce?q=80&w=200&auto=format&fit=crop"
        requestStatus="none"
        sendFriendRequest={mockSend}
        cancelFriendRequest={mockCancel}
        unfriendUser={mockUnfriend}
      />

      <UserProfileCard
        userId="u_2"
        displayName="Priya Singh"
        username="priya_s"
        avatarUrl="https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&auto=format&fit=crop"
        requestStatus="pending"
        sendFriendRequest={mockSend}
        cancelFriendRequest={mockCancel}
        unfriendUser={mockUnfriend}
      />

      <UserProfileCard
        userId="u_3"
        displayName="Jordan Lee"
        username="jordan"
        avatarUrl=""
        requestStatus="friends"
        unfriendUser={mockUnfriend}
      />
    </div>
  );
}