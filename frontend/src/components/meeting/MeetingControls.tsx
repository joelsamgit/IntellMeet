import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  PhoneOff,
  MessageSquare,
  Users,
  MoreHorizontal,
  Hand,
  Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MeetingControlsProps {
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isRecording: boolean;
  isChatOpen: boolean;
  isParticipantsOpen: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleRecording: () => void;
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onLeave: () => void;
  onEnd: () => void;
}

interface ControlButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  offIcon?: React.ReactNode;
  isActive?: boolean;
  isOff?: boolean;
  label: string;
  danger?: boolean;
  badge?: number;
}

function ControlButton({
  onClick,
  icon,
  offIcon,
  isOff,
  isActive,
  label,
  danger,
  badge,
}: ControlButtonProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              "relative w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200",
              danger
                ? "bg-red-500 hover:bg-red-400 text-white"
                : isOff
                ? "bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20"
                : isActive
                ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                : "bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white border border-white/5"
            )}
          >
            {isOff && offIcon ? offIcon : icon}
            {badge !== undefined && badge > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 rounded-full text-[10px] text-white flex items-center justify-center font-medium">
                {badge > 9 ? "9+" : badge}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="bg-[#1a1d27] border-white/10 text-white text-xs"
        >
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function MeetingControls({
  isMuted,
  isVideoOff,
  isScreenSharing,
  isRecording,
  isChatOpen,
  isParticipantsOpen,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onToggleRecording,
  onToggleChat,
  onToggleParticipants,
  onLeave,
  onEnd,
}: MeetingControlsProps) {
  return (
    <div className="h-20 bg-[#0d0e14]/95 backdrop-blur-sm border-t border-white/5 flex items-center justify-between px-4 md:px-6">
      {/* Left - Meeting Info (Hidden on mobile to save space) */}
      <div className="hidden lg:flex items-center gap-3 min-w-[200px]">
        {isRecording && (
          <div className="flex items-center gap-2 bg-red-500/15 border border-red-500/20 rounded-lg px-3 py-1.5">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs text-red-400 font-medium">Recording</span>
          </div>
        )}
      </div>

      {/* Desktop Main Controls (Visible on medium screens and larger) */}
      <div className="hidden md:flex items-center gap-2 mx-auto">
        <ControlButton
          onClick={onToggleMute}
          icon={<Mic className="w-5 h-5" />}
          offIcon={<MicOff className="w-5 h-5" />}
          isOff={isMuted}
          label={isMuted ? "Unmute" : "Mute"}
        />
        <ControlButton
          onClick={onToggleVideo}
          icon={<Video className="w-5 h-5" />}
          offIcon={<VideoOff className="w-5 h-5" />}
          isOff={isVideoOff}
          label={isVideoOff ? "Start Video" : "Stop Video"}
        />
        <ControlButton
          onClick={onToggleScreenShare}
          icon={<ScreenShare className="w-5 h-5" />}
          offIcon={<ScreenShareOff className="w-5 h-5" />}
          isActive={isScreenSharing}
          label={isScreenSharing ? "Stop Sharing" : "Share Screen"}
        />
        <ControlButton
          onClick={onToggleRecording}
          icon={<Circle className="w-5 h-5" />}
          isActive={isRecording}
          label={isRecording ? "Stop Recording" : "Start Recording"}
        />
        <ControlButton
          onClick={() => {}}
          icon={<Hand className="w-5 h-5" />}
          label="Raise Hand"
        />

        {/* Leave & End Buttons */}
        <div className="w-px h-8 bg-white/10 mx-2" />
        <div className="flex items-center gap-2">
          <button
            onClick={onLeave}
            className="flex items-center gap-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
          >
            <PhoneOff className="w-4 h-4 text-red-400" />
            Leave
          </button>
          <button
            onClick={onEnd}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 shadow-lg shadow-red-600/20"
          >
            <Circle className="w-4 h-4 fill-white animate-pulse" />
            End Meeting
          </button>
        </div>
      </div>

      {/* Desktop Panel Toggles (Visible on medium screens and larger) */}
      <div className="hidden md:flex items-center gap-2 min-w-[200px] justify-end">
        <ControlButton
          onClick={onToggleParticipants}
          icon={<Users className="w-5 h-5" />}
          isActive={isParticipantsOpen}
          label="Participants"
        />
        <ControlButton
          onClick={onToggleChat}
          icon={<MessageSquare className="w-5 h-5" />}
          isActive={isChatOpen}
          label="Chat"
        />
        <ControlButton
          onClick={() => {}}
          icon={<MoreHorizontal className="w-5 h-5" />}
          label="More Options"
        />
      </div>

      {/* Mobile Streamlined Layout (Visible ONLY on mobile screens) */}
      <div className="flex md:hidden items-center justify-between w-full gap-2">
        <div className="flex items-center gap-2">
          <ControlButton
            onClick={onToggleMute}
            icon={<Mic className="w-5 h-5" />}
            offIcon={<MicOff className="w-5 h-5" />}
            isOff={isMuted}
            label={isMuted ? "Unmute" : "Mute"}
          />
          <ControlButton
            onClick={onToggleVideo}
            icon={<Video className="w-5 h-5" />}
            offIcon={<VideoOff className="w-5 h-5" />}
            isOff={isVideoOff}
            label={isVideoOff ? "Start Video" : "Stop Video"}
          />
          <ControlButton
            onClick={onToggleChat}
            icon={<MessageSquare className="w-5 h-5" />}
            isActive={isChatOpen}
            label="Chat"
          />
          <ControlButton
            onClick={onToggleParticipants}
            icon={<Users className="w-5 h-5" />}
            isActive={isParticipantsOpen}
            label="Participants"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Leave Button */}
          <ControlButton
            onClick={onLeave}
            icon={<PhoneOff className="w-5 h-5 text-red-400" />}
            label="Leave"
            isOff={true} // subtle red border
          />
          {/* End Meeting Button */}
          <ControlButton
            onClick={onEnd}
            icon={<Circle className="w-5 h-5 fill-white animate-pulse" />}
            label="End Meeting"
            danger={true} // solid red
          />
        </div>
      </div>
    </div>
  );
}