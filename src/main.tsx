import { Toaster } from "@/components/ui/sonner";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { InstrumentationProvider } from "@/instrumentation.tsx";
import AuthPage from "@/pages/Auth.tsx";
import Friends from "@/pages/Friends.tsx";
import Notifications from "@/pages/Notifications.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation, useNavigate, Navigate } from "react-router";
import "./index.css";
import Landing from "./pages/Landing.tsx";
import NotFound from "./pages/NotFound.tsx";
import "./types/global.d.ts";
import Profile from "@/pages/Profile.tsx";
import Messages from "@/pages/Messages.tsx";
import { useAuth } from "@/hooks/use-auth";
import Settings from "@/pages/Settings.tsx";
import Dashboard from "@/pages/Dashboard.tsx";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { isLoading, isAuthenticated } = useAuth();

  // Show a simple centered spinner during auth check
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    const search = new URLSearchParams();
    const requested = location.pathname + (location.search || "");
    search.set("redirect", requested);
    return <Navigate to={`/auth?${search.toString()}`} replace />;
  }

  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { isLoading, isAuthenticated } = useAuth();

  // Show a simple centered spinner during auth check
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (isAuthenticated) {
    const redirectParam = new URLSearchParams(location.search).get("redirect");
    // Change default redirect from /dashboard to /messages
    return <Navigate to={redirectParam || "/messages"} replace />;
  }

  return <>{children}</>;
}

function Redirect({ to }: { to: string }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace: true });
  }, [navigate, to]);
  return null;
}

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

function HomeGate() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return <Navigate to={isAuthenticated ? "/messages" : "/auth"} replace />;
}

createRoot(document.getElementById("root")!).render(
  <>
    <VlyToolbar />
    <InstrumentationProvider>
      <ConvexAuthProvider client={convex}>
        <BrowserRouter>
          <RouteSyncer />
          <Routes>
            {/* Redirect home based on auth state */}
            <Route path="/" element={<HomeGate />} />
            {/* Keep landing page accessible if needed */}
            <Route path="/landing" element={<Landing />} />
            {/* Auth routes: support /auth, /login, /signup with same public gate */}
            <Route
              path="/auth"
              element={
                <PublicOnlyRoute>
                  {/* Change redirectAfterAuth to /messages */}
                  <AuthPage redirectAfterAuth="/messages" />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/login"
              element={
                <PublicOnlyRoute>
                  {/* Change redirectAfterAuth to /messages */}
                  <AuthPage redirectAfterAuth="/messages" />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/signup"
              element={
                <PublicOnlyRoute>
                  {/* Change redirectAfterAuth to /messages */}
                  <AuthPage redirectAfterAuth="/messages" />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <Messages />
                </ProtectedRoute>
              }
            />
            <Route
              path="/friends"
              element={
                <ProtectedRoute>
                  <Friends />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <Notifications />
                </ProtectedRoute>
              }
            />
            <Route path="/profile/:username" element={<Redirect to="/messages" />} />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </ConvexAuthProvider>
    </InstrumentationProvider>
  </>
);