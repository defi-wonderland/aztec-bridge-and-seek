import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useRef,
} from 'react';

/**
 * Configuration for notification messages with auto-timeout functionality.
 *
 * Auto-timeout behavior:
 * - Info messages: 4 seconds (success notifications)
 * - Warning messages: 6 seconds
 * - Error messages: 8 seconds
 *
 * Usage examples:
 * ```typescript
 * // Auto-closing success message (default)
 * addError({ message: 'Success!', type: 'info', source: 'voting' });
 *
 * // Custom timeout
 * addError({ message: 'Custom timeout', type: 'info', timeout: 2000 });
 *
 * // Persistent message (no auto-close)
 * addError({ message: 'Important error', type: 'error', autoClose: false });
 *
 * // Using utility functions
 * addError(createAutoCloseMessage('Quick success', 'info', { timeout: 2000 }));
 * addError(createPersistentMessage('Critical error', 'error'));
 * ```
 */
export interface ErrorInfo {
  id: string;
  message: string;
  type: 'error' | 'warning' | 'info';
  timestamp: Date;
  source?: string; // e.g., 'voting', 'dripper', 'wallet'
  details?: string;
  autoClose?: boolean; // Whether this message should auto-close
  timeout?: number; // Custom timeout in milliseconds
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

// Default timeout durations (in milliseconds)
const DEFAULT_TIMEOUTS = {
  info: 4000, // 4 seconds for success/info messages
  warning: 6000, // 6 seconds for warnings
  error: 8000, // 8 seconds for errors
};

export const ErrorProvider: React.FC<ErrorProviderProps> = ({ children }) => {
  const [errors, setErrors] = useState<ErrorInfo[]>([]);
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const addError = (error: Omit<ErrorInfo, 'id' | 'timestamp'>) => {
    const newError: ErrorInfo = {
      ...error,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      autoClose: error.autoClose !== false, // Default to true unless explicitly set to false
    };

    setErrors((prev) => [newError, ...prev.slice(0, 4)]); // Keep only last 5 errors

    // Set up auto-timeout if enabled
    if (newError.autoClose) {
      const timeout = newError.timeout || DEFAULT_TIMEOUTS[newError.type];
      const timeoutId = setTimeout(() => {
        clearError(newError.id);
      }, timeout);

      timeoutsRef.current.set(newError.id, timeoutId);
    }
  };

  const clearError = (id: string) => {
    // Clear any existing timeout for this error
    const timeoutId = timeoutsRef.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutsRef.current.delete(id);
    }

    setErrors((prev) => prev.filter((error) => error.id !== id));
  };

  const clearAllErrors = () => {
    // Clear all timeouts
    timeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    timeoutsRef.current.clear();

    setErrors([]);
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      timeoutsRef.current.clear();
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

// Utility functions for common message patterns
export const createAutoCloseMessage = (
  message: string,
  type: ErrorInfo['type'] = 'info',
  options?: {
    source?: string;
    details?: string;
    timeout?: number;
    autoClose?: boolean;
  }
): Omit<ErrorInfo, 'id' | 'timestamp'> => ({
  message,
  type,
  source: options?.source,
  details: options?.details,
  timeout: options?.timeout,
  autoClose: options?.autoClose !== false, // Default to true
});

export const createPersistentMessage = (
  message: string,
  type: ErrorInfo['type'] = 'error',
  options?: {
    source?: string;
    details?: string;
  }
): Omit<ErrorInfo, 'id' | 'timestamp'> => ({
  message,
  type,
  source: options?.source,
  details: options?.details,
  autoClose: false, // Explicitly disable auto-close
});
