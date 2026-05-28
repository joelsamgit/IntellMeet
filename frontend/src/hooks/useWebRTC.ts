import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocketStore } from '@/store/socketStore';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

function shouldInitiate(localSocketId: string | undefined, remoteSocketId: string) {
  if (!localSocketId) return false;
  return localSocketId.localeCompare(remoteSocketId) < 0;
}

export function useWebRTC(meetingId: string) {
  const socket = useSocketStore((state) => state.socket);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const isMutedRef = useRef(false);
  const isVideoOffRef = useRef(false);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const screenShareStream = useRef<MediaStream | null>(null);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isVideoOffRef.current = isVideoOff;
  }, [isVideoOff]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  const syncLocalMediaState = useCallback((stream: MediaStream | null) => {
    const audioTrack = stream?.getAudioTracks()[0];
    const videoTrack = stream?.getVideoTracks()[0];
    const nextMuted = audioTrack ? !audioTrack.enabled : true;
    const nextVideoOff = videoTrack ? !videoTrack.enabled : true;

    setIsMuted(nextMuted);
    setIsVideoOff(nextVideoOff);
    isMutedRef.current = nextMuted;
    isVideoOffRef.current = nextVideoOff;
  }, []);

  const cleanupPeer = useCallback((remoteSocketId: string) => {
    console.log('[webrtc] cleaning up peer', { meetingId, remoteSocketId });
    const peer = peerConnections.current.get(remoteSocketId);
    if (peer) {
      peer.ontrack = null;
      peer.onicecandidate = null;
      peer.onconnectionstatechange = null;
      peer.close();
      peerConnections.current.delete(remoteSocketId);
    }

    pendingCandidates.current.delete(remoteSocketId);
    setRemoteStreams((current) => {
      const next = new Map(current);
      next.delete(remoteSocketId);
      return next;
    });
  }, []);

  const attachLocalTracks = useCallback(
    (peer: RTCPeerConnection) => {
      if (!localStream) return;

      localStream.getTracks().forEach((track) => {
        const existingSender = peer.getSenders().find((sender) => sender.track?.kind === track.kind);
        if (!existingSender) {
          peer.addTrack(track, localStream);
        }
      });
    },
    [localStream]
  );

  const flushPendingCandidates = useCallback(
    async (remoteSocketId: string) => {
      const peer = peerConnections.current.get(remoteSocketId);
      const candidates = pendingCandidates.current.get(remoteSocketId) || [];
      if (!peer || candidates.length === 0) return;

      for (const candidate of candidates) {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.warn('[webrtc] failed to add queued ICE candidate', error);
        }
      }

      pendingCandidates.current.delete(remoteSocketId);
    },
    []
  );

  const createPeerConnection = useCallback(
    (remoteSocketId: string) => {
      const existing = peerConnections.current.get(remoteSocketId);
      if (existing) {
        console.log('[webrtc] reusing peer connection', { meetingId, remoteSocketId });
        return existing;
      }

      console.log('[webrtc] creating peer connection', { meetingId, remoteSocketId });
      const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      peer.ontrack = (event) => {
        const [stream] = event.streams;
        if (!stream) return;

        setRemoteStreams((current) => {
          const next = new Map(current);
          next.set(remoteSocketId, stream);
          return next;
        });
      };

      peer.onicecandidate = (event) => {
        if (!event.candidate || !socket) return;

        socket.emit('ice-candidate', {
          meetingId,
          targetSocketId: remoteSocketId,
          candidate: event.candidate,
        });
      };

      peer.onconnectionstatechange = () => {
        if (['failed', 'closed', 'disconnected'].includes(peer.connectionState)) {
          cleanupPeer(remoteSocketId);
        }
      };

      attachLocalTracks(peer);
      peerConnections.current.set(remoteSocketId, peer);
      return peer;
    },
    [attachLocalTracks, cleanupPeer, meetingId, socket]
  );

  const negotiateWithPeer = useCallback(
    async (remoteSocketId: string) => {
      if (!socket) return;
      const peer = createPeerConnection(remoteSocketId);

      try {
        console.log('[webrtc] negotiating offer', { meetingId, remoteSocketId, socketId: socket.id });
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);

        socket.emit('offer', {
          meetingId,
          targetSocketId: remoteSocketId,
          offer,
        });
      } catch (error) {
        console.error('[webrtc] offer negotiation failed', error);
      }
    },
    [createPeerConnection, meetingId, socket]
  );

  const ensurePeerForRemote = useCallback(
    (remoteSocketId: string, forceOffer = false) => {
      const peer = createPeerConnection(remoteSocketId);
      if (forceOffer) {
        void negotiateWithPeer(remoteSocketId);
      }
      return peer;
    },
    [createPeerConnection, negotiateWithPeer]
  );

  const syncWithParticipants = useCallback(
    (participants: Array<{ socketId: string }>) => {
      if (!socket?.id || !participants?.length) return;

      participants
        .map((participant) => participant.socketId)
        .filter((remoteSocketId) => remoteSocketId && remoteSocketId !== socket.id)
        .forEach((remoteSocketId) => {
          const shouldOffer = shouldInitiate(socket.id, remoteSocketId);
          ensurePeerForRemote(remoteSocketId, shouldOffer);
        });
    },
    [ensurePeerForRemote, socket]
  );

  const initLocalStream = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    console.log('[webrtc] requesting local media stream', { meetingId });

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });

    localStreamRef.current = stream;
    setLocalStream(stream);
    console.log('[webrtc] local media stream ready', {
      audioTracks: stream.getAudioTracks().length,
      videoTracks: stream.getVideoTracks().length,
      audioEnabled: stream.getAudioTracks().map((track) => track.enabled),
      videoEnabled: stream.getVideoTracks().map((track) => track.enabled),
    });
    syncLocalMediaState(stream);
    return stream;
  }, [meetingId, syncLocalMediaState]);

  const emitMediaState = useCallback(
    (stream: MediaStream) => {
      const audioEnabled = stream.getAudioTracks()[0]?.enabled ?? false;
      const videoEnabled = stream.getVideoTracks()[0]?.enabled ?? false;

      console.log('[webrtc] emitting media-state-change', {
        meetingId,
        audioEnabled,
        videoEnabled,
        socketId: socket?.id,
      });

      socket?.emit('media-state-change', {
        meetingId,
        audio: audioEnabled,
        video: videoEnabled,
      });
    },
    [meetingId, socket]
  );

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) {
      console.warn('[webrtc] toggleMute ignored: no local stream');
      return undefined;
    }

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) {
      console.warn('[webrtc] toggleMute ignored: no audio track');
      return undefined;
    }

    audioTrack.enabled = !audioTrack.enabled;
    const nextMuted = !audioTrack.enabled;
    setIsMuted(nextMuted);
    isMutedRef.current = nextMuted;

    console.log('[webrtc] microphone track updated', {
      meetingId,
      trackEnabled: audioTrack.enabled,
      muted: nextMuted,
    });

    emitMediaState(stream);
    return nextMuted;
  }, [emitMediaState, meetingId]);

  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) {
      console.warn('[webrtc] toggleVideo ignored: no local stream');
      return undefined;
    }

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      console.warn('[webrtc] toggleVideo ignored: no video track');
      return undefined;
    }

    videoTrack.enabled = !videoTrack.enabled;
    const nextVideoOff = !videoTrack.enabled;
    setIsVideoOff(nextVideoOff);
    isVideoOffRef.current = nextVideoOff;

    console.log('[webrtc] camera track updated', {
      meetingId,
      trackEnabled: videoTrack.enabled,
      videoOff: nextVideoOff,
    });

    emitMediaState(stream);
    return nextVideoOff;
  }, [emitMediaState, meetingId]);

  const replaceVideoTrack = useCallback(
    async (nextTrack: MediaStreamTrack | null) => {
      for (const peer of peerConnections.current.values()) {
        const sender = peer.getSenders().find((trackSender) => trackSender.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(nextTrack);
        }
      }
    },
    []
  );

  const startScreenShare = useCallback(async () => {
    if (!socket || !meetingId || isScreenSharing) return;

    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const [screenTrack] = stream.getVideoTracks();
    screenShareStream.current = stream;

    await replaceVideoTrack(screenTrack || null);
    setIsScreenSharing(true);

    screenTrack?.addEventListener('ended', () => {
      void (async () => {
        await replaceVideoTrack(localStream?.getVideoTracks()[0] || null);
        setIsScreenSharing(false);
        screenShareStream.current?.getTracks().forEach((track) => track.stop());
        screenShareStream.current = null;
        socket.emit('screen-share-stop', { meetingId });
      })();
    });

    socket.emit('screen-share-start', { meetingId });
  }, [isScreenSharing, localStream, meetingId, replaceVideoTrack, socket]);

  const stopScreenShare = useCallback(async () => {
    if (!socket || !meetingId || !isScreenSharing) return;

    await replaceVideoTrack(localStream?.getVideoTracks()[0] || null);
    setIsScreenSharing(false);
    screenShareStream.current?.getTracks().forEach((track) => track.stop());
    screenShareStream.current = null;
    socket.emit('screen-share-stop', { meetingId });
  }, [isScreenSharing, localStream, meetingId, replaceVideoTrack, socket]);

  useEffect(() => {
    if (!localStream) return;

    console.log('[webrtc] attaching local stream to peers', {
      meetingId,
      peerCount: peerConnections.current.size,
    });

    peerConnections.current.forEach((peer) => {
      attachLocalTracks(peer);
      if (socket?.connected) {
        void negotiateWithPeer(
          Array.from(peerConnections.current.entries()).find(([, currentPeer]) => currentPeer === peer)?.[0] || ''
        );
      }
    });
  }, [attachLocalTracks, localStream, negotiateWithPeer, socket]);

  useEffect(() => {
    if (!socket || !meetingId) return undefined;

    const handleUserJoined = (payload: any) => {
      const remoteSocketId = payload?.socketId;
      if (!remoteSocketId || remoteSocketId === socket.id) return;

      console.log('[webrtc] user-joined, preparing peer', payload);

      const shouldOffer = shouldInitiate(socket.id, remoteSocketId);
      ensurePeerForRemote(remoteSocketId, shouldOffer);
    };

    const handleRoomParticipants = (payload: any) => {
      if (payload?.meetingId !== meetingId) return;
      console.log('[webrtc] room-participants snapshot received', payload.participants);
      syncWithParticipants(payload.participants || []);
    };

    const handleMediaStateChange = (payload: any) => {
      console.log('[webrtc] media-state-change received', payload);
      if (payload?.socketId === socket.id) return;
    };

    const handleOffer = async (payload: any) => {
      const remoteSocketId = payload?.from;
      const offer = payload?.offer;
      if (!remoteSocketId || !offer) return;

      const peer = createPeerConnection(remoteSocketId);
      try {
        console.log('[webrtc] offer received', { meetingId, remoteSocketId, socketId: socket.id });
        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        attachLocalTracks(peer);
        await flushPendingCandidates(remoteSocketId);

        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        socket.emit('answer', {
          meetingId,
          targetSocketId: remoteSocketId,
          answer,
        });
      } catch (error) {
        console.error('[webrtc] handling offer failed', error);
      }
    };

    const handleAnswer = async (payload: any) => {
      const remoteSocketId = payload?.from;
      const answer = payload?.answer;
      if (!remoteSocketId || !answer) return;

      const peer = peerConnections.current.get(remoteSocketId);
      if (!peer) return;

      try {
        console.log('[webrtc] answer received', { meetingId, remoteSocketId, socketId: socket.id });
        await peer.setRemoteDescription(new RTCSessionDescription(answer));
        await flushPendingCandidates(remoteSocketId);
      } catch (error) {
        console.error('[webrtc] handling answer failed', error);
      }
    };

    const handleIceCandidate = async (payload: any) => {
      const remoteSocketId = payload?.from;
      const candidate = payload?.candidate;
      if (!remoteSocketId || !candidate) return;

      const peer = peerConnections.current.get(remoteSocketId);
      if (!peer || !peer.remoteDescription) {
        console.log('[webrtc] queueing ICE candidate', { meetingId, remoteSocketId, socketId: socket.id });
        const queue = pendingCandidates.current.get(remoteSocketId) || [];
        queue.push(candidate);
        pendingCandidates.current.set(remoteSocketId, queue);
        return;
      }

      try {
        console.log('[webrtc] adding ICE candidate', { meetingId, remoteSocketId, socketId: socket.id });
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn('[webrtc] failed to add ICE candidate', error);
      }
    };

    const handleUserLeft = (payload: any) => {
      const remoteSocketId = payload?.socketId;
      if (remoteSocketId) {
        cleanupPeer(remoteSocketId);
      }
    };

    socket.on('user-joined', handleUserJoined);
    socket.on('room-participants', handleRoomParticipants);
    socket.on('media-state-change', handleMediaStateChange);
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('user-left', handleUserLeft);

    return () => {
      socket.off('user-joined', handleUserJoined);
      socket.off('room-participants', handleRoomParticipants);
      socket.off('media-state-change', handleMediaStateChange);
      socket.off('offer', handleOffer);
      socket.off('answer', handleAnswer);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('user-left', handleUserLeft);
    };
  }, [attachLocalTracks, cleanupPeer, createPeerConnection, ensurePeerForRemote, flushPendingCandidates, meetingId, socket, stopScreenShare, syncWithParticipants]);

  return {
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
  };
}