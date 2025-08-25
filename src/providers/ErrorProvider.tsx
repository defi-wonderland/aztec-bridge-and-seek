import React, { createContext, useContext, useState, ReactNode, useRef, useEffect } from 'react';

export interface ErrorInfo {
  id: string;
  message: string;
  type: 'error' | 'warning' | 'info' | 'success';
  timestamp: Date;
  source?: string; // e.g., 'voting', 'dripper', 'wallet'
  details?: string;
  timeout?: number; // Auto-dismiss timeout in milliseconds
}

interface ErrorContextType {
  errors: ErrorInfo[];
  addError: (error: Omit<ErrorInfo, 'id' | 'timestamp'>) => void;
  clearError: (id: string) => void;
  clearAllErrors: () => void;
  hasErrors: boolean;
  latestError: ErrorInfo | null;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

interface ErrorProviderProps {
  children: ReactNode;
}

export const ErrorProvider: React.FC<ErrorProviderProps> = ({ children }) => {
  const [errors, setErrors] = useState<ErrorInfo[]>([]);
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const getDefaultTimeout = (type: ErrorInfo['type']): number => {
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

  const addError = (error: Omit<ErrorInfo, 'id' | 'timestamp'>) => {
    const newError: ErrorInfo = {
      ...error,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      timeout: error.timeout ?? getDefaultTimeout(error.type),
    };
    
    setErrors(prev => [newError, ...prev.slice(0, 4)]); // Keep only last 5 errors

    // Set up auto-dismiss timeout if specified
    if (newError.timeout && newError.timeout > 0) {
      const timeoutId = setTimeout(() => {
        clearError(newError.id);
      }, newError.timeout);
      
      timeoutRefs.current.set(newError.id, timeoutId);
    }
  };

  const clearError = (id: string) => {
    // Clear any existing timeout
    const timeoutId = timeoutRefs.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutRefs.current.delete(id);
    }
    
    setErrors(prev => prev.filter(error => error.id !== id));
  };

  const clearAllErrors = () => {
    // Clear all timeouts
    timeoutRefs.current.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    timeoutRefs.current.clear();
    
    setErrors([]);
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

  const hasErrors = errors.length > 0;
  const latestError = errors[0] || null;

  const contextValue: ErrorContextType = {
    errors,
    addError,
    clearError,
    clearAllErrors,
    hasErrors,
    latestError,
  };

  return (
    <ErrorContext.Provider value={contextValue}>
      {children}
    </ErrorContext.Provider>
  );
};

export const useError = (): ErrorContextType => {
  const context = useContext(ErrorContext);
  if (context === undefined) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
};
