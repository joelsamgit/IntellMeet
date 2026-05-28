import { Bell, Check, CheckCheck, Video, MessageSquare, CheckSquare, X } from "lucide-react";
import { useNotificationStore } from "@/store/notificationStore";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useState, useRef, useEffect } from "react";
import { Notification } from "@/types";

const typeConfig = {
  system: {
    icon: Bell,
    color: "text-sky-400",
    bg: "bg-sky-500/10",
  },
  mention: {
    icon: MessageSquare,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  action_item: {
    icon: CheckSquare,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
  },
  meeting: {
    icon: Video,
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
  },
};

export default function NotificationsDropdown() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    useNotificationStore();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleMarkRead = (n: Notification) => {
    if (!n.read) markAsRead(n._id);
  };

  return (
    <div ref={ref} className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full" />
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-11 w-80 bg-[#13141a] border border-white/10 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="bg-indigo-500 text-white text-xs rounded-full px-1.5 py-0.5 font-medium">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-gray-500 text-sm">
                No notifications
              </div>
            ) : (
              notifications.map((n) => {
                const config = typeConfig[n.type];
                return (
                  <div
                    key={n._id}
                    onClick={() => handleMarkRead(n)}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-white/3 transition-colors",
                      !n.read && "bg-indigo-500/3"
                    )}
                  >
                    {/* Icon */}
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5", config.bg)}>
                      <config.icon className={cn("w-4 h-4", config.color)} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs leading-relaxed", n.read ? "text-gray-400" : "text-white")}>
                        {n.message}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </p>
                    </div>

                    {/* Unread dot */}
                    {!n.read && (
                      <div className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-white/5">
            <button className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors w-full text-center">
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}