import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Video,
  Bell,
  Settings,
  LogOut,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import Logo from "./Logo";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import NewMeetingModal from "./NewMeetingModal";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Team", icon: Users, path: "/team" },
  { label: "Analytics", icon: BarChart3, path: "/analytics" },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { unreadCount, setIsOpen } = useNotificationStore();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      {/* Mobile Sidebar Overlay Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "w-64 bg-[#0d0e14] border-r border-white/5 flex flex-col transition-transform duration-300 z-50",
          // Mobile vs Desktop responsive layout styling
          "fixed inset-y-0 left-0 md:relative md:translate-x-0 h-screen md:flex",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Logo and close button on mobile */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <Logo />
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="md:hidden text-gray-400 hover:text-white -mr-2"
            >
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>

      {/* New Meeting Button */}
      <div className="p-4">
        <Button
          onClick={() => setIsModalOpen(true)}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white h-10 font-medium shadow-lg shadow-indigo-500/20 transition-all duration-200"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Meeting
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider px-3 mb-3">
          Main Menu
        </p>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                isActive
                  ? "bg-indigo-600/15 text-indigo-400 border border-indigo-500/20"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon
                className={cn(
                  "w-4 h-4 transition-colors",
                  isActive
                    ? "text-indigo-400"
                    : "text-gray-500 group-hover:text-white"
                )}
              />
              {item.label}
              {item.label === "Dashboard" && (
                <Badge className="ml-auto bg-indigo-500/20 text-indigo-300 border-0 text-xs px-1.5 py-0">
                  New
                </Badge>
              )}
            </Link>
          );
        })}

        {/* Divider */}
        <div className="pt-4 pb-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider px-3 mb-3">
            Quick Access
          </p>
        </div>

        {/* Recent Meetings */}
        <button
          onClick={() => {
            navigate("/dashboard");
            setTimeout(() => {
              const element = document.getElementById("recent-meetings");
              if (element) {
                element.scrollIntoView({ behavior: "smooth" });
              }
            }, 100);
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200 group text-left font-medium"
        >
          <Video className="w-4 h-4 text-gray-500 group-hover:text-white" />
          Recent Meetings
        </button>

        {/* Notifications */}
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(true);
            navigate("/dashboard");
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200 group text-left font-medium"
        >
          <Bell className="w-4 h-4 text-gray-500 group-hover:text-white" />
          Notifications
          {unreadCount > 0 && (
            <span className="ml-auto bg-indigo-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
              {unreadCount}
            </span>
          )}
        </button>
      </nav>

      {/* Bottom Section */}
      <div className="p-3 border-t border-white/5 space-y-1">
        <Link
          to="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200 group"
        >
          <Settings className="w-4 h-4 text-gray-500 group-hover:text-white" />
          Settings
        </Link>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/5 transition-all duration-200 group"
        >
          <LogOut className="w-4 h-4 text-gray-500 group-hover:text-red-400" />
          Logout
        </button>

        {/* User Profile */}
        <div className="flex items-center gap-3 px-3 py-3 mt-2 rounded-lg bg-white/3 border border-white/5">
          <Avatar className="w-8 h-8">
            <AvatarImage src={user?.avatar} />
            <AvatarFallback className="bg-indigo-600 text-white text-xs font-medium">
              {user?.name ? getInitials(user.name) : "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.name || "User"}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {user?.email || ""}
            </p>
          </div>
        </div>
      </div>

      <NewMeetingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </aside>
    </>
  );
}