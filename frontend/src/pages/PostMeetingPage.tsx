import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bot,
  CheckSquare,
  Clock,
  Copy,
  Download,
  FileText,
  Users,
  Play,
  Check,
  Calendar,
  TrendingUp,
  MessageSquare,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { getActionItems, getMeetingSummary, getMeetingTranscript } from "@/api/ai";

// Mock post-meeting data
const fallbackMeetingData = {
  id: "test-meeting-123",
  title: "Sprint Planning — Week 19",
  date: new Date(Date.now() - 3600000),
  duration: "48 minutes",
  participants: [
    { id: "u1", name: "Joel Thomas", role: "Host", avatar: "" },
    { id: "u2", name: "Sarah Connor", role: "Member", avatar: "" },
    { id: "u3", name: "Mike Ross", role: "Member", avatar: "" },
    { id: "u4", name: "Anna Lee", role: "Member", avatar: "" },
  ],
  summary: `The team conducted the Week 19 Sprint Planning session. Joel Thomas opened the meeting by reviewing last sprint's velocity and identifying key blockers. Sarah Connor presented the completed authentication module and outlined her plan for the dashboard components. Mike Ross confirmed the API integration is on track and will be completed by end of day tomorrow. Anna Lee raised concerns about the design inconsistencies in the mobile view, which the team agreed to address in this sprint. The team committed to 34 story points for the sprint, focusing on the dashboard, API integration, and mobile responsiveness.`,
  keyPoints: [
    "Authentication module completed successfully by Sarah Connor",
    "API integration 80% complete, ETA tomorrow",
    "Mobile design inconsistencies identified — added to sprint backlog",
    "Team committed to 34 story points for Sprint 19",
    "Next sprint review scheduled for May 15th",
  ],
  actionItems: [
    {
      id: "a1",
      text: "Complete API integration and write unit tests",
      assigneeName: "Mike Ross",
      assignee: { name: "Mike Ross", avatar: "" },
      due: "Tomorrow",
      priority: "high",
      status: "pending",
    },
    {
      id: "a2",
      text: "Build dashboard UI components (charts, stats cards)",
      assigneeName: "Sarah Connor",
      assignee: { name: "Sarah Connor", avatar: "" },
      due: "May 12",
      priority: "high",
      status: "pending",
    },
    {
      id: "a3",
      text: "Fix mobile responsive design issues on login page",
      assigneeName: "Anna Lee",
      assignee: { name: "Anna Lee", avatar: "" },
      due: "May 11",
      priority: "medium",
      status: "pending",
    },
    {
      id: "a4",
      text: "Update sprint board with new tickets",
      assigneeName: "Joel Thomas",
      assignee: { name: "Joel Thomas", avatar: "" },
      due: "Today",
      priority: "low",
      status: "done",
    },
  ],
  transcript: [
    { speaker: "Joel Thomas", time: "0:00", text: "Good afternoon everyone, let's get started with Sprint 19 planning." },
    { speaker: "Joel Thomas", time: "0:45", text: "Looking at last sprint, we completed 31 out of 36 story points. Good progress overall." },
    { speaker: "Sarah Connor", time: "2:10", text: "I finished the authentication module. JWT with refresh tokens is working perfectly." },
    { speaker: "Mike Ross", time: "3:30", text: "API integration is about 80% done. Should have it wrapped up by tomorrow morning." },
    { speaker: "Anna Lee", time: "5:15", text: "I noticed some design inconsistencies in the mobile view — the login page especially." },
    { speaker: "Joel Thomas", time: "6:00", text: "Good catch Anna, let's add that to this sprint. What's everyone's capacity this week?" },
    { speaker: "Sarah Connor", time: "7:20", text: "I can take on about 13 story points." },
    { speaker: "Mike Ross", time: "7:45", text: "Same for me, around 12-13." },
    { speaker: "Anna Lee", time: "8:10", text: "I can handle 8 points this week." },
  ],
  stats: {
    talkTime: { joel: 35, sarah: 28, mike: 22, anna: 15 },
    sentiment: "Positive",
    engagementScore: 89,
    aiConfidence: 94,
  },
};

const priorityConfig = {
  high: "bg-red-500/15 text-red-400 border-red-500/20",
  medium: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  low: "bg-gray-500/15 text-gray-400 border-gray-500/20",
};

export default function PostMeetingPage() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const [meetingData, setMeetingData] = useState(fallbackMeetingData);
  const [checkedItems, setCheckedItems] = useState<string[]>(
    fallbackMeetingData.actionItems
      .filter((a) => a.status === "done" || a.status === "completed")
      .map((a) => a.id)
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadAnalysis() {
      if (!meetingId) return;

      try {
        const [summary, transcript, actionItems] = await Promise.all([
          getMeetingSummary(meetingId),
          getMeetingTranscript(meetingId),
          getActionItems(meetingId),
        ]);

        if (!mounted) return;

        setMeetingData((current) => {
          const transcriptLines = transcript?.segments?.length
            ? transcript.segments.map((segment: { speakerName?: string; text: string; startTime?: number }, index: number) => ({
                speaker: segment.speakerName || 'Speaker',
                time:
                  segment.startTime !== undefined
                    ? `${Math.floor(segment.startTime / 60)}:${Math.floor(segment.startTime % 60)
                        .toString()
                        .padStart(2, '0')}`
                    : `0:${index.toString().padStart(2, '0')}`,
                text: segment.text,
              }))
            : current.transcript;

          return {
            ...current,
            id: meetingId,
            summary: summary?.summary || current.summary,
            keyPoints: summary?.keyPoints?.length ? summary.keyPoints : current.keyPoints,
            transcript: transcriptLines,
            actionItems: actionItems.length
              ? actionItems.map((item) => ({
                  id: item._id,
                  text: item.text,
                  assigneeName: item.assigneeName || 'Unassigned',
                  assignee: { name: item.assigneeName || 'Unassigned', avatar: '' },
                  due: item.dueDate ? format(new Date(item.dueDate), 'MMM d') : 'TBD',
                  priority: item.priority,
                  status: item.status === 'completed' ? 'done' : item.status,
                }))
              : current.actionItems,
            stats: summary
              ? {
                  ...current.stats,
                  sentiment: summary.sentiment || current.stats.sentiment,
                  engagementScore: summary.engagementScore || current.stats.engagementScore,
                  aiConfidence: summary.status === 'completed' ? 98 : current.stats.aiConfidence,
                }
              : current.stats,
          };
        });

        setCheckedItems(
          actionItems
            .filter((item) => item.status === 'completed')
            .map((item) => item._id)
        );
      } catch (error) {
        console.error('[post-meeting] failed to load AI analysis', error);
      }
    }

    void loadAnalysis();

    return () => {
      mounted = false;
    };
  }, [meetingId]);

  const toggleActionItem = (id: string) => {
    setCheckedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
    toast.success("Action item updated!");
  };

  const handleCopySummary = () => {
    navigator.clipboard.writeText(meetingData.summary);
    setCopied(true);
    toast.success("Summary copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    toast.success("Exporting meeting report...");
  };

  const handleShare = () => {
    toast.success("Share link copied!");
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="border-white/10 bg-transparent text-gray-400 hover:text-white hover:bg-white/5 mt-1"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white">
              {meetingData.title}
            </h1>
            <div className="flex items-center gap-3 mt-1.5 text-sm text-gray-400">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {format(meetingData.date, "MMMM d, yyyy 'at' h:mm a")}
              </span>
              <span className="text-gray-600">•</span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {meetingData.duration}
              </span>
              <span className="text-gray-600">•</span>
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                {meetingData.participants.length} participants
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="border-white/10 bg-transparent text-gray-300 hover:bg-white/5 gap-2"
          >
            <Share2 className="w-4 h-4" />
            Share
          </Button>
          <Button
            size="sm"
            onClick={handleExport}
            className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2"
          >
            <Download className="w-4 h-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Duration",
            value: meetingData.duration,
            icon: Clock,
            color: "text-indigo-400",
          },
          {
            label: "Participants",
            value: meetingData.participants.length,
            icon: Users,
            color: "text-blue-400",
          },
          {
            label: "Action Items",
            value: meetingData.actionItems.length,
            icon: CheckSquare,
            color: "text-orange-400",
          },
          {
            label: "AI Confidence",
            value: `${meetingData.stats.aiConfidence}%`,
            icon: Bot,
            color: "text-emerald-400",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-[#13141a] border border-white/5 rounded-xl p-4 flex items-center gap-3"
          >
            <stat.icon className={cn("w-5 h-5", stat.color)} />
            <div>
              <p className="text-lg font-bold text-white">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList className="bg-[#13141a] border border-white/5 p-1">
          <TabsTrigger
            value="summary"
            className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-gray-400 text-sm"
          >
            <Bot className="w-3.5 h-3.5 mr-1.5" />
            AI Summary
          </TabsTrigger>
          <TabsTrigger
            value="actions"
            className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-gray-400 text-sm"
          >
            <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
            Action Items
          </TabsTrigger>
          <TabsTrigger
            value="transcript"
            className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-gray-400 text-sm"
          >
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            Transcript
          </TabsTrigger>
          <TabsTrigger
            value="insights"
            className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-gray-400 text-sm"
          >
            <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
            Insights
          </TabsTrigger>
        </TabsList>

        {/* AI Summary Tab */}
        <TabsContent value="summary" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Summary */}
            <div className="lg:col-span-2 bg-[#13141a] border border-white/5 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-semibold text-white">
                    Meeting Summary
                  </h3>
                  <Badge className="bg-indigo-500/15 text-indigo-300 border-indigo-500/20 text-xs">
                    AI Generated
                  </Badge>
                </div>
                <button
                  onClick={handleCopySummary}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">
                {meetingData.summary}
              </p>

              {/* Key Points */}
              <div className="space-y-2 pt-2 border-t border-white/5">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Key Points
                </h4>
                <ul className="space-y-2">
                  {meetingData.keyPoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-2 flex-shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right Panel */}
            <div className="space-y-4">
              {/* Participants */}
              <div className="bg-[#13141a] border border-white/5 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  Participants
                </h3>
                <div className="space-y-2">
                  {meetingData.participants.map((p) => (
                    <div key={p.id} className="flex items-center gap-3">
                      <Avatar className="w-7 h-7">
                        <AvatarFallback className="bg-indigo-600 text-white text-xs">
                          {p.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">
                          {p.name}
                        </p>
                        <p className="text-xs text-gray-500">{p.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recording */}
              <div className="bg-[#13141a] border border-white/5 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Play className="w-4 h-4 text-red-400" />
                  Recording
                </h3>
                <div className="bg-white/3 rounded-lg p-4 text-center space-y-2">
                  <div className="w-10 h-10 bg-red-500/15 rounded-full flex items-center justify-center mx-auto">
                    <Play className="w-5 h-5 text-red-400" />
                  </div>
                  <p className="text-xs text-gray-400">
                    Meeting recording available
                  </p>
                  <p className="text-xs text-gray-500">
                    {meetingData.duration}
                  </p>
                  <Button
                    size="sm"
                    className="w-full bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 text-xs"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Download
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Action Items Tab */}
        <TabsContent value="actions">
          <div className="bg-[#13141a] border border-white/5 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-orange-400" />
                Action Items
                <Badge className="bg-orange-500/15 text-orange-300 border-orange-500/20 text-xs">
                  {meetingData.actionItems.filter((a) => !checkedItems.includes(a.id)).length} pending
                </Badge>
              </h3>
            </div>

            <div className="space-y-3">
              {meetingData.actionItems.map((item) => {
                const isDone = checkedItems.includes(item.id);
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-start gap-4 p-4 rounded-xl border transition-all duration-200",
                      isDone
                        ? "bg-white/2 border-white/5 opacity-60"
                        : "bg-white/3 border-white/10 hover:border-white/20"
                    )}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleActionItem(item.id)}
                      className={cn(
                        "w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all",
                        isDone
                          ? "bg-emerald-500 border-emerald-500"
                          : "border-white/20 hover:border-indigo-400"
                      )}
                    >
                      {isDone && <Check className="w-3 h-3 text-white" />}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm text-white", isDone && "line-through text-gray-500")}>
                        {item.text}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1.5">
                          <Avatar className="w-5 h-5">
                              <AvatarFallback className="bg-indigo-600 text-white text-[10px]">
                                {(item.assignee?.name || item.assigneeName || 'U').charAt(0)}
                              </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-gray-400">
                            {item.assignee?.name || item.assigneeName || 'Unassigned'}
                          </span>
                        </div>
                        <span className="text-gray-600 text-xs">•</span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Due {item.due}
                        </span>
                      </div>
                    </div>

                    {/* Priority Badge */}
                    <Badge className={cn("text-xs border capitalize flex-shrink-0", priorityConfig[item.priority as keyof typeof priorityConfig])}>
                      {item.priority}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* Transcript Tab */}
        <TabsContent value="transcript">
          <div className="bg-[#13141a] border border-white/5 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-400" />
                Full Transcript
              </h3>
              <Button
                variant="outline"
                size="sm"
                className="border-white/10 bg-transparent text-gray-300 hover:bg-white/5 text-xs gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </Button>
            </div>

            <div className="space-y-4">
              {meetingData.transcript.map((line, i) => (
                <div key={i} className="flex gap-4 group">
                  <span className="text-xs text-gray-600 font-mono mt-1 min-w-[35px]">
                    {line.time}
                  </span>
                  <div className="flex-1 space-y-0.5">
                    <span className="text-xs font-semibold text-indigo-400">
                      {line.speaker}
                    </span>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {line.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Talk Time */}
            <div className="bg-[#13141a] border border-white/5 rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
                Talk Time Distribution
              </h3>
              <div className="space-y-3">
                {Object.entries(meetingData.stats.talkTime).map(([name, pct]) => {
                  const fullName = meetingData.participants.find((p) =>
                    p.name.toLowerCase().includes(name)
                  )?.name || name;
                  return (
                    <div key={name} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-300 capitalize">{fullName}</span>
                        <span className="text-gray-400">{pct}%</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Meeting Health */}
            <div className="bg-[#13141a] border border-white/5 rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Bot className="w-4 h-4 text-emerald-400" />
                Meeting Health Score
              </h3>
              <div className="space-y-4">
                {[
                  { label: "Engagement Score", value: meetingData.stats.engagementScore, color: "bg-indigo-500" },
                  { label: "AI Confidence", value: meetingData.stats.aiConfidence, color: "bg-emerald-500" },
                  { label: "Action Item Coverage", value: 78, color: "bg-orange-500" },
                  { label: "Participation Balance", value: 72, color: "bg-purple-500" },
                ].map((metric) => (
                  <div key={metric.label} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-300">{metric.label}</span>
                      <span className="text-white font-medium">{metric.value}%</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", metric.color)}
                        style={{ width: `${metric.value}%` }}
                      />
                    </div>
                  </div>
                ))}

                <div className="pt-3 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Overall Sentiment</span>
                    <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/20 text-xs">
                      {meetingData.stats.sentiment}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}