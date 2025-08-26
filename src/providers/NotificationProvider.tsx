import React, { createContext, useContext, useState, ReactNode, useRef, useEffect } from 'react';

export interface NotificationInfo {
  id: string;
  message: string;
  type: 'error' | 'warning' | 'info' | 'success';
  timestamp: Date;
  source?: string; // e.g., 'voting', 'dripper', 'wallet'
  details?: string;
  timeout?: number; // Auto-dismiss timeout in milliseconds
}

interface NotificationContextType {
  notifications: NotificationInfo[];
  addNotification: (notification: Omit<NotificationInfo, 'id' | 'timestamp'>) => void;
  clearNotification: (id: string) => void;
  clearAllNotifications: () => void;
  hasNotifications: boolean;
  latestNotification: NotificationInfo | null;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationInfo[]>([]);
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const getDefaultTimeout = (type: NotificationInfo['type']): number => {
    switch (type) {
      case 'success':
        return 5000; // 5 seconds for success messages
      case 'info':
        return 5000; // 5 seconds for info messages
      case 'warning':
        return 7000; // 7 seconds for warnings
      case 'error':
        return 8000; // 8 seconds for errors
      default:
        return 5000;
    }
  };

  const addNotification = (notification: Omit<NotificationInfo, 'id' | 'timestamp'>) => {
    const newNotification: NotificationInfo = {
      ...notification,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      timeout: notification.timeout ?? getDefaultTimeout(notification.type),
    };
    
    setNotifications(prev => [newNotification, ...prev.slice(0, 4)]); // Keep only last 5 notifications

    // Set up auto-dismiss timeout if specified
    if (newNotification.timeout && newNotification.timeout > 0) {
      const timeoutId = setTimeout(() => {
        clearNotification(newNotification.id);
      }, newNotification.timeout);
      
      timeoutRefs.current.set(newNotification.id, timeoutId);
    }
  };

  const clearNotification = (id: string) => {
    // Clear any existing timeout
    const timeoutId = timeoutRefs.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutRefs.current.delete(id);
    }
    
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  const clearAllNotifications = () => {
    // Clear all timeouts
    timeoutRefs.current.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    timeoutRefs.current.clear();
    
    setNotifications([]);
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      timeoutRefs.current.clear();
    };
  }, []);

  const hasNotifications = notifications.length > 0;
  const latestNotification = notifications[0] || null;

  const contextValue: NotificationContextType = {
    notifications,
    addNotification,
    clearNotification,
    clearAllNotifications,
    hasNotifications,
    latestNotification,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
