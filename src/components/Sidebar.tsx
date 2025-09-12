import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Home, 
  MessageCircle, 
  Users, 
  Bell, 
  Settings, 
  LogOut,
  User,
  Clapperboard
} from "lucide-react";
import { useNavigate, useLocation } from "react-router";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

export function Sidebar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { icon: Home, label: "Home", path: "/dashboard" },
    { icon: Clapperboard, label: "Reels", path: "/reels" },
    { icon: MessageCircle, label: "Messages", path: "/messages" },
    { icon: Users, label: "Friends", path: "/friends" },
    { icon: Bell, label: "Notifications", path: "/notifications" },
    { icon: User, label: "Profile", path: "/profile" },
    { icon: Settings, label: "Settings", path: "/settings" },
  ];

  return (
    <motion.div
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="w-64 h-screen bg-card border-r border-border p-4 flex flex-col"
    >
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8 cursor-pointer" onClick={() => navigate("/")}>
        <img src="https://harmless-tapir-303.convex.cloud/api/storage/a52c8a4d-a5ad-4a95-9575-06b95d3970f8" alt="Gen-z Nepal" className="w-8 h-8 rounded-md object-cover" />
        <span className="font-bold text-lg text-primary">Gen-Z Nepal</span>
      </div>

      {/* User Profile */}
      <div className="flex items-center gap-3 mb-6 p-3 rounded-lg bg-muted/50">
        <Dialog>
          <DialogTrigger asChild>
            <button aria-label="View profile picture" className="shrink-0">
              {/* Increase avatar size for better visual quality */}
              <Avatar className="w-14 h-14">
                <AvatarImage src={user?.image} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {user?.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <img
              src={user?.image}
              alt={user?.name || "Profile picture"}
              className="w-full h-auto rounded-lg"
              loading="eager"
              decoding="async"
            />
          </DialogContent>
        </Dialog>
        {/* Make the user info clickable to visit profile */}
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => navigate("/profile")}
          role="button"
          aria-label="Go to your profile"
        >
          <p className="font-medium truncate hover:underline">{user?.name || "User"}</p>
          <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Button
              key={item.path}
              variant="ghost"
              className={`w-full justify-start gap-3 rounded-xl h-11 transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20 shadow-sm"
                  : "hover:bg-muted"
              }`}
              onClick={() => navigate(item.path)}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Button>
          );
        })}
      </nav>
    </motion.div>
  );
}