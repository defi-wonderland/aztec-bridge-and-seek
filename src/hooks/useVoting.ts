import { useState, useEffect } from 'react';
import { useAztecWallet } from './context/useAztecWallet';

export const useVoting = () => {
  const { connectedAccount, isInitialized, votingService } = useAztecWallet();
  
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
      console.error('Failed to load vote results:', err);
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
    } catch (err) {
      throw err; // Let the error propagate to the global error state
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
