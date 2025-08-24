import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';

export interface ErrorInfo {
  id: string;
  message: string;
  type: 'error' | 'warning' | 'info';
  timestamp: Date;
  source?: string; // e.g., 'voting', 'dripper', 'wallet'
  details?: string;
  autoDismiss?: boolean; // Whether to auto-dismiss this error
  dismissTimeout?: number; // Timeout in milliseconds (default: 5000ms for info, 10000ms for errors)
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
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      timeoutsRef.current.clear();
    };
  }, []);

  const addError = (error: Omit<ErrorInfo, 'id' | 'timestamp'>) => {
    const newError: ErrorInfo = {
      ...error,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      autoDismiss: error.autoDismiss ?? true, // Default to auto-dismiss
      dismissTimeout: error.dismissTimeout ?? (error.type === 'info' ? 5000 : 10000), // 5s for info, 10s for errors
    };
    
    setErrors(prev => [newError, ...prev.slice(0, 4)]); // Keep only last 5 errors

    // Set up auto-dismiss timeout
    if (newError.autoDismiss) {
      const timeout = setTimeout(() => {
        clearError(newError.id);
      }, newError.dismissTimeout);
      
      timeoutsRef.current.set(newError.id, timeout);
    }
  };

  const clearError = (id: string) => {
    // Clear the timeout if it exists
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
    
    setErrors(prev => prev.filter(error => error.id !== id));
  };

  const clearAllErrors = () => {
    // Clear all timeouts
    timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    timeoutsRef.current.clear();
    
    setErrors([]);
  };

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
