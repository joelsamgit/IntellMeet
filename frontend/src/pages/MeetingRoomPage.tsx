import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";
import { useMeetingRoom } from "@/hooks/useMeetingRoom";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useMeetingChat } from "@/hooks/useMeetingChat";
import { useTranscription } from "@/hooks/useTranscription";
import { getMeetingChatHistory } from "@/api/chat";
import { transcribeMeeting, processMeeting } from "@/api/ai";
import MeetingControls from "@/components/meeting/MeetingControls";
import VideoTile from "@/components/meeting/VideoTile";
import ChatPanel from "@/components/meeting/ChatPanel";
import ParticipantsPanel from "@/components/meeting/ParticipantsPanel";
import TranscriptionPanel from "@/components/meeting/TranscriptionPanel";
import { Bot, Clock, Wifi, WifiOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSocketStore } from "@/store/socketStore";
import type { Participant } from "@/types";

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0b0f] flex flex-col items-center justify-center p-6 text-white text-center">
          <h2 className="text-xl font-bold text-red-500 mb-2">Application Error</h2>
          <p className="text-sm text-gray-400 mb-4">The meeting room crashed during rendering:</p>
          <pre className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg text-xs font-mono max-w-2xl overflow-auto text-red-400 text-left">
            {this.state.error?.stack || this.state.error?.message || String(this.state.error)}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

function MeetingRoomContent() {
  const { meetingId: rawMeetingId } = useParams<{ meetingId: string }>();
  const meetingId = rawMeetingId?.trim().toLowerCase().replace(/[\s_]+/g, "-") || "";
  const navigate = useNavigate();
  const location = useLocation();
  const { initialMuted = false, initialVideoOff = false } = (location.state as any) || {};
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
    recognitionStatus,
    isSilenceDetected,
    startRecording,
    stopRecording,
    applyTranscriptionResult,
    startAudioAnalyzer,
    stopAudioAnalyzer,
  } = useTranscription(meetingId || '', isMuted);

  // Local state
  const [isRecording, setIsRecording] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isInitializing, setIsInitializing] = useState(true);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const recordingBlobRef = useRef<Blob | null>(null);

  // Initialize media on mount
  useEffect(() => {
    (async () => {
      try {
        await initLocalStream(initialMuted, initialVideoOff);
      } catch (error) {
        console.error('[meeting] failed to initialize local media', error);
        toast.error('Could not access camera/microphone. You can still join chat.');
      } finally {
        setIsInitializing(false);
      }
    })();
  }, [initLocalStream, initialMuted, initialVideoOff]);

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

  // Start audio analyzer when joined
  useEffect(() => {
    if (isJoined && localStream) {
      console.log('[meeting] joined room, starting audio analyzer');
      startAudioAnalyzer(localStream);
    }
  }, [isJoined, localStream, startAudioAnalyzer]);

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
    if (isRecording) {
      void stopRecording().then((blob) => {
        if (blob) {
          recordingBlobRef.current = blob;
          toast.success("Recording saved successfully!");
        }
      });
      setIsRecording(false);
      toast.info("Recording stopped");
    } else {
      if (localStream) {
        void startRecording(localStream);
        setIsRecording(true);
        toast.info("Recording started");
      } else {
        toast.error("Cannot start recording: No audio stream available.");
      }
    }
  };

  const handleSendMessage = (text: string) => {
    sendMessage(text);
  };

  const handleLeaveMeeting = () => {
    toast.info("Leaving meeting...");
    leaveRoom();
    if (isRecording) {
      void stopRecording();
    }
    navigate("/dashboard");
  };

  const handleEndMeeting = async () => {
    toast.info("Ending meeting and generating summary...");

    leaveRoom();

    // Stop recording if active, otherwise retrieve the saved recording blob
    let audioBlob = null;
    if (isRecording) {
      audioBlob = await stopRecording();
    } else {
      audioBlob = recordingBlobRef.current;
    }

    if (audioBlob && meetingId) {
      try {
        await processMeeting(meetingId, audioBlob, transcriptLines);
        toast.success("AI analysis complete!");
      } catch (err) {
        console.error('Failed to process meeting:', err);
        toast.error("Could not generate AI summary automatically.");
      }
    } else if (meetingId) {
      try {
        const emptyBlob = new Blob([], { type: 'audio/webm' });
        await processMeeting(meetingId, emptyBlob, transcriptLines);
        toast.success("AI analysis complete!");
      } catch (err) {
        console.error('Failed to process meeting:', err);
      }
    }

    navigate(`/meeting/${meetingId}/post`);
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
      .filter((p: any) => {
        const pId = p.userId || p._id || p.id;
        return pId && pId !== user?._id;
      })
      .map((p: any) => {
        const pId = p.userId || p._id || p.id || "";
        return {
          id: pId,
          name: p.userName || p.name || "Guest",
          isMuted: p.isMuted || false,
          isVideoOff: p.isVideoOff || false,
          isHost: meeting?.hostId ? pId === meeting.hostId : (p.isHost || false),
          isSpeaking: p.isSpeaking || false,
          socketId: p.socketId,
        };
      }),
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

  if (meeting?.status === "scheduled") {
    return (
      <div className="h-screen bg-[#0a0b0f] flex items-center justify-center p-6 text-white text-center">
        <div className="max-w-md w-full bg-[#13141a] border border-white/5 rounded-2xl p-8 space-y-6 shadow-xl">
          <div className="w-16 h-16 bg-indigo-600/10 border border-indigo-500/20 rounded-full flex items-center justify-center mx-auto text-indigo-400">
            <Clock className="w-8 h-8 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">Meeting Not Started Yet</h2>
            <p className="text-sm text-gray-400">
              "{meeting.title}" has not been started by the host.
            </p>
            <p className="text-xs text-gray-500">
              Please wait here. Once the host joins, the meeting will start automatically.
            </p>
          </div>
          <div className="pt-2">
            <Button
              onClick={handleLeaveMeeting}
              variant="outline"
              className="w-full border-white/10 bg-transparent text-gray-300 hover:bg-white/5"
            >
              Back to Dashboard
            </Button>
          </div>
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
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Video Grid */}
        <div className="flex-1 p-3 md:p-4 relative overflow-hidden flex flex-col justify-center">
          <div className={cn("w-full h-full flex gap-3", pinnedId ? "flex-col md:flex-row" : "flex-col")}>
            {pinnedId ? (
              <>
                {/* Pinned Video */}
                <div className="flex-[3] min-h-0 flex items-center justify-center">
                  {(() => {
                    const pinnedParticipant = displayParticipants.find(p => p.id === pinnedId);
                    if (!pinnedParticipant) return null;
                    const isLocal = pinnedParticipant.id === (user?._id || 'local');
                    const remoteStream = !isLocal ? remoteStreams.get(pinnedParticipant.socketId) : undefined;
                    return (
                      <VideoTile
                        key={pinnedParticipant.id}
                        name={pinnedParticipant.name}
                        isMuted={pinnedParticipant.isMuted}
                        isVideoOff={pinnedParticipant.isVideoOff}
                        isSpeaking={pinnedParticipant.isSpeaking}
                        isLocal={isLocal}
                        isPinned={true}
                        onPin={() => setPinnedId(null)}
                        videoRef={isLocal ? localVideoRef : undefined}
                        stream={isLocal ? localStream : remoteStream || null}
                      />
                    );
                  })()}
                </div>
                {/* Other videos in a smaller list */}
                <div className="flex-1 min-h-0 overflow-y-auto flex md:flex-col gap-2 md:max-w-[240px]">
                  {displayParticipants
                    .filter(p => p.id !== pinnedId)
                    .map((participant) => {
                      const isLocal = participant.id === (user?._id || 'local');
                      const remoteStream = !isLocal ? remoteStreams.get(participant.socketId) : undefined;
                      return (
                        <VideoTile
                          key={participant.id}
                          name={participant.name}
                          isMuted={participant.isMuted}
                          isVideoOff={participant.isVideoOff}
                          isSpeaking={participant.isSpeaking}
                          isLocal={isLocal}
                          isPinned={false}
                          onPin={() => setPinnedId(participant.id)}
                          videoRef={isLocal ? localVideoRef : undefined}
                          stream={isLocal ? localStream : remoteStream || null}
                        />
                      );
                    })}
                </div>
              </>
            ) : (
              /* Regular Grid */
              <div
                className={cn(
                  "w-full h-full max-h-full grid gap-2 md:gap-3 overflow-y-auto",
                  displayParticipants.length === 1 && "grid-cols-1",
                  displayParticipants.length === 2 && "grid-cols-1 md:grid-cols-2",
                  displayParticipants.length === 3 && "grid-cols-1 md:grid-cols-2 md:grid-rows-2",
                  displayParticipants.length === 4 && "grid-cols-1 sm:grid-cols-2 md:grid-rows-2",
                  displayParticipants.length > 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
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
                      isPinned={false}
                      onPin={() => setPinnedId(participant.id)}
                      videoRef={isLocal ? localVideoRef : undefined}
                      stream={isLocal ? localStream : remoteStream || null}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Typing indicator */}
          {typingText && (
            <div className="absolute bottom-28 left-4 bg-[#0d0e14]/90 border border-white/10 rounded-lg px-3 py-1.5">
              <span className="text-xs text-gray-400 italic">{typingText}</span>
            </div>
          )}

          {/* Live Transcription Overlay */}
          <TranscriptionPanel lines={transcriptDisplay} isLive={isTranscribing} status={recognitionStatus} isSilenceDetected={isSilenceDetected && !isMuted} />
        </div>

        {/* Side Panels Overlay Backdrop for Mobile */}
        {(isParticipantsOpen || isChatOpen) && (
          <div
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => {
              setIsParticipantsOpen(false);
              setIsChatOpen(false);
            }}
          />
        )}

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
        onLeave={handleLeaveMeeting}
        onEnd={handleEndMeeting}
      />
    </div>
  );
}

export default function MeetingRoomPage() {
  return (
    <ErrorBoundary>
      <MeetingRoomContent />
    </ErrorBoundary>
  );
}