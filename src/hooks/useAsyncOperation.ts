import { useState } from 'react';

/**
 * Custom hook for handling async operations with loading and error states
 */
export const useAsyncOperation = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeAsync = async <T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> => {
    try {
      setIsLoading(true);
      setError(null);
      return await operation();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to ${operationName}`;
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { isLoading, error, executeAsync };
};
