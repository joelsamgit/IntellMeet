import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocketStore } from '@/store/socketStore';
import { useAuthStore } from '@/store/authStore';
import type { AIProgress, AIWorkflowResult, TranscriptSegment } from '@/types';

interface TranscriptLine {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
  startTime?: number;
}

export function useTranscription(meetingId: string, isMuted: boolean = false) {
  const socket = useSocketStore((state) => state.socket);
  const user = useAuthStore((state) => state.user);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(true);
  const [interimText, setInterimText] = useState('');
  const [aiProgress, setAiProgress] = useState<AIProgress | null>(null);
  const [recognitionStatus, setRecognitionStatus] = useState('Idle');
  const [isSilenceDetected, setIsSilenceDetected] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const joinTimeRef = useRef<number>(Date.now());

  const startAudioAnalyzer = useCallback((stream: MediaStream) => {
    try {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let silentIntervals = 0;

      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average volume level
        let total = 0;
        for (let i = 0; i < bufferLength; i++) {
          total += dataArray[i];
        }
        const average = total / bufferLength;

        console.log('[transcription] local volume average:', average);

        if (average < 1.5) {
          silentIntervals++;
          // If silent for 5 consecutive checks (5 seconds)
          if (silentIntervals >= 5) {
            setIsSilenceDetected(true);
          }
        } else {
          silentIntervals = 0;
          setIsSilenceDetected(false);
        }

        silenceTimerRef.current = window.setTimeout(checkVolume, 1000);
      };

      silenceTimerRef.current = window.setTimeout(checkVolume, 1000);
    } catch (e) {
      console.warn('[transcription] failed to initialize audio analyzer:', e);
    }
  }, []);

  const stopAudioAnalyzer = useCallback(() => {
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        void audioContextRef.current.close();
      } catch (e) {
        // ignore
      }
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setIsSilenceDetected(false);
  }, []);

  useEffect(() => {
    if (isMuted) {
      setIsSilenceDetected(false);
    }
  }, [isMuted]);

  // React Refs to avoid tearing down SpeechRecognition on metadata / connection changes
  const socketRef = useRef(socket);
  const userRef = useRef(user);
  const meetingIdRef = useRef(meetingId);

  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    meetingIdRef.current = meetingId;
  }, [meetingId]);

  // Real-time local Web Speech API Speech Recognition
  useEffect(() => {
    if (!isTranscribing || isMuted) {
      console.log('[transcription] SpeechRecognition disabled or muted');
      setRecognitionStatus(isMuted ? 'Muted' : 'Inactive');
      return undefined;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[transcription] Web Speech API is not supported in this browser.');
      setRecognitionStatus('Unsupported Browser');
      return undefined;
    }

    console.log('[transcription] SpeechRecognition initializing...');
    setRecognitionStatus('Initializing...');
    const recognition = new SpeechRecognition();
    recognition.continuous = true; // enable continuous mode for real-time speed and fast speech coping
    recognition.interimResults = true; // enable interim results so Chrome streams speech event triggers immediately
    recognition.lang = navigator.language || 'en-US'; // automatic user locale matching for accented speech recognition

    let shouldRestart = true;
    let restartTimer: number;

    recognition.onstart = () => {
      console.log('[transcription] SpeechRecognition started');
      setRecognitionStatus('Active - Listening');
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const finalizedText = finalTranscript.trim();
      const currentInterim = interimTranscript.trim();

      if (finalizedText) {
        console.log('[transcription] recognized final text:', finalizedText);
        setInterimText('');
        setRecognitionStatus('Active - Speech detected');

        const newLine: TranscriptLine = {
          id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          speaker: userRef.current?.name || 'You',
          text: finalizedText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          startTime: Math.floor((Date.now() - joinTimeRef.current) / 1000),
        };
        setTranscriptLines((current) => [...current, newLine]);

        // Broadcast live transcript line via socket so others see it
        const currentSocket = socketRef.current;
        const currentMeetingId = meetingIdRef.current;
        if (currentSocket?.connected && currentMeetingId) {
          currentSocket.emit('send-message', {
            meetingId: currentMeetingId,
            content: `🗣️ [Transcript] ${newLine.speaker}: "${newLine.text}"`,
            type: 'system',
          });
        }
      } else {
        setInterimText(currentInterim);
        if (currentInterim) {
          setRecognitionStatus('Active - Speaking...');
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error('[transcription] SpeechRecognition error:', event.error);
      setRecognitionStatus(`Error: ${event.error}`);
      if (event.error === 'network' || event.error === 'audio-capture') {
        console.warn(`[transcription] SpeechRecognition failed with ${event.error}.`);
        shouldRestart = false;
      } else if (event.error === 'not-allowed') {
        console.warn('[transcription] SpeechRecognition permission not-allowed. Will retry start upon page interaction.');
        // Keep shouldRestart true so it automatically retries with a 2s cooldown inside onend
        shouldRestart = true;
      } else if (event.error === 'service-not-allowed') {
        shouldRestart = false;
      }
    };

    recognition.onend = () => {
      console.log('[transcription] SpeechRecognition ended');
      setRecognitionStatus('Ended');
      if (shouldRestart && isTranscribing && !isMuted) {
        setRecognitionStatus('Ended - Restarting...');
        // Debounce / throttle restart to prevent infinite rapid loops that cause Chrome to block SpeechRecognition
        restartTimer = window.setTimeout(() => {
          try {
            recognition.start();
            console.log('[transcription] SpeechRecognition successfully restarted');
            setRecognitionStatus('Active - Listening (Restarted)');
          } catch (e) {
            console.warn('[transcription] failed to restart SpeechRecognition:', e);
            setRecognitionStatus(`Restart Failed: ${e instanceof Error ? e.message : String(e)}`);
          }
        }, 1000); // 1s safe cooldown for continuous mode auto-recovery
      }
    };

    try {
      recognition.start();
    } catch (e) {
      console.error('[transcription] SpeechRecognition start failed:', e);
      setRecognitionStatus(`Start Failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    return () => {
      shouldRestart = false;
      window.clearTimeout(restartTimer);
      try {
        recognition.stop();
      } catch (e) {
        // ignore
      }
      setInterimText('');
      setRecognitionStatus('Stopped');
      stopAudioAnalyzer();
    };
  }, [isTranscribing, isMuted, setInterimText, setRecognitionStatus, stopAudioAnalyzer]);

  const startRecording = useCallback(async (stream?: MediaStream | null) => {
    if (!stream) {
      console.warn('[transcription] startRecording: no stream provided, live recognition active but recording is disabled.');
      return;
    }

    startAudioAnalyzer(stream);

    if (recorderRef.current) {
      console.log('[transcription] startRecording: MediaRecorder is already active');
      return;
    }

    // Extract only the audio tracks from the WebRTC media stream
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      console.warn('[transcription] startRecording: no audio tracks found in stream');
      return;
    }

    const audioOnlyStream = new MediaStream(audioTracks);
    chunksRef.current = [];
    
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg';

    try {
      console.log('[transcription] starting audio-only MediaRecorder', { mimeType });
      const recorder = new MediaRecorder(audioOnlyStream, { mimeType });
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.start(1000);
      recorderRef.current = recorder;
    } catch (e) {
      console.error('[transcription] failed to start MediaRecorder', e);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    stopAudioAnalyzer();
    const recorder = recorderRef.current;
    if (!recorder) {
      return null;
    }

    const finished = new Promise<Blob | null>((resolve) => {
      recorder.onstop = () => {
        const blob = chunksRef.current.length
          ? new Blob(chunksRef.current, { type: 'audio/webm' })
          : null;
        chunksRef.current = [];
        recorderRef.current = null;
        resolve(blob);
      };
    });

    try {
      recorder.stop();
    } catch (e) {
      return null;
    }
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

    const handleReceiveMessage = (message: any) => {
      if (message.type === 'system' && message.text?.startsWith('🗣️ [Transcript]')) {
        const match = message.text.match(/^🗣️ \[Transcript\] (.*?): "(.*?)"$/);
        if (match) {
          const [, speaker, text] = match;
          // Avoid duplicate local lines
          if (message.senderId === user?._id) return;

          const remoteLine: TranscriptLine = {
            id: message._id || `remote-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            speaker,
            text,
            timestamp: new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            startTime: Math.max(0, Math.floor((new Date(message.timestamp).getTime() - joinTimeRef.current) / 1000)),
          };

          setTranscriptLines((current) => {
            if (current.some((line) => line.id === remoteLine.id || (line.text === remoteLine.text && line.speaker === remoteLine.speaker))) {
              return current;
            }
            return [...current, remoteLine];
          });
        }
      }
    };

    socket.on('ai-progress', handleProgress);
    socket.on('receive-message', handleReceiveMessage);

    return () => {
      socket.off('ai-progress', handleProgress);
      socket.off('receive-message', handleReceiveMessage);
    };
  }, [meetingId, socket, user]);

  const combinedLines = interimText
    ? [
        ...transcriptLines,
        {
          id: 'interim-line',
          speaker: user?.name || 'You',
          text: interimText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]
    : transcriptLines;

  return {
    transcriptLines: combinedLines,
    isTranscribing,
    aiProgress,
    recognitionStatus,
    isSilenceDetected,
    startRecording,
    stopRecording,
    applyTranscriptionResult,
    startAudioAnalyzer,
    stopAudioAnalyzer,
  };
}