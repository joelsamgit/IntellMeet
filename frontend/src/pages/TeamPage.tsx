import { useState } from "react";
import {
  Users,
  Plus,
  Search,
  LayoutGrid,
  List,
  Kanban,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import TeamMemberCard from "@/components/team/TeamMemberCard";
import KanbanBoard from "@/components/team/KanbanBoard";

const teamMembers = [
  {
    id: "u1",
    name: "Joel Thomas",
    email: "joel@intellmeet.com",
    role: "Frontend Developer",
    isHost: true,
    status: "online" as const,
    tasksCompleted: 12,
    meetingsThisWeek: 8,
  },
  {
    id: "u2",
    name: "Sarah Connor",
    email: "sarah@intellmeet.com",
    role: "Frontend Developer",
    status: "online" as const,
    tasksCompleted: 9,
    meetingsThisWeek: 6,
  },
  {
    id: "u3",
    name: "Mike Ross",
    email: "mike@intellmeet.com",
    role: "Backend Developer",
    status: "busy" as const,
    tasksCompleted: 15,
    meetingsThisWeek: 5,
  },
  {
    id: "u4",
    name: "Anna Lee",
    email: "anna@intellmeet.com",
    role: "UI/UX Designer",
    status: "away" as const,
    tasksCompleted: 7,
    meetingsThisWeek: 4,
  },
];

export default function TeamPage() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("members");

  const filteredMembers = teamMembers.filter(
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
            {teamMembers.length} members •{" "}
            {teamMembers.filter((m) => m.status === "online").length} online
          </p>
        </div>
        <Button
          onClick={() => toast.info("Invite member feature coming soon!")}
          className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2 shadow-lg shadow-indigo-500/20"
        >
          <Plus className="w-4 h-4" />
          Invite Member
        </Button>
      </div>

      {/* Tabs */}
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
                count: teamMembers.filter((m) => m.status === "online").length,
                color: "bg-emerald-500",
              },
              {
                label: "Busy",
                count: teamMembers.filter((m) => m.status === "busy").length,
                color: "bg-red-500",
              },
              {
                label: "Away",
                count: teamMembers.filter((m) => m.status === "away").length,
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
      </Tabs>
    </div>
  );
}