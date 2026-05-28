import { useEffect, useMemo, useRef, useState } from 'react';
import { useSocketStore } from '@/store/socketStore';
import type { Meeting, Participant } from '@/types';

interface UseMeetingRoomOptions {
  meetingId: string;
  autoJoin?: boolean;
}

function replaceParticipant(list: Participant[], next: Participant) {
  const index = list.findIndex((participant) =>
    participant.socketId === next.socketId || participant.userId === next.userId
  );

  if (index === -1) {
    return [...list, next];
  }

  const updated = list.slice();
  updated[index] = { ...updated[index], ...next };
  return updated;
}

export function useMeetingRoom({ meetingId, autoJoin = false }: UseMeetingRoomOptions) {
  const socket = useSocketStore((state) => state.socket);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isJoined, setIsJoined] = useState(false);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const joinedRef = useRef(false);
  const joiningRef = useRef(false);

  const joinRoom = useMemo(() => {
    return (force = false) => {
      if (!socket || !meetingId || !socket.connected) return;
      if (joiningRef.current) return;
      if (joinedRef.current && !force) return;

      joiningRef.current = true;
      console.log('[meeting] join-room request', { meetingId, socketId: socket.id, force });
      socket.emit('join-room', { meetingId }, (response: any) => {
        joiningRef.current = false;

        if (response?.error) {
          console.error('[meeting] join-room failed:', response.error);
          joinedRef.current = false;
          setIsJoined(false);
          return;
        }

        if (Array.isArray(response?.participants)) {
          console.log('[meeting] join-room participants', response.participants);
          setParticipants(response.participants);
        }

        if (response?.meeting) {
          console.log('[meeting] joined meeting metadata', response.meeting);
          setMeeting(response.meeting);
        }

        joinedRef.current = true;
        setIsJoined(true);
      });
    };
  }, [meetingId, socket]);

  const leaveRoom = useMemo(() => {
    return () => {
      if (!socket || !meetingId || !joinedRef.current) return;
      console.log('[meeting] leave-room request', { meetingId, socketId: socket.id });

      socket.emit('leave-room', { meetingId }, () => {
        joinedRef.current = false;
        joiningRef.current = false;
        setIsJoined(false);
      });
    };
  }, [meetingId, socket]);

  useEffect(() => {
    if (!socket || !meetingId || !autoJoin) return undefined;

    const handleConnect = () => joinRoom(true);
    const handleUserJoined = (payload: any) => {
      if (payload?.participants) {
        setParticipants(payload.participants);
        return;
      }

      if (payload?.userId) {
        setParticipants((current) =>
          replaceParticipant(current, {
            userId: payload.userId,
            socketId: payload.socketId,
            userName: payload.user?.name || payload.userName || 'Guest',
            joinedAt: payload.timestamp || Date.now(),
          })
        );
      }
    };

    const handleUserLeft = (payload: any) => {
      if (payload?.participants) {
        setParticipants(payload.participants);
        return;
      }

      setParticipants((current) =>
        current.filter(
          (participant) =>
            participant.socketId !== payload?.socketId && participant.userId !== payload?.userId
        )
      );
    };

    const handleMediaStateChange = (payload: any) => {
      console.log('[meeting] media-state-change received', payload);
      setParticipants((current) =>
        current.map((participant) =>
          participant.userId === payload?.userId || participant.socketId === payload?.socketId
            ? {
                ...participant,
                isMuted: payload?.audio === false,
                isVideoOff: payload?.video === false,
              }
            : participant
        )
      );
    };

    const handleScreenShareStart = (payload: any) => {
      setParticipants((current) =>
        current.map((participant) =>
          participant.userId === payload?.userId || participant.socketId === payload?.socketId
            ? { ...participant, isScreenSharing: true }
            : participant
        )
      );
    };

    const handleScreenShareStop = (payload: any) => {
      setParticipants((current) =>
        current.map((participant) =>
          participant.userId === payload?.userId || participant.socketId === payload?.socketId
            ? { ...participant, isScreenSharing: false }
            : participant
        )
      );
    };

    socket.on('connect', handleConnect);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('media-state-change', handleMediaStateChange);
    socket.on('screen-share-start', handleScreenShareStart);
    socket.on('screen-share-stop', handleScreenShareStop);

    if (socket.connected) {
      joinRoom(true);
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('media-state-change', handleMediaStateChange);
      socket.off('screen-share-start', handleScreenShareStart);
      socket.off('screen-share-stop', handleScreenShareStop);
    };
  }, [autoJoin, joinRoom, meetingId, socket]);

  return {
    participants,
    isJoined,
    meeting,
    joinRoom,
    leaveRoom,
    setParticipants,
  };
}