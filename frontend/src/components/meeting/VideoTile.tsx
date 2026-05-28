import { useEffect, useRef } from "react";
import { Mic, MicOff, Pin, MoreVertical } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface VideoTileProps {
  name: string;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isSpeaking?: boolean;
  isLocal?: boolean;
  isPinned?: boolean;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  stream?: MediaStream | null;
}

export default function VideoTile({
  name,
  isMuted = false,
  isVideoOff = false,
  isSpeaking = false,
  isLocal = false,
  isPinned = false,
  videoRef,
  stream,
}: VideoTileProps) {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const resolvedRef = videoRef ?? internalVideoRef;

  useEffect(() => {
    const videoElement = resolvedRef.current;
    if (!videoElement || !stream) return;

    videoElement.srcObject = stream;
  }, [resolvedRef, stream]);

  return (
    <div
      className={cn(
        "relative bg-[#1a1d27] rounded-xl overflow-hidden aspect-video flex items-center justify-center group",
        isSpeaking && "ring-2 ring-indigo-500 ring-offset-1 ring-offset-[#0a0b0f]",
        isPinned && "ring-2 ring-yellow-500"
      )}
    >
      {/* Video Element */}
      {!isVideoOff && videoRef ? (
        <video
          ref={resolvedRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : !isVideoOff && stream ? (
        <video
          ref={resolvedRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        /* Avatar when video is off */
        <div className="flex flex-col items-center gap-3">
          <Avatar className="w-16 h-16">
            <AvatarFallback className="bg-indigo-600 text-white text-xl font-semibold">
              {name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-gray-400">{name}</span>
        </div>
      )}

      {/* Bottom Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-white">
            {name} {isLocal && "(You)"}
          </span>
          {isSpeaking && (
            <span className="text-xs text-indigo-400 animate-pulse">
              Speaking
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isMuted ? (
            <div className="w-6 h-6 bg-red-500/80 rounded-full flex items-center justify-center">
              <MicOff className="w-3 h-3 text-white" />
            </div>
          ) : (
            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center", isSpeaking ? "bg-indigo-500/80" : "bg-black/40")}>
              <Mic className="w-3 h-3 text-white" />
            </div>
          )}
        </div>
      </div>

      {/* Hover Actions */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <button className="w-6 h-6 bg-black/60 rounded-md flex items-center justify-center hover:bg-black/80 transition-colors">
          <Pin className="w-3 h-3 text-white" />
        </button>
        {!isLocal && (
          <button className="w-6 h-6 bg-black/60 rounded-md flex items-center justify-center hover:bg-black/80 transition-colors">
            <MoreVertical className="w-3 h-3 text-white" />
          </button>
        )}
      </div>

      {/* Local Badge */}
      {isLocal && (
        <div className="absolute top-2 left-2 bg-indigo-500/80 rounded-md px-1.5 py-0.5">
          <span className="text-[10px] text-white font-medium">You</span>
        </div>
      )}
    </div>
  );
}