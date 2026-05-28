import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useSocketStore } from '@/store/socketStore';
import type { Notification } from '@/types';

export function useSocket() {
  const token = useAuthStore((state) => state.token);
  const socket = useSocketStore((state) => state.socket);
  const connect = useSocketStore((state) => state.connect);
  const disconnect = useSocketStore((state) => state.disconnect);
  const addNotification = useNotificationStore((state) => state.addNotification);

  useEffect(() => {
    if (token) {
      connect(token);
      return;
    }

    disconnect();
  }, [token, connect, disconnect]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleNotification = (notification: Notification) => {
      addNotification(notification);
    };

    socket.on('notification', handleNotification);

    return () => {
      socket.off('notification', handleNotification);
    };
  }, [socket, addNotification]);

  return useSocketStore();
}