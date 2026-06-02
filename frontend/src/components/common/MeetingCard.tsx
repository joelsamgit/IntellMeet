import { Clock, Users, Video, FileText, MoreVertical, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Meeting } from "@/types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";

interface MeetingCardProps {
  meeting: Meeting;
  onJoin?: (id: string) => void;
  onViewSummary?: (id: string) => void;
}

const statusConfig = {
  live: {
    label: "Live",
    class: "bg-red-500/15 text-red-400 border-red-500/20",
    dot: "bg-red-500 animate-pulse",
  },
  scheduled: {
    label: "Scheduled",
    class: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    dot: "bg-blue-500",
  },
  ended: {
    label: "Ended",
    class: "bg-gray-500/15 text-gray-400 border-gray-500/20",
    dot: "bg-gray-500",
  },
};

export default function MeetingCard({ meeting, onJoin, onViewSummary }: MeetingCardProps) {
  const status = statusConfig[meeting.status];

  return (
    <div className="bg-[#13141a] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-all duration-200 group">
      <div className="flex items-start justify-between gap-3">
        {/* Left */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Title & Status */}
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-white truncate">
              {meeting.title}
            </h3>
            <Badge className={cn("text-xs border px-2 py-0 flex items-center gap-1", status.class)}>
              <span className={cn("w-1.5 h-1.5 rounded-full", status.dot)} />
              {status.label}
            </Badge>
          </div>

          {/* Meta info */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {format(new Date(meeting.startTime), "MMM d, h:mm a")}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {meeting.participants.length} participants
            </span>
          </div>

          {/* Participants Avatars */}
          <div className="flex items-center gap-1">
            {meeting.participants.slice(0, 5).map((p, i) => (
              <Avatar key={p._id} className="w-6 h-6 border-2 border-[#13141a]" style={{ marginLeft: i > 0 ? "-6px" : "0" }}>
                <AvatarFallback className="bg-indigo-600 text-white text-[10px]">
                  {p.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
            ))}
            {meeting.participants.length > 5 && (
              <span className="text-xs text-gray-500 ml-2">
                +{meeting.participants.length - 5} more
              </span>
            )}
          </div>

          {/* Action Items Preview */}
          {meeting.actionItems && meeting.actionItems.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <FileText className="w-3 h-3" />
              <span>{meeting.actionItems.length} action items</span>
            </div>
          )}
        </div>

        {/* Right - Actions */}
        <div className="flex flex-col items-end gap-2">
          {meeting.status === "live" && (
            <Button
              size="sm"
              onClick={() => onJoin?.(meeting._id)}
              className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/20 h-8 text-xs gap-1"
            >
              <Play className="w-3 h-3" />
              Join Now
            </Button>
          )}
          {meeting.status === "scheduled" && (
            <Button
              size="sm"
              onClick={() => onJoin?.(meeting._id)}
              className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/20 h-8 text-xs gap-1"
            >
              <Video className="w-3 h-3" />
              Start
            </Button>
          )}
          {meeting.status === "ended" && (
            <Button
              size="sm"
              onClick={() => onViewSummary?.(meeting._id)}
              className="bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 h-8 text-xs gap-1"
            >
              <FileText className="w-3 h-3" />
              Summary
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}