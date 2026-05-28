import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocketStore } from '@/store/socketStore';
import type { AIProgress, AIWorkflowResult, TranscriptSegment } from '@/types';

interface TranscriptLine {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
}

export function useTranscription(meetingId: string) {
  const socket = useSocketStore((state) => state.socket);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [aiProgress, setAiProgress] = useState<AIProgress | null>(null);

  const startRecording = useCallback(async (stream: MediaStream) => {
    if (recorderRef.current) return;

    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm';

    const recorder = new MediaRecorder(stream, { mimeType });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.start(1000);
    recorderRef.current = recorder;
    setIsTranscribing(true);
  }, []);

  const stopRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return null;

    const finished = new Promise<Blob | null>((resolve) => {
      recorder.onstop = () => {
        const blob = chunksRef.current.length
          ? new Blob(chunksRef.current, { type: 'video/webm' })
          : null;
        chunksRef.current = [];
        recorderRef.current = null;
        setIsTranscribing(false);
        resolve(blob);
      };
    });

    recorder.stop();
    return finished;
  }, []);

  const applyTranscriptionResult = useCallback((result: AIWorkflowResult | null | undefined) => {
    const segments: TranscriptSegment[] = result?.transcript?.segments
      ? result.transcript.segments.map((segment, index) => ({
          id: `${index}-${segment.startTime ?? index}`,
          speaker: segment.speakerName || 'Speaker',
          text: segment.text,
          timestamp: segment.startTime ? new Date(segment.startTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
          startTime: segment.startTime,
          endTime: segment.endTime,
        }))
      : [];

    setTranscriptLines(
      segments.map((segment) => ({
        id: segment.id,
        speaker: segment.speaker,
        text: segment.text,
        timestamp: segment.timestamp,
      }))
    );
  }, []);

  useEffect(() => {
    if (!socket || !meetingId) return undefined;

    const handleProgress = (progress: AIProgress) => {
      setAiProgress(progress);
    };

    socket.on('ai-progress', handleProgress);

    return () => {
      socket.off('ai-progress', handleProgress);
    };
  }, [meetingId, socket]);

  return {
    transcriptLines,
    isTranscribing,
    aiProgress,
    startRecording,
    stopRecording,
    applyTranscriptionResult,
  };
}