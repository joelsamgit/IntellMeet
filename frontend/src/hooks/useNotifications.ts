import { useEffect } from 'react';
import api from '@/api/axios';
import { useNotificationStore } from '@/store/notificationStore';

export function useNotifications() {
  const setNotifications = useNotificationStore((state) => state.setNotifications);
  const store = useNotificationStore();

  useEffect(() => {
    let mounted = true;

    api
      .get('/notifications')
      .then((response) => {
        if (!mounted) return;
        setNotifications(response.data.notifications || []);
      })
      .catch((error) => {
        console.error('[notifications] failed to load notifications', error);
      });

    return () => {
      mounted = false;
    };
  }, [setNotifications]);

  return store;
}