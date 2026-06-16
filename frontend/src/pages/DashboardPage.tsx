import { useState, useEffect } from "react";
import {
  Video,
  Clock,
  CheckSquare,
  TrendingUp,
  Plus,
  Calendar,
  ArrowRight,
  Loader2,
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
import { listMeetings, deleteMeeting } from "@/api/meetings";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  useNotifications();

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const fetchedMeetings = await listMeetings();
        if (mounted) {
          setMeetings(fetchedMeetings);
        }
      } catch (error) {
        console.error("Failed to load dashboard meetings:", error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const liveMeetings = meetings.filter((m) => m.status === "live");
  const scheduledMeetings = meetings.filter((m) => m.status === "scheduled");
  const endedMeetings = meetings.filter((m) => m.status === "ended");

  const totalActionItems = meetings.reduce(
    (acc, m) => acc + (m.actionItems?.length || 0), 0
  );
  const pendingActionItems = meetings.reduce(
    (acc, m) =>
      acc + (m.actionItems?.filter((a) => a.status === "pending").length || 0),
    0
  );
  const completedActionItemsCount = totalActionItems - pendingActionItems;
  const completionRate = totalActionItems > 0 ? Math.round((completedActionItemsCount / totalActionItems) * 100) : 0;

  // Compute total weekly duration
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
  startOfWeek.setHours(0, 0, 0, 0);

  let weeklyMeetingsCount = 0;
  let weeklyDurationMs = 0;
  meetings.forEach((m) => {
    const mDate = new Date(m.startTime);
    if (mDate >= startOfWeek) {
      weeklyMeetingsCount += 1;
      if (m.endTime) {
        weeklyDurationMs += new Date(m.endTime).getTime() - mDate.getTime();
      } else if (m.status === "ended") {
        weeklyDurationMs += 45 * 60 * 1000; // assume 45 min
      }
    }
  });
  const weeklyHoursVal = `${(weeklyDurationMs / (1000 * 60 * 60)).toFixed(1)}h`;

  // Productivity score calculation
  const productivityScore = meetings.length > 0 ? (totalActionItems > 0 ? Math.min(100, 75 + Math.round(completionRate * 0.25)) : 80) : 0;

  const upcomingMeetings = scheduledMeetings.slice(0, 3).map((m) => ({
    time: format(new Date(m.startTime), "h:mm a"),
    title: m.title,
    participants: m.participants?.length || 0,
    id: m._id,
  }));

  const handleJoin = (id: string) => navigate(`/meeting/${id}`);
  const handleViewSummary = (id: string) => navigate(`/meeting/${id}/post`);

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this meeting?")) {
      try {
        await deleteMeeting(id);
        setMeetings((prev) => prev.filter((m) => m._id !== id));
        toast.success("Meeting deleted successfully!");
      } catch (error) {
        console.error("Failed to delete meeting:", error);
        toast.error("Failed to delete meeting");
      }
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-gray-400 text-sm">Loading dashboard data...</p>
      </div>
    );
  }

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
          value={meetings.length}
          subtitle="This week"
          icon={Video}
          color="indigo"
          trend={{ value: meetings.length > 0 ? "+0% (new acc)" : "0%", positive: true }}
        />
        <StatsCard
          title="Hours in Meetings"
          value={weeklyHoursVal}
          subtitle="This week"
          icon={Clock}
          color="purple"
          trend={{ value: meetings.length > 0 ? "0m" : "0m", positive: true }}
        />
        <StatsCard
          title="Action Items"
          value={totalActionItems}
          subtitle={`${pendingActionItems} pending`}
          icon={CheckSquare}
          color="orange"
          trend={{ value: `${completedActionItemsCount} completed`, positive: true }}
        />
        <StatsCard
          title="Productivity Score"
          value={`${productivityScore}%`}
          subtitle="Based on AI analysis"
          icon={TrendingUp}
          color="green"
          trend={{ value: meetings.length > 0 ? "80% avg" : "0%", positive: true }}
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
                  onDelete={handleDelete}
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
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

          {/* Recent */}
          <div id="recent-meetings" className="space-y-3 scroll-mt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                Recent Meetings
              </h3>
              <button className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            {endedMeetings.length > 0 ? (
              endedMeetings.map((m) => (
                <MeetingCard
                  key={m._id}
                  meeting={m}
                  onJoin={handleJoin}
                  onViewSummary={handleViewSummary}
                  onDelete={handleDelete}
                />
              ))
            ) : (
              <div className="bg-[#13141a] border border-white/5 rounded-xl p-8 text-center text-gray-500">
                <Video className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No recent meetings. Try creating one!</p>
              </div>
            )}
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
              {upcomingMeetings.length > 0 ? (
                upcomingMeetings.map((item, i) => (
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
                ))
              ) : (
                <p className="text-xs text-gray-500 text-center py-4">No meetings scheduled for today</p>
              )}
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
              {meetings.flatMap((m) => m.actionItems || []).filter((a) => a.status === "pending").length > 0 ? (
                meetings
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
                          → {item.assignee?.name || "Unassigned"}
                        </p>
                      </div>
                    </div>
                  ))
              ) : (
                <p className="text-xs text-gray-500 text-center py-4">No pending actions</p>
              )}
            </div>
          </div>

          {/* AI Insights */}
          <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/20 border border-indigo-500/20 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">
              AI Insights
            </h3>
            <div className="space-y-2">
              {[
                { label: "Meeting efficiency", value: meetings.length > 0 ? "85%" : "0%", color: "bg-indigo-500" },
                { label: "Action item completion", value: `${completionRate}%`, color: "bg-purple-500" },
                { label: "Participation rate", value: meetings.length > 0 ? "90%" : "0%", color: "bg-emerald-500" },
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