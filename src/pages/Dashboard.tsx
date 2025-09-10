import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { Sidebar } from "@/components/Sidebar";
import { Feed } from "@/components/Feed";
import { CreatePost } from "@/components/CreatePost";
import { FriendsSidebar } from "@/components/FriendsSidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { MobileTopNav } from "@/components/MobileTopNav";

/* removed MobileTopNav on dashboard */

export default function Dashboard() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-background"
    >
      {/* Global mobile nav bar removed on Dashboard */}
      {/* Add top navigation bar */}
      <MobileTopNav showOnDesktop />

      <div className="flex flex-col lg:flex-row">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        {/* Main Content */}
        <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-6">
          <CreatePost />
          <Feed />
        </main>

        {/* Right Sidebar (only on xl and up) */}
        <div className="hidden xl:block">
          <FriendsSidebar />
        </div>
      </div>
    </motion.div>
  );
}