import { useCallback, useMemo, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CheckCircle2, Pencil } from "lucide-react";

type ProfileHeaderProps = {
  displayName: string;
  username: string; // without @
  avatarUrl?: string | null;
  isVerified?: boolean;
  isOwner?: boolean;
  sizeMobilePx?: number; // default 56
  sizeDesktopPx?: number; // default 72
  onEditProfile?: () => void;
  onNavigateToProfile?: (username: string) => void;
};

function initialsFromName(name?: string | null) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0];
  const second = parts.length > 1 ? parts[1]?.[0] : "";
  return (first || "U").toUpperCase() + (second || "").toUpperCase();
}

async function copyTextToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallthrough to legacy
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "absolute";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export function ProfileHeader({
  displayName,
  username,
  avatarUrl,
  isVerified = false,
  isOwner = false,
  sizeMobilePx = 56,
  sizeDesktopPx = 72,
  onEditProfile,
  onNavigateToProfile,
}: ProfileHeaderProps) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);

  const profileUrl = useMemo(() => `/u/${username}`, [username]);

  const handleNavigate = useCallback(() => {
    if (onNavigateToProfile) {
      onNavigateToProfile(username);
      return;
    }
    // Fallback navigation
    window.location.href = profileUrl;
  }, [onNavigateToProfile, profileUrl, username]);

  const handleCopy = useCallback(async () => {
    const ok = await copyTextToClipboard(window.location.origin + profileUrl);
    if (ok) {
      setCopied(true);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1500);
    }
  }, [profileUrl]);

  const mobileSizeStyle = { width: `${sizeMobilePx}px`, height: `${sizeMobilePx}px` };
  const desktopSizeStyle = { width: `${sizeDesktopPx}px`, height: `${sizeDesktopPx}px` };

  return (
    <TooltipProvider>
      <div className="w-full">
        {/* Responsive layout:
           - Mobile: center, stacked
           - Desktop: left aligned avatar, text at right */}
        <div className="flex flex-col items-center gap-3 md:flex-row md:items-center">
          {/* Avatar */}
          <button
            type="button"
            onClick={handleNavigate}
            className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary/50"
            aria-label={`Open profile of ${displayName || username}`}
          >
            <Avatar
              className="w-[56px] h-[56px] md:w-[72px] md:h-[72px]"
            >
              <AvatarImage src={avatarUrl || undefined} alt={`${displayName || username} avatar`} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {initialsFromName(displayName)}
              </AvatarFallback>
            </Avatar>
          </button>

          {/* Text + Actions */}
          <div className="flex flex-col items-center md:items-start md:ml-4 min-w-0">
            {/* Display Name + Verified */}
            <button
              type="button"
              onClick={handleNavigate}
              className="group inline-flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-primary/50"
              aria-label={`Open profile of ${displayName || username}`}
            >
              <h2
                className="max-w-full truncate text-xl md:text-2xl font-semibold leading-tight"
                title={displayName}
              >
                {displayName}
              </h2>
              {isVerified && (
                <span className="inline-flex items-center text-blue-600" aria-label="Verified account">
                  <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5" />
                </span>
              )}
            </button>

            {/* Username with tooltip copy */}
            <div className="mt-0.5">
              <Tooltip open={copied ? true : undefined}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="max-w-full truncate text-sm text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
                    aria-label="Copy profile link"
                    aria-live="polite"
                    title={`@${username}`}
                  >
                    @{username}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="px-2 py-1 text-xs">
                  {copied ? "Profile link copied" : "Click to copy profile link"}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Edit button (owner only) */}
          {isOwner && (
            <div className="mt-2 md:mt-0 md:ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={onEditProfile}
                aria-label="Edit Profile"
                className="gap-1.5 transition-colors"
              >
                <Pencil className="h-4 w-4" />
                Edit Profile
              </Button>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

/* Example usage (mock data)
import { Card, CardContent } from "@/components/ui/card";

export function ProfileHeaderExample() {
  return (
    <div className="p-4">
      <Card>
        <CardContent className="p-4">
          <ProfileHeader
            displayName="Alex Sharma"
            username="alex_sh"
            avatarUrl="https://images.unsplash.com/photo-1531123897727-8f129e1688ce?q=80&w=400&auto=format&fit=crop"
            isVerified={true}
            isOwner={true}
            onEditProfile={() => alert("Edit profile clicked")}
            onNavigateToProfile={(uname) => alert(`Navigate to /u/${uname}`)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
*/