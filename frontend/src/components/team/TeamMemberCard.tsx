import { Mail, MoreHorizontal, Video, Crown } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  isHost?: boolean;
  status: "online" | "offline" | "busy" | "away";
  tasksCompleted: number;
  meetingsThisWeek: number;
  avatar?: string;
}

const statusConfig = {
  online: { color: "bg-emerald-500", label: "Online" },
  offline: { color: "bg-gray-500", label: "Offline" },
  busy: { color: "bg-red-500", label: "Busy" },
  away: { color: "bg-yellow-500", label: "Away" },
};

interface TeamMemberCardProps {
  member: TeamMember;
  currentUserTeams?: any[];
  currentUserId?: string;
  currentUserRole?: string;
  onRemoveMember?: (memberId: string, teamId: string, teamName: string) => void;
}

export default function TeamMemberCard({
  member,
  currentUserTeams = [],
  currentUserId,
  currentUserRole,
  onRemoveMember,
}: TeamMemberCardProps) {
  const status = statusConfig[member.status];

  const memberTeams = (currentUserTeams || []).filter((team) => {
    const isMember = team.members?.some((tm: any) => tm._id === member.id);
    const isOwner = team.members?.[0]?._id === currentUserId;
    const isAdmin = currentUserRole === "admin";
    const isTargetOwner = team.members?.[0]?._id === member.id;

    if (member.id === currentUserId) {
      // This is the current user (me)
      // I can leave any team I am a member of, as long as I am not the owner of it
      return isMember && !isTargetOwner;
    } else {
      // This is another user
      // I can remove them if I am the owner or admin, and they are not the owner
      return isMember && (isOwner || isAdmin) && !isTargetOwner;
    }
  });

  return (
    <div className="bg-[#13141a] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-all duration-200 group">
      <div className="flex items-start justify-between mb-4">
        {/* Avatar + Status */}
        <div className="relative">
          <Avatar className="w-12 h-12">
            <AvatarFallback className="bg-indigo-600 text-white text-lg font-semibold">
              {member.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <span
            className={cn(
              "absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#13141a]",
              status.color
            )}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => toast.info(`Starting call with ${member.name}`)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Video className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => toast.info(`Emailing ${member.name}`)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
          </button>
          {memberTeams.length > 0 && onRemoveMember ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[#1c1d24] border border-white/10 text-white min-w-[160px] p-1.5 rounded-lg shadow-lg">
                <DropdownMenuLabel className="text-gray-400 text-[10px] px-2 py-1 font-medium">Actions</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/5 my-1" />
                {memberTeams.map((team) => (
                  <DropdownMenuItem
                    key={team._id}
                    onClick={() => onRemoveMember(member.id, team._id, team.name)}
                    className="text-red-400 hover:text-red-300 focus:bg-red-500/10 focus:text-red-400 text-xs cursor-pointer px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors flex items-center gap-1.5"
                  >
                    {member.id === currentUserId ? `Leave ${team.name}` : `Remove from ${team.name}`}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 cursor-not-allowed opacity-50">
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="space-y-1 mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white">
            {member.name}
            {member.id === currentUserId && <span className="text-gray-400 font-normal"> (me)</span>}
          </h3>
          {member.isHost && (
            <Crown className="w-3.5 h-3.5 text-yellow-400" />
          )}
        </div>
        <p className="text-xs text-gray-400">{member.role}</p>
        <p className="text-xs text-gray-600 truncate">{member.email}</p>
      </div>

      {/* Status Badge */}
      <div className="flex items-center justify-between mb-4">
        <Badge
          className={cn(
            "text-xs border gap-1.5",
            member.status === "online" &&
              "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
            member.status === "offline" &&
              "bg-gray-500/15 text-gray-400 border-gray-500/20",
            member.status === "busy" &&
              "bg-red-500/15 text-red-400 border-red-500/20",
            member.status === "away" &&
              "bg-yellow-500/15 text-yellow-400 border-yellow-500/20"
          )}
        >
          <span className={cn("w-1.5 h-1.5 rounded-full", status.color)} />
          {status.label}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/5">
        <div className="text-center">
          <p className="text-sm font-bold text-white">
            {member.tasksCompleted}
          </p>
          <p className="text-xs text-gray-500">Tasks done</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-white">
            {member.meetingsThisWeek}
          </p>
          <p className="text-xs text-gray-500">Meetings</p>
        </div>
      </div>
    </div>
  );
}