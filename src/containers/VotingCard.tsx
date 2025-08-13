import React, { useState, useEffect } from 'react';
import { useAztecWallet } from '../hooks';
import { EasyPrivateVotingContract } from '../artifacts/EasyPrivateVoting';
import { AztecAddress } from '@aztec/aztec.js';
import { getEnv } from '../config';

export const VotingCard: React.FC = () => {
  const { 
    connectedAccount, 
    isInitialized,
    sendTransaction, 
    simulateTransaction 
  } = useAztecWallet();
  
  const [selectedCandidate, setSelectedCandidate] = useState<number | ''>('');
  const [voteResults, setVoteResults] = useState<{ [key: number]: number }>({});
  const [isVoting, setIsVoting] = useState(false);
  const [isLoadingResults, setIsLoadingResults] = useState(false);

  // Get configuration from environment variables
  const config = getEnv();
  
  const contractAddress = config.CONTRACT_ADDRESS;
  // const deployerAddress = config.DEPLOYER_ADDRESS;
  // const deploymentSalt = config.DEPLOYMENT_SALT;

  // Load vote results when account connects
  useEffect(() => {
    if (connectedAccount && isInitialized) {
      loadVoteResults();
    }
  }, [connectedAccount, isInitialized]);

  const loadVoteResults = async () => {
    if (!connectedAccount || !contractAddress) return;

    setIsLoadingResults(true);
    try {
      const results: { [key: number]: number } = {};
      
      // Get vote counts for all 5 candidates
      for (let i = 1; i <= 5; i++) {
        try {
          const votingContract = await EasyPrivateVotingContract.at(
            AztecAddress.fromString(contractAddress),
            connectedAccount
          );
          const interaction = votingContract.methods.get_vote(i);
          const value = await simulateTransaction(interaction);
          results[i] = value;
        } catch (err) {
          console.error(`Failed to get vote for candidate ${i}:`, err);
          results[i] = 0;
        }
      }
      
      setVoteResults(results);
    } catch (err) {
      console.error('Failed to load vote results:', err);
    } finally {
      setIsLoadingResults(false);
    }
  };

  const handleVote = async () => {
    if (!selectedCandidate || !connectedAccount || !contractAddress) return;

    setIsVoting(true);
    try {
      const votingContract = await EasyPrivateVotingContract.at(
        AztecAddress.fromString(contractAddress),
        connectedAccount
      );
      
      const interaction = votingContract.methods.cast_vote(selectedCandidate);
      await sendTransaction(interaction);
      
      // Reload results after voting
      await loadVoteResults();
    } catch (err) {
      // Let the error propagate to the global error state
      // The StatusMessage component will display it
      throw err;
    } finally {
      setIsVoting(false);
    }
  };

  // Show voting form only when account is connected and app is initialized
  const showVotingForm = !!connectedAccount && isInitialized;

  const renderVoteDisplay = () => {
    if (!isInitialized) {
      return <div className="initializing">Waiting for app to initialize...</div>;
    }

    return (
      <div className="vote-display">
        <div className="vote-title">Current Vote Count</div>
        <div id="vote-results" className="vote-results">
          {isLoadingResults ? (
            <div>Loading vote results...</div>
          ) : (
            Object.entries(voteResults).map(([candidate, votes]) => (
              <div key={candidate}>
                Candidate {candidate}: {votes} votes
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="card">
      {renderVoteDisplay()}

      {showVotingForm && (
        <form className="vote-form">
          <h4>Cast Vote</h4>
          <select 
            id="vote-input"
            value={selectedCandidate} 
            onChange={(e) => setSelectedCandidate(Number(e.target.value))}
            disabled={isVoting}
          >
            <option value="" disabled>Select a candidate (1-5)</option>
            <option value="1">Candidate 1</option>
            <option value="2">Candidate 2</option>
            <option value="3">Candidate 3</option>
            <option value="4">Candidate 4</option>
            <option value="5">Candidate 5</option>
          </select>
          <button 
            id="vote-button"
            type="button" 
            onClick={handleVote}
            disabled={!selectedCandidate || isVoting}
          >
            {isVoting ? 'Voting...' : 'Vote'}
          </button>
        </form>
      )}
    </div>
  );
};
