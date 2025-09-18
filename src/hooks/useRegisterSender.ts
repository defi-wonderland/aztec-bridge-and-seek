import { useState, useCallback, useEffect } from 'react';
import { useAztecWallet } from './context';
import { SUCCESS_MESSAGE_TIMEOUT } from '../config/bridgeConstants';

export const useRegisterSender = () => {
  const [registeredSenders, setRegisteredSenders] = useState<string[]>([]);
  const [newSenderAddress, setNewSenderAddress] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const { sendersService } = useAztecWallet();

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  const setSuccessMessage = useCallback((message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), SUCCESS_MESSAGE_TIMEOUT);
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
      setSuccess(null);

      await sendersService.registerSender(trimmedAddress);
      
      // Reload the list to get the updated senders
      const updatedSenders = await sendersService.getRegisteredSenders();
      setRegisteredSenders(updatedSenders);
      setNewSenderAddress('');
      setSuccessMessage('Sender registered successfully');

    } catch (err) {
      setError(`Failed to register sender: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [newSenderAddress, sendersService, setSuccessMessage]);

  const handleRemoveSender = useCallback(async (senderAddress: string) => {
    if (!sendersService) {
      setError('Senders service not available');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      await sendersService.removeSender(senderAddress);
      
      // Reload the list to get the updated senders
      const updatedSenders = await sendersService.getRegisteredSenders();
      setRegisteredSenders(updatedSenders);
      setSuccessMessage('Sender removed successfully');

    } catch (err) {
      setError(`Failed to remove sender: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [sendersService, setSuccessMessage]);

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
    success,
    handleAddSender,
    handleRemoveSender,
    handleKeyPress,
    clearMessages,
    setSuccessMessage,
    loadRegisteredSenders,
  };
};