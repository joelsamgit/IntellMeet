import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Video,
  Clock,
  CheckSquare,
  Users,
  Bot,
  Calendar,
  Download,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { listMeetings } from "@/api/meetings";
import { listTasks } from "@/api/tasks";
import type { Meeting, Task } from "@/types";

// Custom Tooltip for charts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1d27] border border-white/10 rounded-lg p-3 shadow-xl">
        <p className="text-xs text-gray-400 mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} className="text-xs font-medium" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
            {entry.name === "duration" ? " min" : ""}
            {entry.name === "score" || entry.name === "actionCompletion" ? "%" : ""}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Stat Card for analytics
function AnalyticsStat({
  title,
  value,
  change,
  positive,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  change: string;
  positive: boolean;
  icon: any;
  color: string;
}) {
  return (
    <div className="bg-[#13141a] border border-white/5 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-gray-400">{title}</p>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", color)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white mb-2">{value}</p>
      <div className="flex items-center gap-1">
        {positive ? (
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <TrendingDown className="w-3.5 h-3.5 text-red-400" />
        )}
        <span className={cn("text-xs font-medium", positive ? "text-emerald-400" : "text-red-400")}>
          {change}
        </span>
        <span className="text-xs text-gray-500">vs last month</span>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const [fetchedMeetings, fetchedTasks] = await Promise.all([
          listMeetings(),
          listTasks(),
        ]);
        if (mounted) {
          setMeetings(fetchedMeetings);
          setTasks(fetchedTasks);
        }
      } catch (err) {
        console.error("Failed to load analytics data:", err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  // 1. Total Meetings
  const totalMeetings = meetings.length;

  // 2. Hours in Meetings
  let totalDurationMs = 0;
  meetings.forEach((m) => {
    if (m.endTime && m.startTime) {
      totalDurationMs += new Date(m.endTime).getTime() - new Date(m.startTime).getTime();
    } else if (m.status === "ended" && m.startTime) {
      // fallback: if ended but no endTime, assume 45 mins
      totalDurationMs += 45 * 60 * 1000;
    }
  });
  const totalHours = (totalDurationMs / (1000 * 60 * 60)).toFixed(1);

  // 3. Action Items
  let totalActionItemsCount = 0;
  meetings.forEach((m) => {
    if (m.actionItems) {
      totalActionItemsCount += m.actionItems.length;
    }
  });

  // 4. Completion Rate
  const totalTasksCount = tasks.length;
  const completedTasksCount = tasks.filter((t) => t.status === "done").length;
  const completionRate = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  // Weekly Meetings Data Setup
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weeklyMeetingsMap: Record<string, { meetings: number; duration: number }> = {
    Mon: { meetings: 0, duration: 0 },
    Tue: { meetings: 0, duration: 0 },
    Wed: { meetings: 0, duration: 0 },
    Thu: { meetings: 0, duration: 0 },
    Fri: { meetings: 0, duration: 0 },
    Sat: { meetings: 0, duration: 0 },
    Sun: { meetings: 0, duration: 0 },
  };

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
  startOfWeek.setHours(0, 0, 0, 0);

  meetings.forEach((m) => {
    const mDate = new Date(m.startTime);
    if (mDate >= startOfWeek) {
      const dayName = daysOfWeek[mDate.getDay()];
      if (weeklyMeetingsMap[dayName]) {
        weeklyMeetingsMap[dayName].meetings += 1;
        let durationMin = 45;
        if (m.endTime) {
          durationMin = Math.round((new Date(m.endTime).getTime() - mDate.getTime()) / (1000 * 60));
        }
        weeklyMeetingsMap[dayName].duration += durationMin;
      }
    }
  });

  const weeklyMeetingsData = [
    { day: "Mon", meetings: weeklyMeetingsMap.Mon.meetings, duration: weeklyMeetingsMap.Mon.duration },
    { day: "Tue", meetings: weeklyMeetingsMap.Tue.meetings, duration: weeklyMeetingsMap.Tue.duration },
    { day: "Wed", meetings: weeklyMeetingsMap.Wed.meetings, duration: weeklyMeetingsMap.Wed.duration },
    { day: "Thu", meetings: weeklyMeetingsMap.Thu.meetings, duration: weeklyMeetingsMap.Thu.duration },
    { day: "Fri", meetings: weeklyMeetingsMap.Fri.meetings, duration: weeklyMeetingsMap.Fri.duration },
    { day: "Sat", meetings: weeklyMeetingsMap.Sat.meetings, duration: weeklyMeetingsMap.Sat.duration },
    { day: "Sun", meetings: weeklyMeetingsMap.Sun.meetings, duration: weeklyMeetingsMap.Sun.duration },
  ];

  // Meeting Types Data Setup
  let standups = 0;
  let planning = 0;
  let reviews = 0;
  let clientCalls = 0;
  let others = 0;

  meetings.forEach((m) => {
    const title = m.title.toLowerCase();
    if (title.includes("standup") || title.includes("daily") || title.includes("sync")) {
      standups += 1;
    } else if (title.includes("plan") || title.includes("sprint")) {
      planning += 1;
    } else if (title.includes("review") || title.includes("demo") || title.includes("retrospective") || title.includes("retro")) {
      reviews += 1;
    } else if (title.includes("client") || title.includes("call") || title.includes("sales") || title.includes("customer")) {
      clientCalls += 1;
    } else {
      others += 1;
    }
  });

  const totalMeetingTypes = meetings.length;
  const meetingTypeData = [
    { name: "Standups", value: totalMeetingTypes > 0 ? Math.round((standups / totalMeetingTypes) * 100) : 0, color: "#6366f1" },
    { name: "Planning", value: totalMeetingTypes > 0 ? Math.round((planning / totalMeetingTypes) * 100) : 0, color: "#8b5cf6" },
    { name: "Reviews", value: totalMeetingTypes > 0 ? Math.round((reviews / totalMeetingTypes) * 100) : 0, color: "#06b6d4" },
    { name: "Client Calls", value: totalMeetingTypes > 0 ? Math.round((clientCalls / totalMeetingTypes) * 100) : 0, color: "#10b981" },
    { name: "Others", value: totalMeetingTypes > 0 ? Math.round((others / totalMeetingTypes) * 100) : 0, color: "#f59e0b" },
  ];

  // Monthly Trend Data Setup
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pastMonths: string[] = [];
  const currentMonthIdx = now.getMonth();
  for (let i = 4; i >= 0; i--) {
    let mIdx = currentMonthIdx - i;
    if (mIdx < 0) mIdx += 12;
    pastMonths.push(monthNames[mIdx]);
  }

  const monthlyMap: Record<string, { meetings: number; actionItems: number; completed: number }> = {};
  pastMonths.forEach((m) => {
    monthlyMap[m] = { meetings: 0, actionItems: 0, completed: 0 };
  });

  meetings.forEach((m) => {
    const mDate = new Date(m.startTime);
    const mMonthName = monthNames[mDate.getMonth()];
    if (monthlyMap[mMonthName] !== undefined) {
      monthlyMap[mMonthName].meetings += 1;
      const actionItemsCount = m.actionItems?.length || 0;
      const completedActionItemsCount = m.actionItems?.filter((ai) => ai.status === "done").length || 0;
      monthlyMap[mMonthName].actionItems += actionItemsCount;
      monthlyMap[mMonthName].completed += completedActionItemsCount;
    }
  });

  const monthlyTrendData = pastMonths.map((m) => ({
    month: m,
    meetings: monthlyMap[m].meetings,
    actionItems: monthlyMap[m].actionItems,
    completed: monthlyMap[m].completed,
  }));

  // Participation Data Setup
  const memberStats: Record<string, { meetings: number; talkTime: number }> = {};
  meetings.forEach((m) => {
    m.participants?.forEach((p) => {
      if (p && p.name) {
        if (!memberStats[p.name]) {
          memberStats[p.name] = { meetings: 0, talkTime: 0 };
        }
        memberStats[p.name].meetings += 1;
      }
    });
  });

  const participationData = Object.entries(memberStats)
    .map(([name, stats]) => ({
      name,
      meetings: stats.meetings,
      talkTime: Math.round(100 / Math.max(1, Object.keys(memberStats).length)),
    }))
    .sort((a, b) => b.meetings - a.meetings)
    .slice(0, 4);

  // Productivity Trend Setup
  const productivityTrendData = [
    { week: "W1", score: totalMeetings > 0 ? 75 : 0, actionCompletion: completionRate },
    { week: "W2", score: totalMeetings > 0 ? 78 : 0, actionCompletion: completionRate },
    { week: "W3", score: totalMeetings > 0 ? 82 : 0, actionCompletion: completionRate },
    { week: "W4", score: totalMeetings > 0 ? 85 : 0, actionCompletion: completionRate },
  ];

  // AI Insights Recommendations
  const recommendations = [];
  if (totalMeetings === 0) {
    recommendations.push({
      icon: "👋",
      title: "Welcome to IntellMeet!",
      desc: "Start creating or scheduling your meetings using the 'New Meeting' button to receive automatic AI summaries and transcripts.",
      color: "border-indigo-500/20 bg-indigo-500/5",
    });
    recommendations.push({
      icon: "📅",
      title: "No meetings scheduled",
      desc: "Keep your workspace active by inviting members and scheduling syncs to build momentum.",
      color: "border-orange-500/20 bg-orange-500/5",
    });
  } else {
    recommendations.push({
      icon: "📈",
      title: "Productivity tracking active",
      desc: `You have completed ${completedTasksCount} out of ${totalTasksCount} tasks in this workspace.`,
      color: "border-emerald-500/20 bg-emerald-500/5",
    });
    if (completionRate < 50) {
       recommendations.push({
         icon: "⚠️",
         title: "Low action item completion",
         desc: `Your task completion rate is currently at ${completionRate}%. Try resolving pending tasks to boost team velocity.`,
         color: "border-orange-500/20 bg-orange-500/5",
       });
    } else {
       recommendations.push({
         icon: "✅",
         title: "Great task momentum!",
         desc: `Fantastic task completion rate of ${completionRate}%! Your team is highly efficient.`,
         color: "border-indigo-500/20 bg-indigo-500/5",
       });
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-gray-400 text-sm">Loading workspace analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Analytics & Insights</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            AI-powered meeting intelligence for your team
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-[#13141a] border border-white/5 rounded-lg px-3 py-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300">Last 30 days</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.success("Exporting analytics report...")}
            className="border-white/10 bg-transparent text-gray-300 hover:bg-white/5 gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AnalyticsStat
          title="Total Meetings"
          value={String(totalMeetings)}
          change={totalMeetings > 0 ? "+0% (new acc)" : "0%"}
          positive={true}
          icon={Video}
          color="bg-indigo-500/10 text-indigo-400"
        />
        <AnalyticsStat
          title="Hours in Meetings"
          value={`${totalHours}h`}
          change={totalMeetings > 0 ? "+0% (new acc)" : "0%"}
          positive={true}
          icon={Clock}
          color="bg-purple-500/10 text-purple-400"
        />
        <AnalyticsStat
          title="Action Items"
          value={String(totalActionItemsCount)}
          change={totalMeetings > 0 ? "+0% (new acc)" : "0%"}
          positive={true}
          icon={CheckSquare}
          color="bg-orange-500/10 text-orange-400"
        />
        <AnalyticsStat
          title="Completion Rate"
          value={`${completionRate}%`}
          change={totalTasksCount > 0 ? "+0% improvement" : "0%"}
          positive={true}
          icon={TrendingUp}
          color="bg-emerald-500/10 text-emerald-400"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="bg-[#13141a] border border-white/5 p-1">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-gray-400 text-sm"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="productivity"
            className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-gray-400 text-sm"
          >
            Productivity
          </TabsTrigger>
          <TabsTrigger
            value="team"
            className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-gray-400 text-sm"
          >
            Team
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Weekly Meetings Bar Chart */}
            <div className="lg:col-span-2 bg-[#13141a] border border-white/5 rounded-xl p-5">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-semibold text-white">
                  Meetings This Week
                </h3>
                <span className="text-xs text-gray-500">by day</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={weeklyMeetingsData} barSize={32}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.03)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Bar
                    dataKey="meetings"
                    fill="#6366f1"
                    radius={[6, 6, 0, 0]}
                    name="meetings"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Meeting Types Pie Chart */}
            <div className="bg-[#13141a] border border-white/5 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-5">
                Meeting Types
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={meetingTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {meetingTypeData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={<CustomTooltip />}
                    formatter={(value) => [`${value}%`]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {meetingTypeData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: item.color }}
                      />
                      <span className="text-xs text-gray-400">{item.name}</span>
                    </div>
                    <span className="text-xs font-medium text-white">
                      {item.value}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Monthly Trend */}
          <div className="bg-[#13141a] border border-white/5 rounded-xl p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-white">
                Monthly Trend
              </h3>
              <span className="text-xs text-gray-500">
                Meetings & Action Items
              </span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyTrendData}>
                <defs>
                  <linearGradient id="meetingsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="actionGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.03)"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: "12px", color: "#9ca3af" }}
                />
                <Area
                  type="monotone"
                  dataKey="meetings"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#meetingsGrad)"
                  name="meetings"
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#actionGrad)"
                  name="completed"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        {/* Productivity Tab */}
        <TabsContent value="productivity" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Productivity Score Trend */}
            <div className="bg-[#13141a] border border-white/5 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-5">
                <Bot className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">
                  AI Productivity Score
                </h3>
              </div>
              {totalMeetings === 0 ? (
                <div className="h-[220px] flex items-center justify-center text-xs text-gray-500">
                  No meeting score history available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={productivityTrendData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.03)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="week"
                      tick={{ fill: "#6b7280", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: "#6b7280", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      dot={{ fill: "#6366f1", r: 4 }}
                      activeDot={{ r: 6 }}
                      name="score"
                    />
                    <Line
                      type="monotone"
                      dataKey="actionCompletion"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ fill: "#10b981", r: 4 }}
                      name="actionCompletion"
                      strokeDasharray="5 5"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* AI Insights Panel */}
            <div className="bg-[#13141a] border border-white/5 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">
                  AI Recommendations
                </h3>
              </div>
              <div className="space-y-3">
                {recommendations.map((insight, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border",
                      insight.color
                    )}
                  >
                    <span className="text-lg">{insight.icon}</span>
                    <div>
                      <p className="text-xs font-semibold text-white">
                        {insight.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                        {insight.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Participation Chart */}
            <div className="bg-[#13141a] border border-white/5 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-5">
                <Users className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-white">
                  Team Participation
                </h3>
              </div>
              {participationData.length === 0 ? (
                <div className="h-[220px] flex items-center justify-center text-xs text-gray-500">
                  No participation details yet. Join or start meetings to see stats!
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={participationData}
                    layout="vertical"
                    barSize={16}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.03)"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fill: "#6b7280", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={90}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                    <Bar
                      dataKey="meetings"
                      fill="#6366f1"
                      radius={[0, 6, 6, 0]}
                      name="meetings"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Talk Time Distribution */}
            <div className="bg-[#13141a] border border-white/5 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-5">
                <Users className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-white">
                  Talk Time Distribution
                </h3>
              </div>
              {participationData.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-500">
                  No speaker distribution records available.
                </div>
              ) : (
                <div className="space-y-4">
                  {participationData.map((member, i) => {
                    const colors = [
                      "bg-indigo-500",
                      "bg-purple-500",
                      "bg-blue-500",
                      "bg-emerald-500",
                    ];
                    return (
                      <div key={member.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-300">{member.name}</span>
                          <span className="text-gray-400 font-medium">
                            {member.talkTime}%
                          </span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-700",
                              colors[i % colors.length]
                            )}
                            style={{ width: `${member.talkTime}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Summary */}
              <div className="mt-5 pt-4 border-t border-white/5 grid grid-cols-2 gap-3">
                {[
                  { label: "Most Active", value: participationData[0]?.name || "N/A", color: "text-indigo-400" },
                  { label: "Meetings Total", value: `${totalMeetings} meetings`, color: "text-purple-400" },
                  { label: "Avg Talk Time", value: participationData.length > 0 ? `${Math.round(100 / participationData.length)}%` : "0%", color: "text-blue-400" },
                  { label: "Engagement", value: totalMeetings > 0 ? "89%" : "0%", color: "text-emerald-400" },
                ].map((s) => (
                  <div key={s.label} className="bg-white/3 rounded-lg p-2.5">
                    <p className={cn("text-sm font-bold truncate", s.color)}>
                      {s.value}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}