import { X, Mic, MicOff, Video, VideoOff, Crown, MoreVertical, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { inviteMember } from "@/api/teams";
import { toast } from "sonner";

interface Participant {
  id: string;
  name: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isHost: boolean;
  isSpeaking: boolean;
}

interface ParticipantsPanelProps {
  participants: Participant[];
  onClose: () => void;
}

export default function ParticipantsPanel({
  participants,
  onClose,
}: ParticipantsPanelProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    try {
      await inviteMember(inviteEmail.trim());
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to send invitation.");
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-72 md:relative bg-[#0d0e14] border-l border-white/5 flex flex-col h-full">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-white/5">
        <h3 className="text-sm font-semibold text-white">
          Participants
          <span className="ml-2 text-xs text-gray-500 font-normal">
            ({participants.length})
          </span>
        </h3>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Invite to Team Section */}
      <form onSubmit={handleInvite} className="p-4 border-b border-white/5 space-y-2">
        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          Invite to Team
        </label>
        <div className="flex gap-1.5">
          <Input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Enter member's email..."
            className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 text-xs h-9 flex-1"
          />
          <Button
            type="submit"
            disabled={isInviting || !inviteEmail.trim()}
            size="sm"
            className="h-9 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 shadow-lg shadow-indigo-500/10"
          >
            {isInviting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              "Invite"
            )}
          </Button>
        </div>
      </form>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {participants.map((p) => (
          <div
            key={p.id}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/3 transition-colors group",
              p.isSpeaking && "bg-indigo-500/5"
            )}
          >
            <div className="relative">
              <Avatar className="w-8 h-8">
                <AvatarFallback
                  className={cn(
                    "text-white text-xs font-medium",
                    p.isSpeaking ? "bg-indigo-600" : "bg-[#2a2d3a]"
                  )}
                >
                  {p.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              {p.isSpeaking && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-indigo-500 rounded-full border-2 border-[#0d0e14]" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-white truncate">{p.name}</span>
                {p.isHost && (
                  <Crown className="w-3 h-3 text-yellow-400 flex-shrink-0" />
                )}
              </div>
              {p.isSpeaking && (
                <span className="text-xs text-indigo-400">Speaking...</span>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {p.isMuted ? (
                <MicOff className="w-3.5 h-3.5 text-red-400" />
              ) : (
                <Mic className="w-3.5 h-3.5 text-gray-400" />
              )}
              {p.isVideoOff ? (
                <VideoOff className="w-3.5 h-3.5 text-red-400" />
              ) : (
                <Video className="w-3.5 h-3.5 text-gray-400" />
              )}
              <button className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 transition-colors ml-1">
                <MoreVertical className="w-3 h-3 text-gray-400" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}