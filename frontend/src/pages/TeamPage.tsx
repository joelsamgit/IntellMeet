import { useState, useEffect } from "react";
import {
  Users,
  Plus,
  Search,
  Loader2,
  Kanban,
  Mail,
  Check,
  X as XIcon,
  Video,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import TeamMemberCard from "@/components/team/TeamMemberCard";
import KanbanBoard from "@/components/team/KanbanBoard";
import { listAllUsers } from "@/api/users";
import { listMeetings, createMeeting } from "@/api/meetings";
import { listTasks } from "@/api/tasks";
import { listTeams, inviteMember, listPendingInvitations, respondToInvitation } from "@/api/teams";
import { useAuthStore } from "@/store/authStore";

export default function TeamPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("members");
  const [members, setMembers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [isInviting, setIsInviting] = useState(false);

  const handleStartTeamMeeting = async (team: any) => {
    try {
      const memberIds = (team.members || []).map((m: any) => m._id).filter(Boolean);
      const res = await createMeeting({
        title: `${team.name} Meet`,
        scheduledTime: new Date().toISOString(),
        status: "live",
        participantIds: memberIds,
      });
      toast.success(`Starting meeting for ${team.name}...`);
      navigate(`/meeting/${res.meeting.meetingCode || res.meeting._id}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to start team meeting");
    }
  };

  const loadTeamsAndInvites = async () => {
    try {
      const [fetchedTeams, fetchedInvites] = await Promise.all([
        listTeams().catch(() => []),
        listPendingInvitations().catch(() => []),
      ]);
      setTeams(fetchedTeams);
      setInvitations(fetchedInvites);
      if (fetchedTeams.length > 0 && !selectedTeamId) {
        setSelectedTeamId(fetchedTeams[0]._id);
      }
    } catch (err) {
      console.error("Failed to load teams/invitations:", err);
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setIsInviting(true);
    try {
      await inviteMember(inviteEmail.trim(), selectedTeamId || undefined);
      toast.success("Invitation sent successfully!");
      setInviteEmail("");
      setIsInviteModalOpen(false);
      loadTeamsAndInvites();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to send invitation.");
    } finally {
      setIsInviting(false);
    }
  };

  const handleInvitationResponse = async (id: string, action: 'accept' | 'decline') => {
    try {
      await respondToInvitation(id, action);
      toast.success(`Invitation ${action}ed successfully!`);
      loadTeamsAndInvites();
      if (action === 'accept') {
        // Reload page to reflect new team membership & tasks
        window.location.reload();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || `Failed to ${action} invitation.`);
    }
  };

  useEffect(() => {
    let mounted = true;
    async function loadMembers() {
      try {
        const [users, fetchedMeetings, fetchedTasks] = await Promise.all([
          listAllUsers(),
          listMeetings(),
          listTasks(),
        ]);
        if (mounted) {
          // Calculate start of current week
          const now = new Date();
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
          startOfWeek.setHours(0, 0, 0, 0);

          setMembers(
            users.map((u) => {
              const tasksCompleted = fetchedTasks.filter(
                (t) => t.assignee?._id === u._id && t.status === "done"
              ).length;

              const meetingsThisWeek = fetchedMeetings.filter((m) => {
                const mDate = new Date(m.startTime);
                if (mDate < startOfWeek) return false;
                const isHost = m.hostId === u._id;
                const isParticipant = m.participants?.some((p) => p._id === u._id);
                return isHost || isParticipant;
              }).length;

              return {
                id: u._id,
                name: u.name,
                email: u.email,
                role: u.role === "admin" ? "Host / Admin" : "Team Member",
                status: "online",
                tasksCompleted,
                meetingsThisWeek,
                avatar: u.avatar || "",
              };
            })
          );
        }
      } catch (err) {
        console.error("Failed to load members:", err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    loadMembers();
    loadTeamsAndInvites();
    return () => {
      mounted = false;
    };
  }, []);

  // Filter members to only show users who are in any team I am in (or invited to)
  const relevantMembers = members.filter((m) => {
    // 1. Current user is always relevant
    if (m.id === user?._id || m.email.toLowerCase() === user?.email?.toLowerCase()) {
      return true;
    }
    
    // 2. Check if this user is a member of any of my teams, or has a pending invitation
    return teams.some((team) => {
      // Is a member of the team
      const isMember = team.members?.some((tm: any) => 
        (tm._id && tm._id === m.id) || (tm.email && tm.email.toLowerCase() === m.email.toLowerCase())
      );
      if (isMember) return true;

      // Has a pending invitation to the team
      const isInvited = team.pendingInvitations?.some((email: string) => 
        email.toLowerCase() === m.email.toLowerCase()
      );
      if (isInvited) return true;

      return false;
    });
  });

  const filteredMembers = relevantMembers.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Team Workspace</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {relevantMembers.length} members •{" "}
            {relevantMembers.filter((m) => m.status === "online").length} online
          </p>
        </div>
        <Button
          onClick={() => setIsInviteModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2 shadow-lg shadow-indigo-500/20"
        >
          <Plus className="w-4 h-4" />
          Invite Member
        </Button>
      </div>

      {isLoading ? (
        <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-gray-400 text-sm">Loading workspace members...</p>
        </div>
      ) : (
        /* Tabs */
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between gap-4">
            <TabsList className="bg-[#13141a] border border-white/5 p-1">
              <TabsTrigger
                value="members"
                className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-gray-400 text-sm gap-1.5"
              >
                <Users className="w-3.5 h-3.5" />
                Members
              </TabsTrigger>
              <TabsTrigger
                value="board"
                className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-gray-400 text-sm gap-1.5"
              >
                <Kanban className="w-3.5 h-3.5" />
                Task Board
              </TabsTrigger>
              <TabsTrigger
                value="teams"
                className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-gray-400 text-sm gap-1.5"
              >
                <Users className="w-3.5 h-3.5" />
                Teams & Invites
              </TabsTrigger>
            </TabsList>

            {/* Search */}
            {activeTab === "members" && (
              <div className="relative max-w-xs w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search members..."
                  className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-gray-600 h-9 text-sm"
                />
              </div>
            )}
          </div>

          {/* Members Tab */}
          <TabsContent value="members" className="mt-4">
            {/* Online Status Bar */}
            <div className="flex items-center gap-4 mb-5 p-4 bg-[#13141a] border border-white/5 rounded-xl">
              {[
                {
                  label: "Online",
                  count: relevantMembers.filter((m) => m.status === "online").length,
                  color: "bg-emerald-500",
                },
                {
                  label: "Busy",
                  count: relevantMembers.filter((m) => m.status === "busy").length,
                  color: "bg-red-500",
                },
                {
                  label: "Away",
                  count: relevantMembers.filter((m) => m.status === "away").length,
                  color: "bg-yellow-500",
                },
                {
                  label: "Offline",
                  count: 0,
                  color: "bg-gray-500",
                },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className={cn("w-2 h-2 rounded-full", s.color)} />
                  <span className="text-xs text-gray-400">
                    {s.count} {s.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Members Grid */}
            {filteredMembers.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {filteredMembers.map((member) => (
                  <TeamMemberCard key={member.id} member={member} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No members found</p>
              </div>
            )}
          </TabsContent>

        {/* Kanban Board Tab */}
        <TabsContent value="board" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-400">
              Drag and drop tasks between columns
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info("Add task feature coming soon!")}
              className="border-white/10 bg-transparent text-gray-300 hover:bg-white/5 gap-1.5 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Task
            </Button>
          </div>
          <KanbanBoard />
        </TabsContent>

        {/* Teams & Invites Tab */}
        <TabsContent value="teams" className="mt-4 space-y-6">
          {/* Pending Invitations */}
          <div className="bg-[#13141a] border border-white/5 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-400" />
              Pending Invitations ({invitations.length})
            </h3>
            {invitations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {invitations.map((invite) => (
                  <div
                    key={invite._id}
                    className="bg-white/3 border border-white/5 hover:border-white/10 rounded-xl p-4 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        Invite to join "{invite.team?.name || "Team"}"
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Invited by {invite.invitedBy?.name} ({invite.invitedBy?.email})
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleInvitationResponse(invite._id, "accept")}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white h-8 text-xs gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleInvitationResponse(invite._id, "decline")}
                        className="border-white/10 bg-transparent text-red-400 hover:bg-red-500/10 hover:text-red-300 h-8 text-xs gap-1"
                      >
                        <XIcon className="w-3.5 h-3.5" />
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">No pending invitations.</p>
            )}
          </div>

          {/* My Teams */}
          <div className="bg-[#13141a] border border-white/5 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              My Teams ({teams.length})
            </h3>
            {teams.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {teams.map((team) => (
                  <div
                    key={team._id}
                    className="bg-white/3 border border-white/5 hover:border-white/10 rounded-xl p-4 space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-white truncate">{team.name}</h4>
                      <p className="text-xs text-gray-400">
                        {team.members?.length || 0} members
                      </p>
                      <div className="flex -space-x-1.5 overflow-hidden">
                        {team.members?.slice(0, 5).map((m: any) => (
                          <div
                            key={m._id}
                            className="w-6 h-6 rounded-full bg-indigo-600 border border-[#13141a] flex items-center justify-center text-[9px] text-white font-bold"
                            title={m.name}
                          >
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleStartTeamMeeting(team)}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs mt-2 gap-1.5"
                    >
                      <Video className="w-3.5 h-3.5" />
                      Start Meeting
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">You don't belong to any teams yet.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
      )}

      {/* Invite Member Dialog Modal */}
      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent className="bg-[#13141a] border border-white/10 text-white max-w-sm p-6 rounded-xl">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-400" />
              Invite Team Member
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInviteSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-gray-300 text-xs">Email Address</Label>
              <Input
                id="email"
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 text-xs h-9 focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="team" className="text-gray-300 text-xs">Select Team</Label>
              {teams.length > 0 ? (
                <select
                  id="team"
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="w-full bg-[#1c1d24] border border-white/10 rounded-lg p-2 text-xs text-white focus:border-indigo-500 focus:outline-none h-9"
                >
                  {teams.map((t) => (
                    <option key={t._id} value={t._id} className="bg-[#13141a]">
                      {t.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-[10px] text-gray-500 italic">
                  No teams found. A new team will be created automatically.
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsInviteModalOpen(false)}
                className="flex-1 border-white/10 bg-transparent text-gray-300 hover:bg-white/5 text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isInviting || !inviteEmail.trim()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9"
              >
                {isInviting ? "Inviting..." : "Send Invitation"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}