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
  User
} from "lucide-react";
import { useNavigate, useLocation } from "react-router";
import { motion } from "framer-motion";

export function Sidebar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { icon: Home, label: "Home", path: "/dashboard" },
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
        <img src="https://harmless-tapir-303.convex.cloud/api/storage/883e5059-db9d-4027-bc9c-ddf871efb973" alt="Gen-z Nepal" className="w-8 h-8 rounded-md object-cover" />
        <span className="font-bold text-lg text-primary">Nepal Social</span>
      </div>

      {/* User Profile */}
      <div className="flex items-center gap-3 mb-6 p-3 rounded-lg bg-muted/50">
        <Avatar>
          <AvatarImage src={user?.image} />
          <AvatarFallback className="bg-primary text-primary-foreground">
            {user?.name?.charAt(0) || "U"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{user?.name || "User"}</p>
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
              variant={isActive ? "default" : "ghost"}
              className="w-full justify-start gap-3"
              onClick={() => navigate(item.path)}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Button>
          );
        })}
      </nav>

      {/* Sign Out */}
      <Button
        variant="ghost"
        className="w-full justify-start gap-3 text-destructive hover:text-destructive"
        onClick={() => signOut()}
      >
        <LogOut className="w-5 h-5" />
        Sign Out
      </Button>
    </motion.div>
  );
}