import { create } from 'zustand';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  isRead: boolean;
  time: string;
}

interface NotificationState {
  notifications: AppNotification[];
  addNotification: (notification: Omit<AppNotification, 'id' | 'isRead' | 'time'>) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [
    {
      id: 'welcome_1',
      title: 'Welcome to RDIS',
      message: 'Your workspace is ready and properly configured.',
      type: 'info',
      isRead: false,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ],
  addNotification: (notif) => set((state) => ({
    notifications: [
      {
        ...notif,
        id: Date.now().toString(),
        isRead: false,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
      ...state.notifications
    ]
  })),
  markAllAsRead: () => set((state) => ({
    notifications: state.notifications.map(n => ({ ...n, isRead: true }))
  })),
  clearAll: () => set({ notifications: [] }),
}));
