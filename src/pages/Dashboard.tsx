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
      {/* Mobile Top Bar with Hamburger (hidden on lg and above) */}
      <div className="lg:hidden sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 items-center justify-between px-4">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[280px]">
              {/* Reuse existing Sidebar inside the sheet for mobile */}
              <Sidebar />
            </SheetContent>
          </Sheet>
          {/* Make title clickable to go to Profile */}
          <button
            className="font-semibold hover:underline"
            onClick={() => navigate("/profile")}
            aria-label="Go to Profile"
          >
            Gen-Z Nepal
          </button>
          <div className="w-9" />
        </div>
      </div>

      {/* Global mobile nav bar removed on Dashboard */}

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