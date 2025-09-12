import { Home, MessageCircle, Users, Bell, User, Settings, Clapperboard } from "lucide-react";
import { useLocation, useNavigate } from "react-router";

export function MobileTopNav({ showOnDesktop = false }: { showOnDesktop?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();

  const items = [
    { icon: Home, path: "/dashboard", label: "Home" },
    { icon: Clapperboard, path: "/reels", label: "Reels" },
    { icon: MessageCircle, path: "/messages", label: "Messages" },
    { icon: Users, path: "/friends", label: "Friends" },
    { icon: Bell, path: "/notifications", label: "Notifications" },
    { icon: User, path: "/profile", label: "Profile" },
    { icon: Settings, path: "/settings", label: "Settings" },
  ] as const;

  return (
    <div
      className={`${showOnDesktop ? "" : "lg:hidden "}sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b`}
    >
      <div className="px-2 py-2 flex items-center justify-around">
        {items.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              aria-label={item.label}
              className={`inline-flex flex-col items-center justify-center px-3 py-1.5 rounded-md text-xs ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`w-7 h-7 sm:w-6 sm:h-6 mb-0.5 ${isActive ? "text-primary" : ""}`} />
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}