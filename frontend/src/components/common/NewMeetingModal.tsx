import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { createMeeting } from "@/api/meetings";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Video,
  Copy,
  Check,
  Users,
  Clock,
  Loader2,
  Link,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface NewMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const schema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  date: z.string().optional(),
  time: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

// Generate random meeting ID
const generateMeetingId = () => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const segment = (len: number) =>
    Array.from({ length: len }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  return `${segment(3)}-${segment(4)}-${segment(3)}`;
};

type MeetingMode = "instant" | "schedule" | "join";

export default function NewMeetingModal({
  isOpen,
  onClose,
}: NewMeetingModalProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<MeetingMode>("instant");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [joinId, setJoinId] = useState("");
  const [meetingId] = useState(generateMeetingId());
  const [muteOnJoin, setMuteOnJoin] = useState(false);
  const [videoOff, setVideoOff] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "My Meeting",
      date: format(new Date(), "yyyy-MM-dd"),
      time: format(new Date(), "HH:mm"),
    },
  });

  const meetingLink = `${window.location.origin}/meeting/${meetingId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(meetingLink);
    setCopied(true);
    toast.success("Meeting link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartMeeting = async (data: FormData) => {
    try {
      setIsLoading(true);
      const res = await createMeeting({
        title: data.title,
        scheduledTime: new Date().toISOString(),
        status: "live",
      });
      toast.success(`Starting "${res.meeting.title}"...`);
      onClose();
      navigate(`/meeting/${res.meeting.meetingCode || res.meeting._id}`, {
        state: {
          initialMuted: muteOnJoin,
          initialVideoOff: videoOff,
        }
      });
    } catch (err) {
      toast.error("Failed to start meeting");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinMeeting = () => {
    if (!joinId.trim()) {
      toast.error("Please enter a meeting ID");
      return;
    }
    const cleanId = joinId.trim().toLowerCase().replace(/[\s_]+/g, "-");
    toast.success("Joining meeting...");
    onClose();
    navigate(`/meeting/${cleanId}`);
  };

  const handleSchedule = async (data: FormData) => {
    try {
      setIsLoading(true);
      const scheduledTime = new Date(`${data.date}T${data.time}`).toISOString();
      const res = await createMeeting({
        title: data.title,
        scheduledTime,
        status: "scheduled",
      });
      toast.success(`Meeting "${res.meeting.title}" scheduled!`);
      onClose();
    } catch (err) {
      toast.error("Failed to schedule meeting");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#13141a] border border-white/10 text-white max-w-md p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-lg font-bold text-white">
            Meeting Options
          </DialogTitle>
        </DialogHeader>

        {/* Mode Selector */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-3 gap-2 bg-white/5 rounded-xl p-1">
            {[
              { id: "instant", label: "Start Now", icon: Video },
              { id: "schedule", label: "Schedule", icon: Calendar },
              { id: "join", label: "Join", icon: Users },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id as MeetingMode)}
                className={cn(
                  "flex flex-col items-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-medium transition-all duration-200",
                  mode === m.id
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                    : "text-gray-400 hover:text-white"
                )}
              >
                <m.icon className="w-4 h-4" />
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 pt-4">
          {/* Start Now Mode */}
          {mode === "instant" && (
            <form
              onSubmit={handleSubmit(handleStartMeeting)}
              className="space-y-4"
            >
              {/* Title */}
              <div className="space-y-2">
                <Label className="text-gray-300 text-sm">Meeting Title</Label>
                <Input
                  {...register("title")}
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-indigo-500 h-10"
                  placeholder="e.g. Team Standup"
                />
                {errors.title && (
                  <p className="text-red-400 text-xs">
                    {errors.title.message}
                  </p>
                )}
              </div>

              {/* Meeting Link */}
              <div className="space-y-2">
                <Label className="text-gray-300 text-sm">
                  Your Meeting Link
                </Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 h-10 overflow-hidden">
                    <Link className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                    <span className="text-xs text-gray-400 truncate">
                      {meetingLink}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Options */}
              <div className="flex items-center gap-3 py-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={muteOnJoin}
                    onChange={(e) => setMuteOnJoin(e.target.checked)}
                    className="w-3.5 h-3.5 rounded accent-indigo-500"
                  />
                  <span className="text-xs text-gray-400">Mute on join</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={videoOff}
                    onChange={(e) => setVideoOff(e.target.checked)}
                    className="w-3.5 h-3.5 rounded accent-indigo-500"
                  />
                  <span className="text-xs text-gray-400">Video off</span>
                </label>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  onClick={onClose}
                  variant="outline"
                  className="flex-1 border-white/10 bg-transparent text-gray-300 hover:bg-white/5"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Video className="w-4 h-4 mr-2" />
                      Start Meeting
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* Schedule Mode */}
          {mode === "schedule" && (
            <form
              onSubmit={handleSubmit(handleSchedule)}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label className="text-gray-300 text-sm">Meeting Title</Label>
                <Input
                  {...register("title")}
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-indigo-500 h-10"
                  placeholder="e.g. Sprint Planning"
                />
                {errors.title && (
                  <p className="text-red-400 text-xs">
                    {errors.title.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-gray-300 text-sm">Date</Label>
                  <Input
                    type="date"
                    {...register("date")}
                    className="bg-white/5 border-white/10 text-white h-10 focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300 text-sm">Time</Label>
                  <Input
                    type="time"
                    {...register("time")}
                    className="bg-white/5 border-white/10 text-white h-10 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300 text-sm">
                  Duration
                </Label>
                <div className="flex items-center gap-2">
                  {["30 min", "45 min", "1 hour", "2 hours"].map((d) => (
                    <button
                      key={d}
                      type="button"
                      className="flex-1 py-2 text-xs border border-white/10 rounded-lg text-gray-400 hover:border-indigo-500 hover:text-indigo-400 transition-colors"
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300 text-sm">
                  Invite Participants
                </Label>
                <Input
                  type="email"
                  placeholder="Enter email addresses..."
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-indigo-500 h-10"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  onClick={onClose}
                  variant="outline"
                  className="flex-1 border-white/10 bg-transparent text-gray-300 hover:bg-white/5"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule
                </Button>
              </div>
            </form>
          )}

          {/* Join Mode */}
          {mode === "join" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-300 text-sm">
                  Meeting ID or Link
                </Label>
                <Input
                  value={joinId}
                  onChange={(e) => setJoinId(e.target.value)}
                  placeholder="e.g. abc-1234-xyz"
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-indigo-500 h-10"
                  onKeyDown={(e) => e.key === "Enter" && handleJoinMeeting()}
                />
                <p className="text-xs text-gray-500">
                  Enter the meeting ID or paste the full meeting link
                </p>
              </div>

              {/* Quick Join Options */}
              <div className="space-y-2">
                <p className="text-xs text-gray-500 font-medium">
                  Recent Meetings
                </p>
                {[
                  { title: "Sprint Planning", id: "test-meeting-123" },
                  { title: "Team Standup", id: "abc-1234-xyz" },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setJoinId(m.id)}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-white/3 hover:bg-white/5 border border-white/5 hover:border-white/10 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Video className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-sm text-gray-300">{m.title}</span>
                    </div>
                    <span className="text-xs text-gray-500">{m.id}</span>
                  </button>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="flex-1 border-white/10 bg-transparent text-gray-300 hover:bg-white/5"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleJoinMeeting}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Join Meeting
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}