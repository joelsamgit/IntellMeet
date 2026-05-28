import { useState } from "react";
import {
  Video,
  Clock,
  CheckSquare,
  TrendingUp,
  Plus,
  Calendar,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import StatsCard from "@/components/common/StatsCard";
import MeetingCard from "@/components/common/MeetingCard";
import NewMeetingModal from "@/components/common/NewMeetingModal";
import { Meeting } from "@/types";
import { format } from "date-fns";
import { useNotifications } from "@/hooks/useNotifications";

const mockMeetings: Meeting[] = [
  {
    _id: "1",
    title: "Sprint Planning — Week 19",
    hostId: "user1",
    participants: [
      { _id: "u1", name: "Joel Thomas", email: "joel@example.com", role: "admin" },
      { _id: "u2", name: "Sarah Connor", email: "sarah@example.com", role: "member" },
      { _id: "u3", name: "Mike Ross", email: "mike@example.com", role: "member" },
    ],
    startTime: new Date().toISOString(),
    status: "live",
    actionItems: [],
  },
  {
    _id: "2",
    title: "Product Design Review",
    hostId: "user1",
    participants: [
      { _id: "u1", name: "Joel Thomas", email: "joel@example.com", role: "admin" },
      { _id: "u4", name: "Anna Lee", email: "anna@example.com", role: "member" },
    ],
    startTime: new Date(Date.now() + 3600000).toISOString(),
    status: "scheduled",
    actionItems: [],
  },
  {
    _id: "3",
    title: "Q1 Quarterly Review",
    hostId: "user2",
    participants: [
      { _id: "u1", name: "Joel Thomas", email: "joel@example.com", role: "admin" },
      { _id: "u2", name: "Sarah Connor", email: "sarah@example.com", role: "member" },
      { _id: "u3", name: "Mike Ross", email: "mike@example.com", role: "member" },
      { _id: "u4", name: "Anna Lee", email: "anna@example.com", role: "member" },
      { _id: "u5", name: "Tom Hardy", email: "tom@example.com", role: "member" },
      { _id: "u6", name: "Lisa Ray", email: "lisa@example.com", role: "member" },
    ],
    startTime: new Date(Date.now() - 7200000).toISOString(),
    endTime: new Date(Date.now() - 3600000).toISOString(),
    status: "ended",
    summary: "Discussed Q1 results and set Q2 targets.",
    actionItems: [
      {
        _id: "a1",
        text: "Prepare Q2 budget proposal",
        assignee: { _id: "u1", name: "Joel Thomas", email: "joel@example.com", role: "admin" },
        status: "pending",
        meetingId: "3",
      },
      {
        _id: "a2",
        text: "Send meeting notes to all stakeholders",
        assignee: { _id: "u2", name: "Sarah Connor", email: "sarah@example.com", role: "member" },
        status: "pending",
        meetingId: "3",
      },
    ],
  },
  {
    _id: "4",
    title: "Team Standup",
    hostId: "user1",
    participants: [
      { _id: "u1", name: "Joel Thomas", email: "joel@example.com", role: "admin" },
      { _id: "u2", name: "Sarah Connor", email: "sarah@example.com", role: "member" },
      { _id: "u3", name: "Mike Ross", email: "mike@example.com", role: "member" },
    ],
    startTime: new Date(Date.now() - 86400000).toISOString(),
    endTime: new Date(Date.now() - 84600000).toISOString(),
    status: "ended",
    summary: "Daily standup covering blockers and progress.",
    actionItems: [
      {
        _id: "a3",
        text: "Fix login bug on mobile",
        assignee: { _id: "u3", name: "Mike Ross", email: "mike@example.com", role: "member" },
        status: "done",
        meetingId: "4",
      },
    ],
  },
];

const upcomingMeetings = [
  { time: "10:00 AM", title: "Product Design Review", participants: 2 },
  { time: "2:00 PM", title: "Backend Sync", participants: 4 },
  { time: "4:30 PM", title: "Client Demo", participants: 6 },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  useNotifications();

  const liveMeetings = mockMeetings.filter((m) => m.status === "live");
  const scheduledMeetings = mockMeetings.filter((m) => m.status === "scheduled");
  const endedMeetings = mockMeetings.filter((m) => m.status === "ended");

  const totalActionItems = mockMeetings.reduce(
    (acc, m) => acc + (m.actionItems?.length || 0), 0
  );
  const pendingActionItems = mockMeetings.reduce(
    (acc, m) =>
      acc + (m.actionItems?.filter((a) => a.status === "pending").length || 0),
    0
  );

  const handleJoin = (id: string) => navigate(`/meeting/${id}`);
  const handleViewSummary = (id: string) => navigate(`/meeting/${id}/post`);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-900/40 via-[#13141a] to-[#13141a] border border-white/5 rounded-2xl p-6 flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-white">
            {getGreeting()}, {user?.name?.split(" ")[0] || "there"} 👋
          </h2>
          <p className="text-sm text-gray-400">
            You have{" "}
            <span className="text-indigo-400 font-medium">
              {liveMeetings.length} live
            </span>{" "}
            and{" "}
            <span className="text-blue-400 font-medium">
              {scheduledMeetings.length} upcoming
            </span>{" "}
            meetings today.
          </p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 gap-2"
        >
          <Plus className="w-4 h-4" />
          New Meeting
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Meetings"
          value={mockMeetings.length}
          subtitle="This week"
          icon={Video}
          color="indigo"
          trend={{ value: "2 more", positive: true }}
        />
        <StatsCard
          title="Hours in Meetings"
          value="6.5h"
          subtitle="This week"
          icon={Clock}
          color="purple"
          trend={{ value: "30 mins", positive: false }}
        />
        <StatsCard
          title="Action Items"
          value={totalActionItems}
          subtitle={`${pendingActionItems} pending`}
          icon={CheckSquare}
          color="orange"
          trend={{ value: "3 completed", positive: true }}
        />
        <StatsCard
          title="Productivity Score"
          value="87%"
          subtitle="Based on AI analysis"
          icon={TrendingUp}
          color="green"
          trend={{ value: "5%", positive: true }}
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Meetings List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Live */}
          {liveMeetings.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <h3 className="text-sm font-semibold text-white">Live Now</h3>
              </div>
              {liveMeetings.map((m) => (
                <MeetingCard
                  key={m._id}
                  meeting={m}
                  onJoin={handleJoin}
                  onViewSummary={handleViewSummary}
                />
              ))}
            </div>
          )}

          {/* Upcoming */}
          {scheduledMeetings.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white">
                Upcoming Meetings
              </h3>
              {scheduledMeetings.map((m) => (
                <MeetingCard
                  key={m._id}
                  meeting={m}
                  onJoin={handleJoin}
                  onViewSummary={handleViewSummary}
                />
              ))}
            </div>
          )}

          {/* Recent */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                Recent Meetings
              </h3>
              <button className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            {endedMeetings.map((m) => (
              <MeetingCard
                key={m._id}
                meeting={m}
                onJoin={handleJoin}
                onViewSummary={handleViewSummary}
              />
            ))}
          </div>
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          {/* Today's Schedule */}
          <div className="bg-[#13141a] border border-white/5 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-400" />
                Today's Schedule
              </h3>
              <span className="text-xs text-gray-500">
                {format(new Date(), "MMM d")}
              </span>
            </div>
            <div className="space-y-3">
              {upcomingMeetings.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-lg bg-white/3 hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <div className="text-center min-w-[50px]">
                    <p className="text-xs font-medium text-indigo-400">
                      {item.time}
                    </p>
                  </div>
                  <div className="w-px h-8 bg-white/10" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">
                      {item.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.participants} participants
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Actions */}
          <div className="bg-[#13141a] border border-white/5 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-orange-400" />
                Pending Actions
              </h3>
              <span className="text-xs text-orange-400 font-medium">
                {pendingActionItems} left
              </span>
            </div>
            <div className="space-y-2">
              {mockMeetings
                .flatMap((m) => m.actionItems || [])
                .filter((a) => a.status === "pending")
                .map((item) => (
                  <div
                    key={item._id}
                    className="flex items-start gap-2 p-2 rounded-lg hover:bg-white/3 transition-colors"
                  >
                    <div className="w-4 h-4 rounded border border-white/20 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-300 leading-relaxed">
                        {item.text}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        → {item.assignee.name}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* AI Insights */}
          <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/20 border border-indigo-500/20 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">
              AI Insights
            </h3>
            <div className="space-y-2">
              {[
                { label: "Meeting efficiency", value: "87%", color: "bg-indigo-500" },
                { label: "Action item completion", value: "64%", color: "bg-purple-500" },
                { label: "Participation rate", value: "92%", color: "bg-emerald-500" },
              ].map((stat) => (
                <div key={stat.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">{stat.label}</span>
                    <span className="text-white font-medium">{stat.value}</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${stat.color} rounded-full`}
                      style={{ width: stat.value }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* New Meeting Modal */}
      <NewMeetingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}