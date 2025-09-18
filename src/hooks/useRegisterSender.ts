import { useState, useCallback, useEffect } from 'react';
import { useAztecWallet } from './context';
import { useNotification } from '../providers/NotificationProvider';

export const useRegisterSender = () => {
  const [registeredSenders, setRegisteredSenders] = useState<string[]>([]);
  const [newSenderAddress, setNewSenderAddress] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { sendersService } = useAztecWallet();
  const { addNotification } = useNotification();

  const clearMessages = useCallback(() => {
    setError(null);
  }, []);

  const loadRegisteredSenders = useCallback(async () => {
    if (!sendersService) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const senders = await sendersService.getRegisteredSenders();
      setRegisteredSenders(senders);
    } catch (err) {
      setError(`Failed to load registered senders: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [sendersService]);

  const handleAddSender = useCallback(async () => {
    if (!sendersService) {
      setError('Senders service not available');
      return;
    }

    const trimmedAddress = newSenderAddress.trim();
    if (!trimmedAddress) {
      setError('Please enter a valid address');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      await sendersService.registerSender(trimmedAddress);
      
      // Reload the list to get the updated senders
      const updatedSenders = await sendersService.getRegisteredSenders();
      setRegisteredSenders(updatedSenders);
      setNewSenderAddress('');
      addNotification({
        message: 'Sender registered successfully',
        type: 'success',
        source: 'senders',
      });

    } catch (err) {
      setError(`Failed to register sender: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [addNotification, newSenderAddress, sendersService]);

  const handleRemoveSender = useCallback(async (senderAddress: string) => {
    if (!sendersService) {
      setError('Senders service not available');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      await sendersService.removeSender(senderAddress);
      
      // Reload the list to get the updated senders
      const updatedSenders = await sendersService.getRegisteredSenders();
      setRegisteredSenders(updatedSenders);
      addNotification({
        message: 'Sender removed successfully',
        type: 'success',
        source: 'senders',
      });

    } catch (err) {
      setError(`Failed to remove sender: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [addNotification, sendersService]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddSender();
    }
  }, [handleAddSender]);

  useEffect(() => {
    loadRegisteredSenders();
  }, [loadRegisteredSenders]);

  return {
    registeredSenders,
    newSenderAddress,
    setNewSenderAddress,
    isLoading,
    error,
    handleAddSender,
    handleRemoveSender,
    handleKeyPress,
    clearMessages,
    loadRegisteredSenders,
  };
};
