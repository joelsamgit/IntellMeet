import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import { useAuthStore } from "./store/authStore";
import MainLayout from "./layouts/MainLayout";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveApiBaseUrl } from "./api/axios";

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
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let mounted = true;
    const apiUrl = resolveApiBaseUrl();
    const healthUrl = `${apiUrl}/health`;

    let intervalId: any;
    let timeoutId: any;
    let progressIntervalId: any;

    async function checkServer() {
      try {
        const res = await fetch(healthUrl);
        if (res.ok) {
          if (mounted) {
            setProgress(100);
            setTimeout(() => {
              if (mounted) setIsServerAwake(true);
            }, 400);
          }
          return true;
        }
      } catch (e) {
        console.warn("Server is waking up...", e);
      }
      return false;
    }

    async function startChecking() {
      // Smooth progress indicator over ~50 seconds
      progressIntervalId = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 98) return prev;
          return prev + 2;
        });
      }, 1000);

      // First immediate check
      const awake = await checkServer();
      if (awake) return;

      // Retry check every 3 seconds
      intervalId = setInterval(async () => {
        const isUp = await checkServer();
        if (isUp) {
          clearInterval(intervalId);
          clearInterval(progressIntervalId);
        }
      }, 3000);

      // Timeout after 60 seconds of failure
      timeoutId = setTimeout(() => {
        clearInterval(intervalId);
        clearInterval(progressIntervalId);
        if (mounted) {
          setWakeError("Server connection timed out. Please try reloading or check if the backend service is running.");
        }
      }, 60000);
    }

    void startChecking();

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
      if (progressIntervalId) clearInterval(progressIntervalId);
    };
  }, []);

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
              <div className="space-y-3">
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-gray-500 font-medium">
                  <div className="flex items-center gap-1.5 text-indigo-400">
                    <span className="w-1 h-1 rounded-full bg-indigo-400 animate-ping" />
                    Waking up...
                  </div>
                  <span>{progress}%</span>
                </div>
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
            <Route path="analytics" element={<AnalyticsPage />} />
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