import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";
import { useMeetingRoom } from "@/hooks/useMeetingRoom";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useMeetingChat } from "@/hooks/useMeetingChat";
import { useTranscription } from "@/hooks/useTranscription";
import { getMeetingChatHistory } from "@/api/chat";
import { transcribeMeeting } from "@/api/ai";
import MeetingControls from "@/components/meeting/MeetingControls";
import VideoTile from "@/components/meeting/VideoTile";
import ChatPanel from "@/components/meeting/ChatPanel";
import ParticipantsPanel from "@/components/meeting/ParticipantsPanel";
import TranscriptionPanel from "@/components/meeting/TranscriptionPanel";
import { Bot, Clock, Wifi, WifiOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSocketStore } from "@/store/socketStore";
import type { Participant } from "@/types";

export default function MeetingRoomPage() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { isConnected } = useSocketStore();

  // Real-time hooks
  const { participants, isJoined, meeting, leaveRoom } = useMeetingRoom({
    meetingId: meetingId || '',
    autoJoin: true,
  });
  const {
    localStream,
    remoteStreams,
    isMuted,
    isVideoOff,
    isScreenSharing,
    initLocalStream,
    toggleMute,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
  } = useWebRTC(meetingId || '');
  const { messages, typingUsers, sendMessage, setTyping, loadHistory } =
    useMeetingChat(meetingId || '');
  const {
    transcriptLines,
    isTranscribing,
    startRecording,
    stopRecording,
    applyTranscriptionResult,
  } = useTranscription(meetingId || '');

  // Local state
  const [isRecording, setIsRecording] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isInitializing, setIsInitializing] = useState(true);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // Initialize media on mount
  useEffect(() => {
    (async () => {
      try {
        await initLocalStream();
      } catch (error) {
        console.error('[meeting] failed to initialize local media', error);
        toast.error('Could not access camera/microphone. You can still join chat.');
      } finally {
        setIsInitializing(false);
      }
    })();
  }, [initLocalStream]);

  // Attach local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Load chat history
  useEffect(() => {
    if (meetingId) {
      getMeetingChatHistory(meetingId)
        .then((history) => loadHistory(history))
        .catch(() => {});
    }
  }, [meetingId, loadHistory]);

  // Timer
  useEffect(() => {
    const timer = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Start transcription recording when joined
  useEffect(() => {
    if (isJoined && localStream && !isTranscribing) {
      console.log('[meeting] joined room, starting transcription recorder');
      startRecording(localStream);
    }
  }, [isJoined, localStream, isTranscribing, startRecording]);

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0)
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleToggleMute = () => {
    const nextMuted = toggleMute();
    if (typeof nextMuted === 'boolean') {
      toast.info(nextMuted ? "Microphone muted" : "Microphone on");
      return;
    }
    toast.info("Microphone state unavailable");
  };

  const handleToggleVideo = () => {
    const nextVideoOff = toggleVideo();
    if (typeof nextVideoOff === 'boolean') {
      toast.info(nextVideoOff ? "Camera off" : "Camera on");
      return;
    }
    toast.info("Camera state unavailable");
  };

  const handleToggleScreenShare = () => {
    if (isScreenSharing) {
      stopScreenShare();
      toast.info("Screen sharing stopped");
    } else {
      startScreenShare();
      toast.info("Screen sharing started");
    }
  };

  const handleToggleRecording = () => {
    setIsRecording(!isRecording);
    toast.info(isRecording ? "Recording stopped" : "Recording started");
  };

  const handleSendMessage = (text: string) => {
    sendMessage(text);
  };

  const handleLeave = async () => {
    toast.info("Processing meeting...");

    leaveRoom();

    // Stop transcription and upload audio
    const audioBlob = await stopRecording();
    if (audioBlob && meetingId) {
      try {
        const result = await transcribeMeeting(meetingId, audioBlob);
        applyTranscriptionResult(result?.data);
      } catch (err) {
        console.error('Failed to process meeting:', err);
      }
    }

    setTimeout(() => navigate(`/meeting/${meetingId}/post`), 500);
  };

  // Build participant list for display
  const displayParticipants: Array<{
    id: string;
    name: string;
    isMuted: boolean;
    isVideoOff: boolean;
    isHost: boolean;
    isSpeaking: boolean;
    socketId: string;
  }> = [
    // Local user always first
    {
      id: user?._id || 'local',
      name: user?.name || 'You',
      isMuted,
      isVideoOff,
      isHost: meeting?.hostId ? meeting.hostId === user?._id : true,
      isSpeaking: false,
      socketId: 'local',
    },
    // Remote participants from socket
    ...participants
      .filter((p) => p.userId !== user?._id)
      .map((p) => ({
        id: p.userId,
        name: p.userName,
        isMuted: p.isMuted || false,
        isVideoOff: p.isVideoOff || false,
        isHost: meeting?.hostId ? p.userId === meeting.hostId : false,
        isSpeaking: p.isSpeaking || false,
        socketId: p.socketId,
      })),
  ];

  // Map transcript lines for the panel
  const transcriptDisplay = transcriptLines.map((line, i) => ({
    id: line.id || `t-${i}`,
    speaker: line.speaker,
    text: line.text,
    timestamp: line.timestamp,
  }));

  // Typing indicator text
  const typingText =
    typingUsers.size > 0
      ? `${Array.from(typingUsers.values()).join(', ')} typing...`
      : '';

  if (isInitializing) {
    return (
      <div className="h-screen bg-[#0a0b0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-gray-400 text-sm">Initializing meeting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0a0b0f] flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="h-14 bg-[#0d0e14]/95 border-b border-white/5 flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-sm font-semibold text-white">{meeting?.title || 'Meeting Room'}</h1>
            <p className="text-xs text-gray-500">ID: {meetingId}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-sm font-mono text-white">
            {formatDuration(duration)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex items-center gap-1.5 text-xs",
              isConnected ? "text-emerald-400" : "text-red-400"
            )}
          >
            {isConnected ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : (
              <WifiOff className="w-3.5 h-3.5" />
            )}
            <span>{isConnected ? "Connected" : "Reconnecting..."}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-indigo-500/15 border border-indigo-500/20 rounded-lg px-2.5 py-1">
            <Bot className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-xs text-indigo-300 font-medium">
              AI Active
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Grid */}
        <div className="flex-1 p-4 relative overflow-hidden">
          <div
            className={cn(
              "h-full grid gap-3",
              displayParticipants.length === 1 && "grid-cols-1",
              displayParticipants.length === 2 && "grid-cols-2",
              displayParticipants.length === 3 && "grid-cols-2 grid-rows-2",
              displayParticipants.length === 4 && "grid-cols-2 grid-rows-2",
              displayParticipants.length > 4 && "grid-cols-3"
            )}
          >
            {displayParticipants.map((participant, index) => {
              const isLocal = index === 0;
              const remoteStream = !isLocal
                ? remoteStreams.get(participant.socketId)
                : undefined;

              return (
                <VideoTile
                  key={participant.id}
                  name={participant.name}
                  isMuted={participant.isMuted}
                  isVideoOff={participant.isVideoOff}
                  isSpeaking={participant.isSpeaking}
                  isLocal={isLocal}
                  videoRef={isLocal ? localVideoRef : undefined}
                  stream={isLocal ? localStream : remoteStream || null}
                />
              );
            })}
          </div>

          {/* Typing indicator */}
          {typingText && (
            <div className="absolute bottom-28 left-4 bg-[#0d0e14]/90 border border-white/10 rounded-lg px-3 py-1.5">
              <span className="text-xs text-gray-400 italic">{typingText}</span>
            </div>
          )}

          {/* Live Transcription Overlay */}
          <TranscriptionPanel lines={transcriptDisplay} isLive={isTranscribing} />
        </div>

        {/* Side Panels */}
        {isParticipantsOpen && (
          <ParticipantsPanel
            participants={displayParticipants}
            onClose={() => setIsParticipantsOpen(false)}
          />
        )}
        {isChatOpen && (
          <ChatPanel
            messages={messages}
            onSendMessage={handleSendMessage}
            onClose={() => setIsChatOpen(false)}
            onTypingChange={setTyping}
          />
        )}
      </div>

      {/* Controls */}
      <MeetingControls
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        isScreenSharing={isScreenSharing}
        isRecording={isRecording}
        isChatOpen={isChatOpen}
        isParticipantsOpen={isParticipantsOpen}
        onToggleMute={handleToggleMute}
        onToggleVideo={handleToggleVideo}
        onToggleScreenShare={handleToggleScreenShare}
        onToggleRecording={handleToggleRecording}
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
        onToggleParticipants={() =>
          setIsParticipantsOpen(!isParticipantsOpen)
        }
        onLeave={handleLeave}
      />
    </div>
  );
}