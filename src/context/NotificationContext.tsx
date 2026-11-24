import React, { createContext, useContext, useState } from 'react';

interface NotificationContextType {
  unreadCount: number;
  markAllAsRead: () => void;
  resetUnread: (count?: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Global unread notifications count, default 0
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const markAllAsRead = () => {
    setUnreadCount(0);
  };

  const resetUnread = (count: number = 0) => {
    setUnreadCount(count);
  };

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        markAllAsRead,
        resetUnread,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    return {
      unreadCount: 0,
      markAllAsRead: () => {},
      resetUnread: () => {},
    };
  }
  return context;
};

export default NotificationContext;
