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
  notificationsByUser: Record<string, AppNotification[]>;
  addNotification: (userId: string, notification: Omit<AppNotification, 'id' | 'isRead' | 'time'>) => void;
  markAllAsRead: (userId: string) => void;
  clearAll: (userId: string) => void;
  getNotifications: (userId: string) => AppNotification[];
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notificationsByUser: {},

  getNotifications: (userId) => get().notificationsByUser[userId] ?? [],

  addNotification: (userId, notif) => set((state) => {
    const existing = state.notificationsByUser[userId] ?? [];
    return {
      notificationsByUser: {
        ...state.notificationsByUser,
        [userId]: [
          {
            ...notif,
            id: Date.now().toString(),
            isRead: false,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
          ...existing,
        ],
      },
    };
  }),

  markAllAsRead: (userId) => set((state) => ({
    notificationsByUser: {
      ...state.notificationsByUser,
      [userId]: (state.notificationsByUser[userId] ?? []).map(n => ({ ...n, isRead: true })),
    },
  })),

  clearAll: (userId) => set((state) => ({
    notificationsByUser: { ...state.notificationsByUser, [userId]: [] },
  })),
}));
