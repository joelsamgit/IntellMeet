import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocketStore } from '@/store/socketStore';
import { useAuthStore } from '@/store/authStore';
import type { Message } from '@/types';

export function useMeetingChat(meetingId: string) {
  const socket = useSocketStore((state) => state.socket);
  const user = useAuthStore((state) => state.user);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const typingTimers = useRef<Map<string, number>>(new Map());
  const pendingMessages = useRef<Map<string, string>>(new Map());

  const clearTypingTimer = (userId: string) => {
    const timer = typingTimers.current.get(userId);
    if (timer) {
      window.clearTimeout(timer);
      typingTimers.current.delete(userId);
    }
  };

  const scheduleTypingStop = (userId: string, userName: string) => {
    clearTypingTimer(userId);
    const timer = window.setTimeout(() => {
      setTypingUsers((current) => {
        const next = new Map(current);
        next.delete(userId);
        return next;
      });
      typingTimers.current.delete(userId);
    }, 1500);

    typingTimers.current.set(userId, timer);
    setTypingUsers((current) => {
      const next = new Map(current);
      next.set(userId, userName);
      return next;
    });
  };

  const upsertMessage = useCallback((incoming: Message & { clientMessageId?: string }) => {
    setMessages((current) => {
      const tempId = incoming.clientMessageId
        ? pendingMessages.current.get(incoming.clientMessageId)
        : undefined;

      if (tempId) {
        pendingMessages.current.delete(incoming.clientMessageId as string);
        return current.map((message) => (message._id === tempId ? incoming : message));
      }

      const existingIndex = current.findIndex((message) => message._id === incoming._id);
      if (existingIndex !== -1) {
        const next = current.slice();
        next[existingIndex] = { ...next[existingIndex], ...incoming };
        return next;
      }

      return [...current, incoming];
    });
  }, []);

  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (!socket || !meetingId) return;

      console.log('[chat] typing emit', { meetingId, isTyping, socketId: socket.id });

      if (isTyping) {
        socket.emit('typing', { meetingId });
        clearTypingTimer(socket.id || meetingId);
        const timer = window.setTimeout(() => {
          console.log('[chat] auto stop-typing emit', { meetingId, socketId: socket.id });
          socket.emit('stop-typing', { meetingId });
        }, 1500);
        typingTimers.current.set(socket.id || meetingId, timer);
        return;
      }

      socket.emit('stop-typing', { meetingId });
      clearTypingTimer(socket.id || meetingId);
    },
    [meetingId, socket]
  );

  const sendMessage = useCallback(
    (text: string) => {
      if (!socket || !meetingId || !text.trim()) return;

      const clientMessageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimisticMessage: Message & { clientMessageId?: string } = {
        _id: clientMessageId,
        clientMessageId,
        senderId: user?._id || socket.id || 'local',
        senderName: user?.name || 'You',
        senderAvatar: user?.avatar,
        text: text.trim(),
        timestamp: new Date().toISOString(),
        type: 'text',
      };

      pendingMessages.current.set(clientMessageId, clientMessageId);
      console.log('[chat] send-message emit', {
        meetingId,
        clientMessageId,
        socketId: socket.id,
      });

      upsertMessage(optimisticMessage);

      socket.emit(
        'send-message',
        {
          meetingId,
          content: text.trim(),
          type: 'text',
          clientMessageId,
        },
        (response: any) => {
          if (response?.error) {
            console.error('[chat] send-message failed:', response.error);
            pendingMessages.current.delete(clientMessageId);
            setMessages((current) => current.filter((message) => message._id !== clientMessageId));
            return;
          }

          if (response?.message) {
            console.log('[chat] send-message ack', response.message);
            upsertMessage(response.message);
          }
        }
      );
    },
    [meetingId, socket, upsertMessage, user]
  );

  const loadHistory = useCallback(
    (history: Message[]) => {
      console.log('[chat] loading history', { count: history?.length || 0, meetingId });
      pendingMessages.current.clear();
      setMessages(history || []);
    },
    [meetingId]
  );

  useEffect(() => {
    if (!socket || !meetingId) return undefined;

    const handleReceiveMessage = (message: Message & { clientMessageId?: string }) => {
      console.log('[chat] receive-message', message);
      upsertMessage(message);
    };

    const handleTyping = (payload: any) => {
      const userId = payload?.userId || payload?.socketId || 'unknown';
      const userName = payload?.userName || 'Guest';
      console.log('[chat] typing event', payload);
      scheduleTypingStop(userId, userName);
    };

    const handleStopTyping = (payload: any) => {
      const userId = payload?.userId || payload?.socketId || 'unknown';
      console.log('[chat] stop-typing event', payload);
      clearTypingTimer(userId);
      setTypingUsers((current) => {
        const next = new Map(current);
        next.delete(userId);
        return next;
      });
    };

    socket.on('receive-message', handleReceiveMessage);
    socket.on('typing', handleTyping);
    socket.on('stop-typing', handleStopTyping);

    return () => {
      socket.off('receive-message', handleReceiveMessage);
      socket.off('typing', handleTyping);
      socket.off('stop-typing', handleStopTyping);
    };
  }, [meetingId, socket, upsertMessage]);

  useEffect(
    () => () => {
      typingTimers.current.forEach((timer) => window.clearTimeout(timer));
      typingTimers.current.clear();
      pendingMessages.current.clear();
    },
    []
  );

  return {
    messages,
    typingUsers,
    sendMessage,
    setTyping,
    loadHistory,
  };
}