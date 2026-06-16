import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import { useAuthStore } from "./store/authStore";
import MainLayout from "./layouts/MainLayout";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const MeetingRoomPage = lazy(() => import("./pages/MeetingRoomPage"));
const PostMeetingPage = lazy(() => import("./pages/PostMeetingPage"));
const TeamPage = lazy(() => import("./pages/TeamPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

// Scrolls to top on every page change
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  useSocket();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const [isServerAwake, setIsServerAwake] = useState(false);
  const [wakeError, setWakeError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
    const healthUrl = `${apiUrl}/health`;

    async function checkServer() {
      try {
        const res = await fetch(healthUrl);
        if (res.ok) {
          if (mounted) {
            setIsServerAwake(true);
          }
          return true;
        }
      } catch (e) {
        console.warn("Server is waking up...", e);
      }
      return false;
    }

    async function startChecking() {
      // First immediate check
      const awake = await checkServer();
      if (awake) return;

      // Retry check every 3 seconds
      const interval = setInterval(async () => {
        const isUp = await checkServer();
        if (isUp) {
          clearInterval(interval);
        }
      }, 3000);

      // Timeout after 60 seconds of failure
      const timeout = setTimeout(() => {
        clearInterval(interval);
        if (mounted && !isServerAwake) {
          setWakeError("Server connection timed out. Please try reloading or check if the backend service is running.");
        }
      }, 60000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }

    void startChecking();

    return () => {
      mounted = false;
    };
  }, [isServerAwake]);

  if (!isServerAwake) {
    return (
      <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center p-6 text-white text-center">
        <div className="max-w-md w-full bg-[#13141a] border border-white/5 rounded-2xl p-8 space-y-6 shadow-xl relative overflow-hidden">
          {/* Animated glow background */}
          <div className="absolute -top-40 -left-45 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-40 -right-45 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-6">
            <div className="w-16 h-16 bg-indigo-600/10 border border-indigo-500/20 rounded-full flex items-center justify-center mx-auto text-indigo-400">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-white">Waking Up IntellMeet Server</h2>
              <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
                Our free-tier server sleeps after periods of inactivity. It is currently booting up, which typically takes 30-50 seconds.
              </p>
            </div>

            {wakeError ? (
              <div className="space-y-4">
                <p className="text-xs text-red-400 font-semibold leading-relaxed">{wakeError}</p>
                <Button
                  onClick={() => window.location.reload()}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 font-medium"
                >
                  Retry Connection
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-[11px] text-indigo-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                Establishing connection...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<LoadingSpinner className="min-h-screen bg-[#0a0b0f]" />}>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* Protected routes — wrapped in MainLayout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="team" element={<TeamPage />} />
            <Route path="analytics" element={<Navigate to="/dashboard" replace />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="meeting/:meetingId/post" element={<PostMeetingPage />} />
          </Route>

          {/* Meeting room — fullscreen, no sidebar/header */}
          <Route
            path="/meeting/:meetingId"
            element={
              <ProtectedRoute>
                <MeetingRoomPage />
              </ProtectedRoute>
            }
          />

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </>
  );
}