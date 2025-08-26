import { useState, useEffect } from 'react';
import { useAztecWallet } from './context/useAztecWallet';
import { useNotification } from '../providers/NotificationProvider';

export const useVoting = () => {
  const { connectedAccount, isInitialized, votingService } = useAztecWallet();
  const { addNotification } = useNotification();
  
  const [selectedCandidate, setSelectedCandidate] = useState<number | ''>('');
  const [voteResults, setVoteResults] = useState<{ [key: number]: number }>({});
  const [isVoting, setIsVoting] = useState(false);
  const [isLoadingResults, setIsLoadingResults] = useState(false);

  // Auto-load vote results when ready
  useEffect(() => {
    if (connectedAccount && isInitialized && votingService) {
      loadVoteResults();
    }
  }, [connectedAccount, isInitialized, votingService]);

  const loadVoteResults = async () => {
    if (!votingService) return;

    setIsLoadingResults(true);
    try {
      const results = await votingService.getAllVoteCounts();
      setVoteResults(results);
    } catch (err) {
      console.error('Voting load error:', err);
      
      addNotification({
        message: 'Failed to load vote results',
        type: 'error',
        source: 'voting',
        details: 'Could not fetch current vote counts from the blockchain'
      });
    } finally {
      setIsLoadingResults(false);
    }
  };

  const handleVote = async () => {
    if (!selectedCandidate || !votingService) return;

    setIsVoting(true);
    try {
      await votingService.castVote(selectedCandidate);
      await loadVoteResults(); // Reload results after voting
      
      // Show success message
      addNotification({
        message: `Successfully voted for Candidate ${selectedCandidate}`,
        type: 'success',
        source: 'voting'
      });
      
      // Reset selection
      setSelectedCandidate('');
    } catch (err) {
      console.error('Voting cast error:', err);
      
      addNotification({
        message: 'Failed to cast vote',
        type: 'error',
        source: 'voting',
        details: 'Your vote could not be processed. This might be due to network issues or invalid transaction parameters.'
      });
    } finally {
      setIsVoting(false);
    }
  };

  const isReady = connectedAccount && isInitialized && votingService;
  const canVote = isReady && selectedCandidate && !isVoting;

  return {
    // State
    selectedCandidate,
    voteResults,
    isVoting,
    isLoadingResults,
    
    // Computed
    isReady,
    canVote,
    
    // Actions
    setSelectedCandidate,
    handleVote,
  };
};
