import { Menu, Search, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import NotificationsDropdown from "./NotificationsDropdown";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onMenuClick?: () => void;
}

export default function Header({ title, subtitle, onMenuClick }: HeaderProps) {
  const { user } = useAuthStore();

  return (
    <header className="h-16 border-b border-white/5 bg-[#0d0e14]/80 backdrop-blur-sm flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
      {/* Left */}
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="md:hidden text-gray-400 hover:text-white -ml-2"
          >
            <Menu className="w-5 h-5" />
          </Button>
        )}
        <div>
          <h1 className="text-base md:text-lg font-semibold text-white truncate max-w-[150px] sm:max-w-none">{title}</h1>
          {subtitle && <p className="text-[10px] md:text-xs text-gray-400 truncate hidden sm:block">{subtitle}</p>}
        </div>
      </div>

      {/* Center */}
      <div className="hidden md:flex items-center flex-1 max-w-sm mx-8">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Search meetings, people..."
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-indigo-500 h-9 text-sm"
          />
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <Button
          onClick={() => toast.info("Enter a meeting ID to join")}
          variant="outline"
          size="sm"
          className="hidden md:flex border-white/10 bg-transparent text-gray-300 hover:bg-white/5 hover:text-white gap-2"
        >
          <Video className="w-4 h-4" />
          Join Meeting
        </Button>

        <NotificationsDropdown />

        <Avatar className="w-8 h-8 cursor-pointer">
          <AvatarImage src={user?.avatar} />
          <AvatarFallback className="bg-indigo-600 text-white text-xs">
            {user?.name?.charAt(0).toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}